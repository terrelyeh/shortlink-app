import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";

/** Resolve the Click.where filter from the ShareToken's scope fields. */
function buildClickFilter(token: {
  shortLinkId: string | null;
  campaignName: string | null;
  rangeWindow: string | null;
  workspaceId: string | null;
}): Prisma.ClickWhereInput {
  const where: Prisma.ClickWhereInput = {};

  if (token.shortLinkId) {
    where.shortLinkId = token.shortLinkId;
  } else if (token.workspaceId) {
    // Campaign / range scope: restrict via parent ShortLink's workspace.
    where.shortLink = { workspaceId: token.workspaceId };
    if (token.campaignName) {
      where.shortLink = {
        workspaceId: token.workspaceId,
        utmCampaign: token.campaignName,
      };
    }
  }

  if (token.rangeWindow) {
    const days = parseInt(token.rangeWindow.replace("d", ""), 10) || 30;
    where.timestamp = { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
  }

  return where;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    const headersList = await headers();
    const clientIp =
      headersList.get("x-forwarded-for")?.split(",")[0] ||
      headersList.get("x-real-ip") ||
      "unknown";
    const rateLimitResponse = checkRateLimit(clientIp, "share-token", {
      limit: 5,
      windowSeconds: 60,
    });
    if (rateLimitResponse) return rateLimitResponse;

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

    if (shareToken.expiresAt && new Date() > shareToken.expiresAt) {
      return NextResponse.json({ error: "Share link has expired" }, { status: 410 });
    }
    if (shareToken.maxViews && shareToken.viewCount >= shareToken.maxViews) {
      return NextResponse.json({ error: "View limit reached" }, { status: 410 });
    }

    if (shareToken.password) {
      if (!password) {
        return NextResponse.json({ requiresPassword: true }, { status: 401 });
      }
      const isValid = await bcrypt.compare(password, shareToken.password);
      if (!isValid) {
        return NextResponse.json({ error: "Invalid password" }, { status: 401 });
      }
    }

    await prisma.shareToken.update({
      where: { id: shareToken.id },
      data: { viewCount: { increment: 1 } },
    });

    const clickWhere = buildClickFilter(shareToken);

    const [clicksByDayRaw, deviceStats, browserStats, countryStats, totalClicks] =
      await Promise.all([
        prisma.click.groupBy({
          by: ["timestamp"],
          where: clickWhere,
          _count: true,
        }),
        prisma.click.groupBy({
          by: ["device"],
          where: clickWhere,
          _count: true,
        }),
        prisma.click.groupBy({
          by: ["browser"],
          where: clickWhere,
          _count: true,
        }),
        prisma.click.groupBy({
          by: ["country"],
          where: { ...clickWhere, country: { not: null } },
          _count: true,
          orderBy: { _count: { country: "desc" } },
          take: 10,
        }),
        prisma.click.count({ where: clickWhere }),
      ]);

    const clicksByDayMap = new Map<string, number>();
    clicksByDayRaw.forEach((c: { timestamp: Date; _count: number }) => {
      const dateStr = c.timestamp.toISOString().split("T")[0];
      clicksByDayMap.set(dateStr, (clicksByDayMap.get(dateStr) || 0) + c._count);
    });
    const clicksByDay = Array.from(clicksByDayMap.entries())
      .map(([date, count]) => ({ date, clicks: count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Build a scope descriptor so the client can render the right
    // title ("This link" vs "Campaign X" vs "Last 30 days").
    const scope = {
      type: shareToken.shortLinkId
        ? "link"
        : shareToken.campaignName
          ? "campaign"
          : "range",
      shortLinkCode: shareToken.shortLink?.code ?? null,
      shortLinkTitle: shareToken.shortLink?.title ?? null,
      shortLinkCreatedAt: shareToken.shortLink?.createdAt ?? null,
      campaignName: shareToken.campaignName,
      rangeWindow: shareToken.rangeWindow,
    } as const;

    return NextResponse.json({
      scope,
      // Legacy field kept for backward compat with old /share/[token] clients.
      link: shareToken.shortLink
        ? {
            code: shareToken.shortLink.code,
            title: shareToken.shortLink.title,
            createdAt: shareToken.shortLink.createdAt,
          }
        : null,
      analytics: {
        totalClicks,
        clicksByDay,
        devices: deviceStats.map((d: { device: string | null; _count: number }) => ({
          name: d.device || "Unknown",
          value: d._count,
        })),
        browsers: browserStats.map((b: { browser: string | null; _count: number }) => ({
          name: b.browser || "Unknown",
          value: b._count,
        })),
        countries: countryStats.map((c: { country: string | null; _count: number }) => ({
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
