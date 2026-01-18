import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// POST - Get shared report (with optional password verification)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json().catch(() => ({}));
    const { password } = body;

    const shareToken = await prisma.shareToken.findUnique({
      where: { token },
      include: {
        shortLink: {
          include: {
            _count: { select: { clicks: true } },
          },
        },
      },
    });

    if (!shareToken) {
      return NextResponse.json({ error: "Invalid share link" }, { status: 404 });
    }

    // Check expiration
    if (shareToken.expiresAt && new Date() > shareToken.expiresAt) {
      return NextResponse.json({ error: "Share link has expired" }, { status: 410 });
    }

    // Check max views
    if (shareToken.maxViews && shareToken.viewCount >= shareToken.maxViews) {
      return NextResponse.json({ error: "View limit reached" }, { status: 410 });
    }

    // Check password
    if (shareToken.password) {
      if (!password) {
        return NextResponse.json({ requiresPassword: true }, { status: 401 });
      }

      const isValid = await bcrypt.compare(password, shareToken.password);
      if (!isValid) {
        return NextResponse.json({ error: "Invalid password" }, { status: 401 });
      }
    }

    // Increment view count
    await prisma.shareToken.update({
      where: { id: shareToken.id },
      data: { viewCount: { increment: 1 } },
    });

    // Get analytics data
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [clicksByDay, deviceStats, browserStats, countryStats, totalClicks] = await Promise.all([
      prisma.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT DATE(timestamp) as date, COUNT(*) as count
        FROM clicks
        WHERE short_link_id = ${shareToken.shortLinkId}
          AND timestamp >= ${thirtyDaysAgo}
        GROUP BY DATE(timestamp)
        ORDER BY date ASC
      `,
      prisma.click.groupBy({
        by: ["device"],
        where: { shortLinkId: shareToken.shortLinkId },
        _count: true,
      }),
      prisma.click.groupBy({
        by: ["browser"],
        where: { shortLinkId: shareToken.shortLinkId },
        _count: true,
      }),
      prisma.click.groupBy({
        by: ["country"],
        where: {
          shortLinkId: shareToken.shortLinkId,
          country: { not: null },
        },
        _count: true,
        orderBy: { _count: { country: "desc" } },
        take: 10,
      }),
      prisma.click.count({ where: { shortLinkId: shareToken.shortLinkId } }),
    ]);

    return NextResponse.json({
      link: {
        code: shareToken.shortLink.code,
        title: shareToken.shortLink.title,
        createdAt: shareToken.shortLink.createdAt,
      },
      analytics: {
        totalClicks,
        clicksByDay: clicksByDay.map((d) => ({
          date: d.date,
          clicks: Number(d.count),
        })),
        devices: deviceStats.map((d) => ({
          name: d.device || "Unknown",
          value: d._count,
        })),
        browsers: browserStats.map((b) => ({
          name: b.browser || "Unknown",
          value: b._count,
        })),
        countries: countryStats.map((c) => ({
          name: c.country || "Unknown",
          value: c._count,
        })),
      },
    });
  } catch (error) {
    console.error("Failed to get shared report:", error);
    return NextResponse.json({ error: "Failed to load report" }, { status: 500 });
  }
}
