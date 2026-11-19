import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { sharePeriodBounds } from "@/lib/share-period";

/** Resolve the Click.where filter from the ShareToken's scope fields. */
function buildClickFilter(token: {
  shortLinkId: string | null;
  campaignName: string | null;
  rangeWindow: string | null;
  workspaceId: string | null;
}): Prisma.ClickWhereInput {
  // Real traffic only — same default as every dashboard view. Test clicks
  // (?_test=1) used to leak into reports sent to managers.
  const where: Prisma.ClickWhereInput = { isInternal: false, isSuspectedBot: false };

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

  const bounds = sharePeriodBounds(token.rangeWindow);
  if (bounds.gte || bounds.lte) where.timestamp = bounds;

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

    const [clicksByDayRaw, deviceStats, browserStats, countryStats, totalClicks, byLink] =
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
        // Per-link counts → top links + source / medium breakdown (the
        // "which channel worked" question a manager actually asks).
        prisma.click.groupBy({
          by: ["shortLinkId"],
          where: clickWhere,
          _count: true,
        }),
      ]);

    const linkMeta = await prisma.shortLink.findMany({
      where: { id: { in: byLink.map((r) => r.shortLinkId) } },
      select: { id: true, code: true, title: true, utmSource: true, utmMedium: true, utmContent: true },
    });
    const metaById = new Map(linkMeta.map((l) => [l.id, l]));
    const sourceMap = new Map<string, number>();
    const mediumMap = new Map<string, number>();
    const topLinks = byLink
      .map((r) => {
        const m = metaById.get(r.shortLinkId);
        const source = m?.utmSource || "(none)";
        const medium = m?.utmMedium || "(none)";
        sourceMap.set(source, (sourceMap.get(source) ?? 0) + r._count);
        mediumMap.set(medium, (mediumMap.get(medium) ?? 0) + r._count);
        return {
          code: m?.code ?? "",
          title: m?.title ?? null,
          source: m?.utmSource ?? null,
          medium: m?.utmMedium ?? null,
          content: m?.utmContent ?? null,
          clicks: r._count,
        };
      })
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 20);
    const toRows = (m: Map<string, number>) =>
      [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    const clicksByDayMap = new Map<string, number>();
    clicksByDayRaw.forEach((c: { timestamp: Date; _count: number }) => {
      const dateStr = c.timestamp.toISOString().split("T")[0];
      clicksByDayMap.set(dateStr, (clicksByDayMap.get(dateStr) || 0) + c._count);
    });
    const clicksByDay = Array.from(clicksByDayMap.entries())
      .map(([date, count]) => ({ date, clicks: count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Campaign reports name the campaign's owner (name only — the report
    // is public, so no email / avatar).
    const ownerName =
      shareToken.campaignName && shareToken.workspaceId
        ? (
            await prisma.campaign.findFirst({
              where: { name: shareToken.campaignName, workspaceId: shareToken.workspaceId },
              select: { owner: { select: { name: true } } },
            })
          )?.owner?.name ?? null
        : null;

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
      ownerName,
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
        sources: toRows(sourceMap),
        mediums: toRows(mediumMap),
        topLinks,
      },
    });
  } catch (error) {
    console.error("Failed to get shared report:", error);
    return NextResponse.json({ error: "Failed to load report" }, { status: 500 });
  }
}
