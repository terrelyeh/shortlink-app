import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkspaceId, buildWorkspaceWhere } from "@/lib/workspace";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "7d";
    const linkId = searchParams.get("linkId");
    const campaign = searchParams.get("campaign");
    const tagId = searchParams.get("tagId");
    const customFrom = searchParams.get("from");
    const customTo = searchParams.get("to");

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    if (range === "custom" && customFrom) {
      startDate = new Date(customFrom);
      endDate = customTo ? new Date(customTo) : now;
    } else {
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
    }

    // Base query conditions
    const whereClicks: Record<string, unknown> = {
      timestamp: { gte: startDate, lte: endDate },
    };

    const workspaceId = getWorkspaceId(request);
    const workspaceWhere = buildWorkspaceWhere(workspaceId, session.user.id, session.user.role);
    const whereLinks: Record<string, unknown> = {
      deletedAt: null,
      ...workspaceWhere,
    };

    // Filter by campaign
    if (campaign) {
      if (campaign === "__none__") {
        whereLinks.utmCampaign = null;
      } else {
        whereLinks.utmCampaign = campaign;
      }
    }

    // Filter by tag — find link IDs that have this tag
    if (tagId) {
      const taggedLinks = await prisma.tagOnLink.findMany({
        where: { tagId },
        select: { shortLinkId: true },
      });
      const taggedLinkIds = taggedLinks.map((t: { shortLinkId: string }) => t.shortLinkId);
      whereLinks.id = { in: taggedLinkIds };
    }

    if (linkId) {
      whereClicks.shortLinkId = linkId;
    } else {
      const userLinks = await prisma.shortLink.findMany({
        where: whereLinks,
        select: { id: true },
      });
      whereClicks.shortLinkId = { in: userLinks.map((l: { id: string }) => l.id) };
    }

    // ============================================
    // Parallel queries for better performance
    // ============================================

    const periodMs = now.getTime() - startDate.getTime();
    const prevStartDate = new Date(startDate.getTime() - periodMs);
    const prevWhereClicks: Record<string, unknown> = {
      ...whereClicks,
      timestamp: { gte: prevStartDate, lt: startDate },
    };

    // Stable shortLinkId list for raw SQL (Prisma can't parameterise $queryRaw `IN (...)` directly)
    const shortLinkIds =
      (whereClicks.shortLinkId as { in: string[] } | undefined)?.in ??
      (linkId ? [linkId] : []);

    const [
      totalClicks,
      prevTotalClicks,
      uniqueVisitors,
      deviceStats,
      browserStats,
      osStats,
      referrerStats,
      countryStats,
      clicksByDayRaw,
      clicksByHourRaw,
      topLinks,
      linksWithUTM,
    ] = await Promise.all([
      prisma.click.count({ where: whereClicks }),
      prisma.click.count({ where: prevWhereClicks }),
      prisma.click.groupBy({
        by: ["ipHash"],
        where: whereClicks,
      }),
      prisma.click.groupBy({
        by: ["device"],
        where: whereClicks,
        _count: true,
      }),
      prisma.click.groupBy({
        by: ["browser"],
        where: whereClicks,
        _count: true,
      }),
      prisma.click.groupBy({
        by: ["os"],
        where: whereClicks,
        _count: true,
      }),
      prisma.click.groupBy({
        by: ["referrer"],
        where: { ...whereClicks, referrer: { not: null } },
        _count: true,
        orderBy: { _count: { referrer: "desc" } },
        take: 10,
      }),
      prisma.click.groupBy({
        by: ["country"],
        where: { ...whereClicks, country: { not: null } },
        _count: true,
        orderBy: { _count: { country: "desc" } },
        take: 10,
      }),
      // Raw SQL — proper date truncation instead of groupBy per timestamp
      prisma.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT DATE("timestamp") as date, COUNT(*)::bigint as count
        FROM clicks
        WHERE "short_link_id" IN (SELECT unnest(${shortLinkIds}::text[]))
          AND "timestamp" >= ${startDate}
          AND "timestamp" <= ${endDate}
        GROUP BY DATE("timestamp")
        ORDER BY date ASC
      `,
      prisma.$queryRaw<{ hour: number; count: bigint }[]>`
        SELECT EXTRACT(HOUR FROM "timestamp")::int as hour, COUNT(*)::bigint as count
        FROM clicks
        WHERE "short_link_id" IN (SELECT unnest(${shortLinkIds}::text[]))
          AND "timestamp" >= ${startDate}
          AND "timestamp" <= ${endDate}
        GROUP BY EXTRACT(HOUR FROM "timestamp")
        ORDER BY hour ASC
      `,
      prisma.shortLink.findMany({
        where: whereLinks,
        include: { _count: { select: { clicks: true } } },
        orderBy: { clicks: { _count: "desc" } },
        take: 10,
      }),
      prisma.shortLink.findMany({
        where: {
          ...whereLinks,
          OR: [
            { utmCampaign: { not: null } },
            { utmSource: { not: null } },
            { utmMedium: { not: null } },
          ],
        },
        select: {
          id: true,
          utmCampaign: true,
          utmSource: true,
          utmMedium: true,
          utmContent: true,
          _count: {
            select: {
              clicks: {
                where: { timestamp: { gte: startDate, lte: endDate } },
              },
            },
          },
        },
      }),
    ]);

    // Calculate percentage change
    let clicksChange = 0;
    if (prevTotalClicks > 0) {
      clicksChange = Math.round(((totalClicks - prevTotalClicks) / prevTotalClicks) * 100);
    } else if (totalClicks > 0) {
      clicksChange = 100;
    }

    const clicksByDay = clicksByDayRaw.map((row) => ({
      date: typeof row.date === "string" ? row.date : new Date(row.date).toISOString().split("T")[0],
      clicks: Number(row.count),
    }));

    // Fill all 24 hours
    const clicksByHourMap = new Map<number, number>();
    for (let h = 0; h < 24; h++) clicksByHourMap.set(h, 0);
    clicksByHourRaw.forEach((row) => {
      clicksByHourMap.set(row.hour, Number(row.count));
    });
    const clicksByHour = Array.from(clicksByHourMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([hour, clicks]) => ({ hour, clicks }));

    // Aggregate UTM data
    const campaignMap = new Map<string, number>();
    const sourceMap = new Map<string, number>();
    const mediumMap = new Map<string, number>();
    const campaignSourceMap = new Map<string, { campaign: string; source: string; clicks: number }>();
    const campaignContentMap = new Map<string, { campaign: string; content: string; clicks: number }>();

    linksWithUTM.forEach((link) => {
      const clickCount = link._count.clicks;

      if (link.utmCampaign) {
        campaignMap.set(link.utmCampaign, (campaignMap.get(link.utmCampaign) || 0) + clickCount);
      }
      if (link.utmSource) {
        sourceMap.set(link.utmSource, (sourceMap.get(link.utmSource) || 0) + clickCount);
      }
      if (link.utmMedium) {
        mediumMap.set(link.utmMedium, (mediumMap.get(link.utmMedium) || 0) + clickCount);
      }

      if (link.utmCampaign && link.utmSource) {
        const key = `${link.utmCampaign}|${link.utmSource}`;
        const existing = campaignSourceMap.get(key);
        if (existing) {
          existing.clicks += clickCount;
        } else {
          campaignSourceMap.set(key, { campaign: link.utmCampaign, source: link.utmSource, clicks: clickCount });
        }
      }

      if (link.utmCampaign && link.utmContent) {
        const key = `${link.utmCampaign}|${link.utmContent}`;
        const existing = campaignContentMap.get(key);
        if (existing) {
          existing.clicks += clickCount;
        } else {
          campaignContentMap.set(key, { campaign: link.utmCampaign, content: link.utmContent, clicks: clickCount });
        }
      }
    });

    const sortAndSlice = (map: Map<string, number>, limit = 10) =>
      Array.from(map.entries())
        .map(([name, clicks]) => ({ name, clicks }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, limit);

    return NextResponse.json(
      {
      summary: {
        totalClicks,
        uniqueVisitors: uniqueVisitors.length,
        clicksChange,
      },
      clicksByDay,
      clicksByHour,
      devices: deviceStats.map((d: { device: string | null; _count: number }) => ({
        name: d.device || "Unknown",
        value: d._count,
      })),
      browsers: browserStats.map((b: { browser: string | null; _count: number }) => ({
        name: b.browser || "Unknown",
        value: b._count,
      })),
      operatingSystems: osStats.map((o: { os: string | null; _count: number }) => ({
        name: o.os || "Unknown",
        value: o._count,
      })),
      referrers: referrerStats.map((r: { referrer: string | null; _count: number }) => ({
        name: r.referrer || "Direct",
        value: r._count,
      })),
      countries: countryStats.map((c: { country: string | null; _count: number }) => ({
        name: c.country || "Unknown",
        value: c._count,
      })),
      topLinks: topLinks.map((l: { id: string; code: string; title: string | null; originalUrl: string; _count: { clicks: number } }) => ({
        id: l.id,
        code: l.code,
        title: l.title,
        originalUrl: l.originalUrl,
        clicks: l._count.clicks,
      })),
      utm: {
        campaigns: sortAndSlice(campaignMap),
        sources: sortAndSlice(sourceMap),
        mediums: sortAndSlice(mediumMap),
        campaignSource: Array.from(campaignSourceMap.values()).sort((a, b) => b.clicks - a.clicks).slice(0, 15),
        campaignContent: Array.from(campaignContentMap.values()).sort((a, b) => b.clicks - a.clicks).slice(0, 15),
      },
    },
      {
        headers: {
          // Browser cache 30s, serve stale up to 60s while revalidating.
          // Analytics data is not real-time — short cache dramatically speeds up
          // repeat views / tab switching. Use max-age (browser) because response
          // is per-user; s-maxage would be ignored with `private`.
          "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("Failed to fetch analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
