/**
 * GET /api/analytics/campaigns-summary
 *
 * Feeds the cross-campaign comparison section of the Analytics page.
 * Returns per-campaign aggregates (clicks, conversions, CVR, goal%)
 * plus a list of orphan links — links with no utmCampaign attached —
 * so marketers can spot tracking gaps without paging through /links.
 *
 * Query params:
 *   - days: lookback window (default 30, max 90)
 *
 * Design notes:
 *   - Redis-cached 60s — campaign leaderboards don't need second-by-second
 *     freshness and the SQL aggregations below are the heaviest single
 *     query the app makes.
 *   - Campaigns are keyed by the Campaign entity's `name` (which equals
 *     the utm_campaign string). Links belonging to a campaign via the
 *     ShortLink.campaignId FK *or* bare utm_campaign value both count,
 *     so manually-entered campaigns still show up.
 *   - Orphan links = ShortLink rows where utmCampaign IS NULL AND
 *     campaignId IS NULL. Capped at 20 by clicks to keep payload tight.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { resolveWorkspaceScope } from "@/lib/workspace";
import { cached, cacheKey } from "@/lib/cache";
import { classifyTrend, type TrendState } from "@/components/analytics/TrendCell";

const DEFAULT_DAYS = 30;
const MAX_DAYS = 90;
const ORPHAN_LIMIT = 20;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const scope = await resolveWorkspaceScope(request, session);
    if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const rawDays = parseInt(searchParams.get("days") || String(DEFAULT_DAYS), 10);
    const days = Math.min(Math.max(Number.isFinite(rawDays) ? rawDays : DEFAULT_DAYS, 1), MAX_DAYS);

    // v2 suffix: payload shape gained sparkline / trendState / trendPct /
    // lastClickAt fields on each campaign and orphan. Bumping the key
    // invalidates any stale v1 payloads still cached in Redis — without
    // it the client crashes trying to .some() on an undefined sparkline.
    const key = cacheKey(
      "campaigns-summary-v2",
      session.user.id,
      scope.workspaceId ?? "_",
      days,
    );

    const payload = await cached(key, 60, async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const workspaceFilter = scope.where;

      // Load all links in scope. We rely on the summary aggregating
      // in-memory rather than a groupBy because we need to join by both
      // campaignId *and* utmCampaign, and the result set is bounded by
      // link count (realistic: < 1000 per workspace).
      const links = await prisma.shortLink.findMany({
        where: {
          deletedAt: null,
          ...workspaceFilter,
        },
        select: {
          id: true,
          code: true,
          title: true,
          originalUrl: true,
          utmCampaign: true,
          campaignId: true,
          campaign: {
            select: {
              id: true,
              name: true,
              displayName: true,
              description: true,
              status: true,
              goalClicks: true,
              defaultSource: true,
              defaultMedium: true,
              startDate: true,
              endDate: true,
            },
          },
          clickCount: true,
          _count: { select: { conversions: true } },
        },
      });

      const linkIds = links.map((l) => l.id);
      // Windowed click counts + a per-(link, day) breakdown for the
      // overlay chart on /campaigns. Raw SQL because Prisma groupBy
      // can't bucket by day. The breakdown stays small (links × days ≤
      // 90 ≈ a few thousand rows max) so in-memory reshaping is cheap.
      const [windowClicks, windowConversions, dailyRaw, lastClicks] = linkIds.length > 0
        ? await Promise.all([
            prisma.click.groupBy({
              by: ["shortLinkId"],
              where: { shortLinkId: { in: linkIds }, timestamp: { gte: since } },
              _count: { _all: true },
            }),
            prisma.conversion.groupBy({
              by: ["shortLinkId"],
              where: { shortLinkId: { in: linkIds }, timestamp: { gte: since } },
              _count: { _all: true },
            }),
            prisma.$queryRaw<
              { short_link_id: string; day: Date; clicks: bigint }[]
            >(Prisma.sql`
              SELECT short_link_id,
                     date_trunc('day', timestamp) AS day,
                     COUNT(*)::bigint AS clicks
              FROM clicks
              WHERE short_link_id IN (${Prisma.join(linkIds)})
                AND timestamp >= ${since}
              GROUP BY short_link_id, day
              ORDER BY day
            `),
            // MAX(timestamp) for each link — NOT windowed, because the
            // leaderboard's "last activity" column is supposed to answer
            // "is this campaign still alive?" — a 60-day-old click is
            // the most interesting data point when the window is 30d.
            prisma.click.groupBy({
              by: ["shortLinkId"],
              where: { shortLinkId: { in: linkIds } },
              _max: { timestamp: true },
            }),
          ])
        : [[], [], [], []];

      const windowClicksMap = new Map(
        (windowClicks as { shortLinkId: string; _count: { _all: number } }[]).map((r) => [
          r.shortLinkId,
          r._count._all,
        ]),
      );
      const windowConversionsMap = new Map(
        (windowConversions as { shortLinkId: string; _count: { _all: number } }[]).map((r) => [
          r.shortLinkId,
          r._count._all,
        ]),
      );
      const lastClickMap = new Map(
        (lastClicks as { shortLinkId: string; _max: { timestamp: Date | null } }[]).map((r) => [
          r.shortLinkId,
          r._max.timestamp?.toISOString() ?? null,
        ]),
      );

      // Bucket by campaign name. Links with neither campaignId nor
      // utmCampaign fall into the orphan bucket instead.
      interface Bucket {
        id: string | null;
        name: string;
        displayName: string | null;
        description: string | null;
        status: string | null;
        goalClicks: number | null;
        defaultSource: string | null;
        defaultMedium: string | null;
        linkCount: number;
        clicks: number;
        conversions: number;
        // Max-of-max across this campaign's links — used for the "Last
        // activity" column. Null when no link has ever been clicked.
        lastClickAt: string | null;
      }
      const buckets = new Map<string, Bucket>();
      const orphanLinks: typeof links = [];

      for (const link of links) {
        const campaignName = link.campaign?.name ?? link.utmCampaign;
        if (!campaignName) {
          orphanLinks.push(link);
          continue;
        }
        if (!buckets.has(campaignName)) {
          buckets.set(campaignName, {
            id: link.campaign?.id ?? null,
            name: campaignName,
            displayName: link.campaign?.displayName ?? null,
            description: link.campaign?.description ?? null,
            status: link.campaign?.status ?? null,
            goalClicks: link.campaign?.goalClicks ?? null,
            defaultSource: link.campaign?.defaultSource ?? null,
            defaultMedium: link.campaign?.defaultMedium ?? null,
            linkCount: 0,
            clicks: 0,
            conversions: 0,
            lastClickAt: null,
          });
        }
        const b = buckets.get(campaignName)!;
        b.linkCount += 1;
        b.clicks += windowClicksMap.get(link.id) ?? 0;
        b.conversions += windowConversionsMap.get(link.id) ?? 0;
        const linkLast = lastClickMap.get(link.id);
        if (linkLast && (!b.lastClickAt || linkLast > b.lastClickAt)) {
          b.lastClickAt = linkLast;
        }
      }

      const campaigns = Array.from(buckets.values())
        .map((b) => ({
          id: b.id,
          name: b.name,
          displayName: b.displayName,
          description: b.description,
          status: b.status,
          defaultSource: b.defaultSource,
          defaultMedium: b.defaultMedium,
          linkCount: b.linkCount,
          clicks: b.clicks,
          conversions: b.conversions,
          cvr: b.clicks > 0 ? (b.conversions / b.clicks) * 100 : 0,
          goalClicks: b.goalClicks,
          // Goal progress uses all-time clickCount-like totals in the
          // window, not the goal's lifetime clicks. Marketers asked
          // "how close are we in this period?" rather than "since
          // forever?" — the latter is visible on the detail page.
          goalPct:
            b.goalClicks && b.goalClicks > 0
              ? Math.min((b.clicks / b.goalClicks) * 100, 100)
              : null,
          lastClickAt: b.lastClickAt,
        }))
        .sort((a, b) => b.clicks - a.clicks);

      // Orphans — show top-N by windowed clicks so the list surfaces
      // meaningful links, not dead / never-clicked ones.
      const orphans = orphanLinks
        .map((l) => ({
          id: l.id,
          code: l.code,
          title: l.title,
          originalUrl: l.originalUrl,
          clicks: windowClicksMap.get(l.id) ?? 0,
          conversions: windowConversionsMap.get(l.id) ?? 0,
          lastClickAt: lastClickMap.get(l.id) ?? null,
        }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, ORPHAN_LIMIT);

      // Build the time-series payload: for each campaign, an array of
      // daily click counts aligned to the same date axis. Empty days
      // are zero-filled so the chart draws continuous lines. Orphan
      // link traffic is excluded — the overlay is about campaigns.
      const linkIdToCampaign = new Map<string, string>();
      for (const l of links) {
        const name = l.campaign?.name ?? l.utmCampaign;
        if (name) linkIdToCampaign.set(l.id, name);
      }

      const dateAxis: string[] = [];
      const cursor = new Date(since);
      cursor.setUTCHours(0, 0, 0, 0);
      const endDay = new Date();
      endDay.setUTCHours(0, 0, 0, 0);
      while (cursor <= endDay) {
        dateAxis.push(cursor.toISOString().slice(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      const dayIndex = new Map(dateAxis.map((d, i) => [d, i]));

      const perCampaign: Record<string, number[]> = {};
      for (const campaignName of buckets.keys()) {
        perCampaign[campaignName] = new Array(dateAxis.length).fill(0);
      }
      for (const row of dailyRaw as { short_link_id: string; day: Date; clicks: bigint }[]) {
        const campaignName = linkIdToCampaign.get(row.short_link_id);
        if (!campaignName) continue;
        const dateKey = new Date(row.day).toISOString().slice(0, 10);
        const idx = dayIndex.get(dateKey);
        if (idx === undefined) continue;
        perCampaign[campaignName][idx] += Number(row.clicks);
      }

      // Derive per-campaign 7d sparkline + trend from the same
      // time-series data. Sparkline is the last 7 days of daily clicks;
      // trend compares last7d vs prev7d. If the requested window is
      // shorter than 14 days we don't have a prev-7d tail — trendState
      // falls back to "new" / "none" accordingly via classifyTrend.
      const campaignsWithTrend = campaigns.map((c) => {
        const series = perCampaign[c.name] ?? [];
        const sparkline = series.slice(-7);
        const last7d = sparkline.reduce((s, v) => s + v, 0);
        const prev7d =
          series.length >= 14
            ? series.slice(-14, -7).reduce((s, v) => s + v, 0)
            : 0;
        const { trendState, trendPct } = classifyTrend(last7d, prev7d);
        return {
          ...c,
          sparkline,
          trendState: trendState as TrendState,
          trendPct,
        };
      });

      return {
        campaigns: campaignsWithTrend,
        orphans,
        timeseries: { dates: dateAxis, perCampaign },
        meta: {
          days,
          totalCampaigns: campaignsWithTrend.length,
          totalOrphans: orphanLinks.length,
          since: since.toISOString(),
        },
      };
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("Failed to fetch campaigns summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaigns summary" },
      { status: 500 },
    );
  }
}
