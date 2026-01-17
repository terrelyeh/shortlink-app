import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "7d";
    const linkId = searchParams.get("linkId");

    // Calculate date range
    const now = new Date();
    let startDate: Date;

    switch (range) {
      case "24h":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Base query conditions
    const whereClicks: Record<string, unknown> = {
      timestamp: { gte: startDate },
    };

    const whereLinks: Record<string, unknown> = {
      deletedAt: null,
    };

    // Filter by user role
    if (session.user.role === "MEMBER") {
      whereLinks.userId = session.user.id;
    }

    if (linkId) {
      whereClicks.shortLinkId = linkId;
    } else {
      // Get user's links
      const userLinks = await prisma.shortLink.findMany({
        where: whereLinks,
        select: { id: true },
      });
      whereClicks.shortLinkId = { in: userLinks.map((l) => l.id) };
    }

    // Get total clicks
    const totalClicks = await prisma.click.count({ where: whereClicks });

    // Get unique visitors (by IP hash)
    const uniqueVisitors = await prisma.click.groupBy({
      by: ["ipHash"],
      where: whereClicks,
    });

    // Get clicks by day
    const clicksByDay = await prisma.$queryRaw<{ date: string; count: bigint }[]>`
      SELECT
        DATE(timestamp) as date,
        COUNT(*) as count
      FROM clicks
      WHERE timestamp >= ${startDate}
        ${linkId ? prisma.$queryRaw`AND short_link_id = ${linkId}` : prisma.$queryRaw``}
      GROUP BY DATE(timestamp)
      ORDER BY date ASC
    `;

    // Get device distribution
    const deviceStats = await prisma.click.groupBy({
      by: ["device"],
      where: whereClicks,
      _count: true,
    });

    // Get browser distribution
    const browserStats = await prisma.click.groupBy({
      by: ["browser"],
      where: whereClicks,
      _count: true,
    });

    // Get OS distribution
    const osStats = await prisma.click.groupBy({
      by: ["os"],
      where: whereClicks,
      _count: true,
    });

    // Get top referrers
    const referrerStats = await prisma.click.groupBy({
      by: ["referrer"],
      where: {
        ...whereClicks,
        referrer: { not: null },
      },
      _count: true,
      orderBy: { _count: { referrer: "desc" } },
      take: 10,
    });

    // Get country distribution
    const countryStats = await prisma.click.groupBy({
      by: ["country"],
      where: {
        ...whereClicks,
        country: { not: null },
      },
      _count: true,
      orderBy: { _count: { country: "desc" } },
      take: 10,
    });

    // Get top performing links
    const topLinks = await prisma.shortLink.findMany({
      where: whereLinks,
      include: {
        _count: {
          select: { clicks: true },
        },
      },
      orderBy: {
        clicks: { _count: "desc" },
      },
      take: 10,
    });

    return NextResponse.json({
      summary: {
        totalClicks,
        uniqueVisitors: uniqueVisitors.length,
        clicksChange: 0, // TODO: Calculate compared to previous period
      },
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
      operatingSystems: osStats.map((o) => ({
        name: o.os || "Unknown",
        value: o._count,
      })),
      referrers: referrerStats.map((r) => ({
        name: r.referrer || "Direct",
        value: r._count,
      })),
      countries: countryStats.map((c) => ({
        name: c.country || "Unknown",
        value: c._count,
      })),
      topLinks: topLinks.map((l) => ({
        id: l.id,
        code: l.code,
        title: l.title,
        originalUrl: l.originalUrl,
        clicks: l._count.clicks,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
