import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkspaceId, buildWorkspaceWhere } from "@/lib/workspace";
import { cached, cacheKey } from "@/lib/cache";

interface QueryInput {
  range: string;
  linkId: string | null;
  campaign: string | null;
  tagId: string | null;
  customFrom: string | null;
  customTo: string | null;
}

/**
 * Compute the full analytics payload. Extracted so Redis `cached()` can
 * wrap the whole computation with one key.
 */
async function computeAnalytics(
  session: Session,
  workspaceId: string | null,
  q: QueryInput,
) {
  const { range, linkId, campaign, tagId, customFrom, customTo } = q;

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

  const whereClicks: Record<string, unknown> = {
    timestamp: { gte: startDate, lte: endDate },
  };

  const workspaceWhere = buildWorkspaceWhere(
    workspaceId,
    session.user.id,
    session.user.role,
  );
  const whereLinks: Record<string, unknown> = {
    deletedAt: null,
    ...workspaceWhere,
  };

  if (campaign) {
    whereLinks.utmCampaign = campaign === "__none__" ? null : campaign;
  }

  if (tagId) {
    const taggedLinks = await prisma.tagOnLink.findMany({
      where: { tagId },
      select: { shortLinkId: true },
    });
    whereLinks.id = { in: taggedLinks.map((t) => t.shortLinkId) };
  }

  if (linkId) {
    whereClicks.shortLinkId = linkId;
  } else {
    const userLinks = await prisma.shortLink.findMany({
      where: whereLinks,
      select: { id: true },
    });
    whereClicks.shortLinkId = { in: userLinks.map((l) => l.id) };
  }

  const periodMs = now.getTime() - startDate.getTime();
  const prevStartDate = new Date(startDate.getTime() - periodMs);
  const prevWhereClicks: Record<string, unknown> = {
    ...whereClicks,
    timestamp: { gte: prevStartDate, lt: startDate },
  };

  const shortLinkIds =
    (whereClicks.shortLinkId as { in: string[] } | undefined)?.in ??
    (linkId ? [linkId] : []);

  // One wave of parallel DB calls
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
    prisma.click.groupBy({ by: ["ipHash"], where: whereClicks }),
    prisma.click.groupBy({ by: ["device"], where: whereClicks, _count: true }),
    prisma.click.groupBy({ by: ["browser"], where: whereClicks, _count: true }),
    prisma.click.groupBy({ by: ["os"], where: whereClicks, _count: true }),
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

  let clicksChange = 0;
  if (prevTotalClicks > 0) {
    clicksChange = Math.round(((totalClicks - prevTotalClicks) / prevTotalClicks) * 100);
  } else if (totalClicks > 0) {
    clicksChange = 100;
  }

  const clicksByDay = clicksByDayRaw.map((row) => ({
    date:
      typeof row.date === "string"
        ? row.date
        : new Date(row.date).toISOString().split("T")[0],
    clicks: Number(row.count),
  }));

  const clicksByHourMap = new Map<number, number>();
  for (let h = 0; h < 24; h++) clicksByHourMap.set(h, 0);
  clicksByHourRaw.forEach((row) => {
    clicksByHourMap.set(row.hour, Number(row.count));
  });
  const clicksByHour = Array.from(clicksByHourMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([hour, clicks]) => ({ hour, clicks }));

  // UTM aggregation
  const campaignMap = new Map<string, number>();
  const sourceMap = new Map<string, number>();
  const mediumMap = new Map<string, number>();
  const campaignSourceMap = new Map<
    string,
    { campaign: string; source: string; clicks: number }
  >();
  const campaignContentMap = new Map<
    string,
    { campaign: string; content: string; clicks: number }
  >();

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
      const k = `${link.utmCampaign}|${link.utmSource}`;
      const existing = campaignSourceMap.get(k);
      if (existing) existing.clicks += clickCount;
      else campaignSourceMap.set(k, { campaign: link.utmCampaign, source: link.utmSource, clicks: clickCount });
    }
    if (link.utmCampaign && link.utmContent) {
      const k = `${link.utmCampaign}|${link.utmContent}`;
      const existing = campaignContentMap.get(k);
      if (existing) existing.clicks += clickCount;
      else campaignContentMap.set(k, { campaign: link.utmCampaign, content: link.utmContent, clicks: clickCount });
    }
  });

  const sortAndSlice = (map: Map<string, number>, limit = 10) =>
    Array.from(map.entries())
      .map(([name, clicks]) => ({ name, clicks }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, limit);

  return {
    summary: {
      totalClicks,
      uniqueVisitors: uniqueVisitors.length,
      clicksChange,
    },
    clicksByDay,
    clicksByHour,
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
    utm: {
      campaigns: sortAndSlice(campaignMap),
      sources: sortAndSlice(sourceMap),
      mediums: sortAndSlice(mediumMap),
      campaignSource: Array.from(campaignSourceMap.values())
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 15),
      campaignContent: Array.from(campaignContentMap.values())
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 15),
    },
  };
}

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

    const workspaceId = getWorkspaceId(request);

    // Two layers of cache in front of the DB:
    // 1. Redis (60s TTL) — shared across all instances, survives user refresh
    // 2. Browser (max-age=30) — zero network, instant back/tab-switch
    const key = cacheKey(
      "analytics",
      session.user.id,
      workspaceId ?? "_",
      range,
      linkId ?? "_",
      campaign ?? "_",
      tagId ?? "_",
      customFrom ?? "_",
      customTo ?? "_",
    );

    const payload = await cached(key, 60, () =>
      computeAnalytics(session, workspaceId, {
        range,
        linkId,
        campaign,
        tagId,
        customFrom,
        customTo,
      }),
    );

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("Failed to fetch analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 },
    );
  }
}
