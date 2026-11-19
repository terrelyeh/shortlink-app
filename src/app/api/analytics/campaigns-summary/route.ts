/**
 * GET /api/analytics/campaigns-summary
 *
 * Feeds the cross-campaign comparison section of the Analytics page.
 * Returns per-campaign aggregates (clicks, conversions, CVR, goal%)
 * plus a list of orphan links — links with no utmCampaign attached —
 * so marketers can spot tracking gaps without paging through /links.
 *
 * Query params:
 *   - days: lookback window (default 30, max 730 = "all time")
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
import { countedClickWhere } from "@/lib/click-quality";
import { resolveWorkspaceScope } from "@/lib/workspace";
import { cached, cacheKey } from "@/lib/cache";
import { classifyTrend, type TrendState } from "@/components/analytics/TrendCell";
import { campaignPhase, hasPeriod, periodTimestampWhere } from "@/lib/campaign-period";

const DEFAULT_DAYS = 30;
// 730 so the "all time" preset covers past exhibition seasons.
const MAX_DAYS = 730;
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

    // Pre-launch testing filter — exclude clicks marked isInternal=true
    // by default. Pass includeInternal=1 to opt back in. Same semantics
    // as /api/analytics/raw.
    const includeInternal = searchParams.get("includeInternal") === "1";

    // v4 suffix: clicks now filtered by isInternal by default. Bump
    // so v3 cached payloads (which mixed test clicks into the totals)
    // don't haunt the leaderboard for up to 60s.
    const key = cacheKey(
      "campaigns-summary-v7",
      session.user.id,
      scope.workspaceId ?? "_",
      days,
      includeInternal ? "with-internal" : "real-only",
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
          status: true,
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

      // Campaign row per name (first link that carries the FK wins) and
      // the link ids that belong to each name — needed up front so the
      // per-campaign period counts can join the Promise.all below.
      const campaignByName = new Map<string, NonNullable<(typeof links)[number]["campaign"]>>();
      const linkIdsByName = new Map<string, string[]>();
      for (const l of links) {
        const name = l.campaign?.name ?? l.utmCampaign;
        if (!name) continue;
        if (l.campaign && !campaignByName.has(name)) campaignByName.set(name, l.campaign);
        const arr = linkIdsByName.get(name) ?? [];
        arr.push(l.id);
        linkIdsByName.set(name, arr);
      }
      const periodNames = [...linkIdsByName.keys()].filter((n) => hasPeriod(campaignByName.get(n)));
      // Windowed click counts + a per-(link, day) breakdown for the
      // overlay chart on /campaigns. Raw SQL because Prisma groupBy
      // can't bucket by day. The breakdown stays small (links × days ≤
      // 90 ≈ a few thousand rows max) so in-memory reshaping is cheap.
      // All click queries below filter out internal/test clicks unless
      // the caller opted in. The shared `clickFilter` keeps the flag
      // consistent across windowClicks, dailyRaw, and lastClicks.
      const clickFilter = countedClickWhere(includeInternal);
      // Raw SQL companion of the same filter — used in the dailyRaw
      // queryRaw below where we can't pass a Prisma where object.
      const rawClickSqlFilter = includeInternal
        ? Prisma.sql``
        : Prisma.sql`AND is_internal = false AND is_suspected_bot = false`;

      // Rolling 7×24h windows for the trend — the same definition the
      // campaign detail page uses, so both pages show the same ±%.
      // (Calendar-day buckets made the list say −70% while the detail
      // page said −14% for the same campaign.)
      const nowMs = Date.now();
      const last7From = new Date(nowMs - 7 * 86_400_000);
      const prev7From = new Date(nowMs - 14 * 86_400_000);

      const [windowClicks, windowConversions, dailyRaw, lastClicks, last7Clicks, prev7Clicks, allTimeClicks, periodCounts] = linkIds.length > 0
        ? await Promise.all([
            prisma.click.groupBy({
              by: ["shortLinkId"],
              where: {
                shortLinkId: { in: linkIds },
                timestamp: { gte: since },
                ...clickFilter,
              },
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
                ${rawClickSqlFilter}
              GROUP BY short_link_id, day
              ORDER BY day
            `),
            // MAX(timestamp) for each link — NOT windowed, because the
            // leaderboard's "last activity" column is supposed to answer
            // "is this campaign still alive?" — a 60-day-old click is
            // the most interesting data point when the window is 30d.
            prisma.click.groupBy({
              by: ["shortLinkId"],
              where: { shortLinkId: { in: linkIds }, ...clickFilter },
              _max: { timestamp: true },
            }),
            prisma.click.groupBy({
              by: ["shortLinkId"],
              where: { shortLinkId: { in: linkIds }, timestamp: { gte: last7From }, ...clickFilter },
              _count: { _all: true },
            }),
            prisma.click.groupBy({
              by: ["shortLinkId"],
              where: { shortLinkId: { in: linkIds }, timestamp: { gte: prev7From, lt: last7From }, ...clickFilter },
              _count: { _all: true },
            }),
            // All-time per link — the "campaign period" figure for
            // campaigns that have no dates set.
            prisma.click.groupBy({
              by: ["shortLinkId"],
              where: { shortLinkId: { in: linkIds }, ...clickFilter },
              _count: { _all: true },
            }),
            // One count per campaign that has dates (a handful at most).
            Promise.all(
              periodNames.map((name) =>
                prisma.click
                  .count({
                    where: {
                      shortLinkId: { in: linkIdsByName.get(name)! },
                      timestamp: periodTimestampWhere(campaignByName.get(name)),
                      ...clickFilter,
                    },
                  })
                  .then((n) => [name, n] as const),
              ),
            ),
          ])
        : [[], [], [], [], [], [], [], []];

      const allTimeMap = new Map(
        (allTimeClicks as { shortLinkId: string; _count: { _all: number } }[]).map((r) => [
          r.shortLinkId,
          r._count._all,
        ]),
      );
      const periodClicksByName = new Map(periodCounts as (readonly [string, number])[]);

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
        // Used to hide ghost rows: a "delete + pause all links" leaves
        // links with the utm_campaign string but no Campaign FK. We
        // don't want those to keep haunting the leaderboard if every
        // remaining link is non-active.
        hasActiveLink: boolean;
        startDate: Date | null;
        endDate: Date | null;
        // Clicks inside the campaign's own period (all time if unset) —
        // independent of the `days` window. Goal progress uses this.
        periodClicks: number;
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
          const cRow = campaignByName.get(campaignName);
          buckets.set(campaignName, {
            id: cRow?.id ?? null,
            name: campaignName,
            displayName: cRow?.displayName ?? null,
            description: cRow?.description ?? null,
            status: cRow?.status ?? null,
            goalClicks: cRow?.goalClicks ?? null,
            defaultSource: cRow?.defaultSource ?? null,
            defaultMedium: cRow?.defaultMedium ?? null,
            startDate: cRow?.startDate ?? null,
            endDate: cRow?.endDate ?? null,
            periodClicks: 0,
            linkCount: 0,
            clicks: 0,
            conversions: 0,
            lastClickAt: null,
            hasActiveLink: false,
          });
        }
        const b = buckets.get(campaignName)!;
        b.linkCount += 1;
        b.clicks += windowClicksMap.get(link.id) ?? 0;
        b.periodClicks += allTimeMap.get(link.id) ?? 0;
        b.conversions += windowConversionsMap.get(link.id) ?? 0;
        if (link.status === "ACTIVE") b.hasActiveLink = true;
        const linkLast = lastClickMap.get(link.id);
        if (linkLast && (!b.lastClickAt || linkLast > b.lastClickAt)) {
          b.lastClickAt = linkLast;
        }
      }

      // Campaigns with dates: replace the all-time sum with the period count.
      for (const [name, n] of periodClicksByName) {
        const b = buckets.get(name);
        if (b) b.periodClicks = n;
      }

      const campaigns = Array.from(buckets.values())
        // Drop "ghost" rows: utm_campaign string survives on links even
        // after the Campaign row is deleted. We keep showing them while
        // any link is still ACTIVE (legitimate orphan that needs
        // cleanup), but a fully-retired bucket (no Campaign + all links
        // paused/archived) should disappear from the leaderboard.
        .filter((b) => b.id !== null || b.hasActiveLink)
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
          startDate: b.startDate?.toISOString() ?? null,
          endDate: b.endDate?.toISOString() ?? null,
          phase: campaignPhase(b),
          periodClicks: b.periodClicks,
          // Goal progress always uses the campaign period (all time when
          // no dates are set) — the same denominator as the campaign page,
          // whatever window the list is showing. Not capped: 130% is
          // information.
          goalPct:
            b.goalClicks && b.goalClicks > 0
              ? (b.periodClicks / b.goalClicks) * 100
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
      const rollingByCampaign = (rows: { shortLinkId: string; _count: { _all: number } }[]) => {
        const m = new Map<string, number>();
        for (const r of rows) {
          const name = linkIdToCampaign.get(r.shortLinkId);
          if (name) m.set(name, (m.get(name) ?? 0) + r._count._all);
        }
        return m;
      };
      const last7ByCampaign = rollingByCampaign(last7Clicks as { shortLinkId: string; _count: { _all: number } }[]);
      const prev7ByCampaign = rollingByCampaign(prev7Clicks as { shortLinkId: string; _count: { _all: number } }[]);

      const campaignsWithTrend = campaigns.map((c) => {
        const series = perCampaign[c.name] ?? [];
        const sparkline = series.slice(-7);
        const last7d = last7ByCampaign.get(c.name) ?? 0;
        const prev7d = prev7ByCampaign.get(c.name) ?? 0;
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
          includeInternal,
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
