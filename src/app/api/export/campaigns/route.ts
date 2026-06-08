/**
 * GET /api/export/campaigns
 *
 * Campaign-level CSV exports for analysis in Excel / Sheets / BI tools.
 * Three formats via ?format=:
 *
 *   summary     (default) — one row per campaign: windowed clicks, 7d
 *                 trend, goal progress, last activity. Cross-campaign
 *                 comparison table.
 *   timeseries  — long format, one row per (date, campaign, clicks).
 *                 Pivot-table / chart friendly.
 *   links       — one row per link within ?campaign=NAME: per-link
 *                 clicks, unique visitors, last click. Drill-down.
 *
 * Common query params:
 *   days            lookback window for summary / timeseries (default 30, max 90)
 *   includeInternal "1" to include test clicks (default: excluded, matching the UI)
 *   campaign        required for format=links
 *
 * Notes:
 *   - Not cached — exports should be fresh and aren't a hot path.
 *   - Campaign bucketing mirrors the leaderboard: a link belongs to a
 *     campaign via campaignId FK OR bare utmCampaign string. No ghost-row
 *     filtering here — exports favor completeness; filter in the sheet.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { resolveWorkspaceScope } from "@/lib/workspace";
import { buildCsv, csvResponse } from "@/lib/utils/csv";

const DEFAULT_DAYS = 30;
const MAX_DAYS = 90;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const scope = await resolveWorkspaceScope(request, session);
    if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "summary";
    const includeInternal = searchParams.get("includeInternal") === "1";
    const rawDays = parseInt(searchParams.get("days") || String(DEFAULT_DAYS), 10);
    const days = Math.min(
      Math.max(Number.isFinite(rawDays) ? rawDays : DEFAULT_DAYS, 1),
      MAX_DAYS,
    );

    // Click filter shared across all formats. Default excludes test
    // clicks (isInternal) so exported numbers match what's on screen.
    const internalFilter = includeInternal ? {} : { isInternal: false };
    const rawInternalSql = includeInternal
      ? Prisma.sql``
      : Prisma.sql`AND is_internal = false`;
    const today = new Date().toISOString().split("T")[0];

    if (format === "links") {
      const campaignName = searchParams.get("campaign");
      if (!campaignName) {
        return NextResponse.json({ error: "campaign param required" }, { status: 400 });
      }
      return await exportLinks(scope, campaignName, rawInternalSql, today);
    }

    if (format === "link-daily") {
      const campaignName = searchParams.get("campaign");
      if (!campaignName) {
        return NextResponse.json({ error: "campaign param required" }, { status: 400 });
      }
      return await exportLinkDaily(scope, campaignName, days, rawInternalSql, today);
    }

    if (format === "timeseries") {
      return await exportTimeseries(scope, days, rawInternalSql, today);
    }

    // default: summary
    return await exportSummary(scope, days, internalFilter, today);
  } catch (error) {
    console.error("Failed to export campaigns:", error);
    return NextResponse.json({ error: "Failed to export" }, { status: 500 });
  }
}

// ---- A: cross-campaign comparison ----
async function exportSummary(
  scope: { where: Record<string, unknown> },
  days: number,
  internalFilter: Record<string, unknown>,
  today: string,
) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const links = await prisma.shortLink.findMany({
    where: { deletedAt: null, ...scope.where },
    select: {
      id: true,
      status: true,
      utmCampaign: true,
      campaign: {
        select: { name: true, displayName: true, status: true, goalClicks: true },
      },
    },
  });
  const linkIds = links.map((l) => l.id);

  const [windowClicks, last7d, prev7d, lastClicks] = linkIds.length
    ? await Promise.all([
        prisma.click.groupBy({
          by: ["shortLinkId"],
          where: { shortLinkId: { in: linkIds }, timestamp: { gte: since }, ...internalFilter },
          _count: { _all: true },
        }),
        prisma.click.groupBy({
          by: ["shortLinkId"],
          where: { shortLinkId: { in: linkIds }, timestamp: { gte: sevenDaysAgo }, ...internalFilter },
          _count: { _all: true },
        }),
        prisma.click.groupBy({
          by: ["shortLinkId"],
          where: {
            shortLinkId: { in: linkIds },
            timestamp: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
            ...internalFilter,
          },
          _count: { _all: true },
        }),
        prisma.click.groupBy({
          by: ["shortLinkId"],
          where: { shortLinkId: { in: linkIds }, ...internalFilter },
          _max: { timestamp: true },
        }),
      ])
    : [[], [], [], []];

  const map = (rows: { shortLinkId: string; _count: { _all: number } }[]) =>
    new Map(rows.map((r) => [r.shortLinkId, r._count._all]));
  const windowMap = map(windowClicks as never);
  const last7dMap = map(last7d as never);
  const prev7dMap = map(prev7d as never);
  const lastClickMap = new Map(
    (lastClicks as { shortLinkId: string; _max: { timestamp: Date | null } }[]).map((r) => [
      r.shortLinkId,
      r._max.timestamp?.toISOString() ?? null,
    ]),
  );

  interface Bucket {
    name: string;
    displayName: string | null;
    status: string | null;
    goalClicks: number | null;
    linkCount: number;
    clicks: number;
    last7d: number;
    prev7d: number;
    lastClickAt: string | null;
  }
  const buckets = new Map<string, Bucket>();
  for (const link of links) {
    const name = link.campaign?.name ?? link.utmCampaign;
    if (!name) continue; // orphan links excluded from campaign export
    let b = buckets.get(name);
    if (!b) {
      b = {
        name,
        displayName: link.campaign?.displayName ?? null,
        status: link.campaign?.status ?? null,
        goalClicks: link.campaign?.goalClicks ?? null,
        linkCount: 0,
        clicks: 0,
        last7d: 0,
        prev7d: 0,
        lastClickAt: null,
      };
      buckets.set(name, b);
    }
    b.linkCount += 1;
    b.clicks += windowMap.get(link.id) ?? 0;
    b.last7d += last7dMap.get(link.id) ?? 0;
    b.prev7d += prev7dMap.get(link.id) ?? 0;
    const last = lastClickMap.get(link.id);
    if (last && (!b.lastClickAt || last > b.lastClickAt)) b.lastClickAt = last;
  }

  const headers = [
    "Campaign",
    "Display Name",
    "Status",
    "Links",
    `Clicks (${days}d)`,
    "Last 7d",
    "Prev 7d",
    "Trend %",
    "Goal Clicks",
    "Goal %",
    "Last Activity",
  ];
  const rows = Array.from(buckets.values())
    .sort((a, b) => b.clicks - a.clicks)
    .map((b) => {
      const trendPct =
        b.prev7d > 0 ? Math.round(((b.last7d - b.prev7d) / b.prev7d) * 100) : "";
      const goalPct =
        b.goalClicks && b.goalClicks > 0
          ? Math.min(Math.round((b.clicks / b.goalClicks) * 100), 100)
          : "";
      return [
        b.name,
        b.displayName ?? "",
        b.status ?? "",
        b.linkCount,
        b.clicks,
        b.last7d,
        b.prev7d,
        trendPct,
        b.goalClicks ?? "",
        goalPct === "" ? "" : `${goalPct}`,
        b.lastClickAt ?? "",
      ];
    });

  return csvResponse(buildCsv(headers, rows), `campaigns-summary-${today}.csv`);
}

// ---- C: date × campaign long format ----
async function exportTimeseries(
  scope: { where: Record<string, unknown> },
  days: number,
  rawInternalSql: Prisma.Sql,
  today: string,
) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const links = await prisma.shortLink.findMany({
    where: { deletedAt: null, ...scope.where },
    select: { id: true, utmCampaign: true, campaign: { select: { name: true } } },
  });
  const linkIds = links.map((l) => l.id);
  const linkToCampaign = new Map<string, string>();
  for (const l of links) {
    const name = l.campaign?.name ?? l.utmCampaign;
    if (name) linkToCampaign.set(l.id, name);
  }

  const dailyRaw = linkIds.length
    ? await prisma.$queryRaw<{ short_link_id: string; day: Date; clicks: bigint }[]>(Prisma.sql`
        SELECT short_link_id,
               date_trunc('day', timestamp) AS day,
               COUNT(*)::bigint AS clicks
        FROM clicks
        WHERE short_link_id IN (${Prisma.join(linkIds)})
          AND timestamp >= ${since}
          ${rawInternalSql}
        GROUP BY short_link_id, day
      `)
    : [];

  // Aggregate by (campaign, date)
  const cellKey = (campaign: string, date: string) => `${campaign} ${date}`;
  const cells = new Map<string, number>();
  const campaignsSeen = new Set<string>();
  for (const row of dailyRaw) {
    const campaign = linkToCampaign.get(row.short_link_id);
    if (!campaign) continue;
    campaignsSeen.add(campaign);
    const date = new Date(row.day).toISOString().slice(0, 10);
    cells.set(cellKey(campaign, date), (cells.get(cellKey(campaign, date)) ?? 0) + Number(row.clicks));
  }

  // Build a rectangular long table: every (date in axis) × (campaign
  // that had any click in window), zero-filled. Predictable for pivots.
  const dateAxis: string[] = [];
  const cursor = new Date(since);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  while (cursor <= end) {
    dateAxis.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const campaigns = Array.from(campaignsSeen).sort();

  const headers = ["Date", "Campaign", "Clicks"];
  const rows: (string | number)[][] = [];
  for (const date of dateAxis) {
    for (const campaign of campaigns) {
      rows.push([date, campaign, cells.get(cellKey(campaign, date)) ?? 0]);
    }
  }

  return csvResponse(buildCsv(headers, rows), `campaigns-daily-${today}.csv`);
}

// ---- B: single-campaign link breakdown ----
async function exportLinks(
  scope: { where: Record<string, unknown>; workspaceId: string | null },
  campaignName: string,
  rawInternalSql: Prisma.Sql,
  today: string,
) {
  const campaign = await prisma.campaign.findFirst({
    where: {
      name: campaignName,
      ...(scope.workspaceId ? { workspaceId: scope.workspaceId } : {}),
    },
    select: { id: true },
  });

  const links = await prisma.shortLink.findMany({
    where: {
      deletedAt: null,
      ...scope.where,
      OR: [
        { utmCampaign: campaignName },
        ...(campaign?.id ? [{ campaignId: campaign.id }] : []),
      ],
    },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      utmSource: true,
      utmMedium: true,
      utmContent: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  const linkIds = links.map((l) => l.id);

  const stats = linkIds.length
    ? await prisma.$queryRaw<
        { short_link_id: string; clicks: bigint; uniques: bigint; last_click: Date | null }[]
      >(Prisma.sql`
        SELECT short_link_id,
               COUNT(*)::bigint AS clicks,
               COUNT(DISTINCT ip_hash)::bigint AS uniques,
               MAX(timestamp) AS last_click
        FROM clicks
        WHERE short_link_id IN (${Prisma.join(linkIds)})
          ${rawInternalSql}
        GROUP BY short_link_id
      `)
    : [];
  const statMap = new Map(stats.map((s) => [s.short_link_id, s]));

  const shortBaseUrl = process.env.NEXT_PUBLIC_SHORT_URL || "http://localhost:3000/s";

  const headers = [
    "Short URL",
    "Title",
    "Source",
    "Medium",
    "Content",
    "Clicks",
    "Unique Visitors",
    "Last Click",
    "Status",
    "Created At",
  ];
  const rows = links
    .map((l) => {
      const s = statMap.get(l.id);
      return {
        l,
        clicks: s ? Number(s.clicks) : 0,
        uniques: s ? Number(s.uniques) : 0,
        lastClick: s?.last_click ? new Date(s.last_click).toISOString() : "",
      };
    })
    .sort((a, b) => b.clicks - a.clicks)
    .map(({ l, clicks, uniques, lastClick }) => [
      `${shortBaseUrl}/${l.code}`,
      l.title ?? "",
      l.utmSource ?? "",
      l.utmMedium ?? "",
      l.utmContent ?? "",
      clicks,
      uniques,
      lastClick,
      l.status,
      l.createdAt.toISOString(),
    ]);

  // Filename-safe campaign slug
  const slug = campaignName.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 40);
  return csvResponse(buildCsv(headers, rows), `campaign-${slug}-links-${today}.csv`);
}

// ---- B-daily: single-campaign per-link daily long format ----
// date × link long table — the single-campaign analog of the list
// page's date × campaign timeseries. Lets analysts pivot one campaign
// by day AND by channel (which link drove which day).
async function exportLinkDaily(
  scope: { where: Record<string, unknown>; workspaceId: string | null },
  campaignName: string,
  days: number,
  rawInternalSql: Prisma.Sql,
  today: string,
) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const campaign = await prisma.campaign.findFirst({
    where: {
      name: campaignName,
      ...(scope.workspaceId ? { workspaceId: scope.workspaceId } : {}),
    },
    select: { id: true },
  });

  const links = await prisma.shortLink.findMany({
    where: {
      deletedAt: null,
      ...scope.where,
      OR: [
        { utmCampaign: campaignName },
        ...(campaign?.id ? [{ campaignId: campaign.id }] : []),
      ],
    },
    select: {
      id: true,
      code: true,
      title: true,
      utmSource: true,
      utmMedium: true,
      utmContent: true,
    },
    orderBy: { createdAt: "asc" },
  });
  const linkIds = links.map((l) => l.id);

  const dailyRaw = linkIds.length
    ? await prisma.$queryRaw<{ short_link_id: string; day: Date; clicks: bigint }[]>(Prisma.sql`
        SELECT short_link_id,
               date_trunc('day', timestamp) AS day,
               COUNT(*)::bigint AS clicks
        FROM clicks
        WHERE short_link_id IN (${Prisma.join(linkIds)})
          AND timestamp >= ${since}
          ${rawInternalSql}
        GROUP BY short_link_id, day
      `)
    : [];

  const cellKey = (linkId: string, date: string) => `${linkId} ${date}`;
  const cells = new Map<string, number>();
  for (const row of dailyRaw) {
    const date = new Date(row.day).toISOString().slice(0, 10);
    cells.set(
      cellKey(row.short_link_id, date),
      (cells.get(cellKey(row.short_link_id, date)) ?? 0) + Number(row.clicks),
    );
  }

  const dateAxis: string[] = [];
  const cursor = new Date(since);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  while (cursor <= end) {
    dateAxis.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const shortBaseUrl = process.env.NEXT_PUBLIC_SHORT_URL || "http://localhost:3000/s";

  const headers = ["Date", "Short URL", "Title", "Source", "Medium", "Content", "Clicks"];
  const rows: (string | number)[][] = [];
  for (const date of dateAxis) {
    for (const l of links) {
      rows.push([
        date,
        `${shortBaseUrl}/${l.code}`,
        l.title ?? "",
        l.utmSource ?? "",
        l.utmMedium ?? "",
        l.utmContent ?? "",
        cells.get(cellKey(l.id, date)) ?? 0,
      ]);
    }
  }

  const slug = campaignName.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 40);
  return csvResponse(buildCsv(headers, rows), `campaign-${slug}-daily-${today}.csv`);
}
