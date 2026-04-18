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
import { resolveWorkspaceScope } from "@/lib/workspace";
import { cached, cacheKey } from "@/lib/cache";

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

    const key = cacheKey(
      "campaigns-summary",
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
              name: true,
              displayName: true,
              status: true,
              goalClicks: true,
              startDate: true,
              endDate: true,
            },
          },
          clickCount: true,
          _count: { select: { conversions: true } },
        },
      });

      const linkIds = links.map((l) => l.id);
      // Windowed click counts — faster & more accurate than using the
      // all-time clickCount when the marketer asked for a 7/30/90d view.
      const [windowClicks, windowConversions] = linkIds.length > 0
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
          ])
        : [[], []];

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

      // Bucket by campaign name. Links with neither campaignId nor
      // utmCampaign fall into the orphan bucket instead.
      interface Bucket {
        name: string;
        displayName: string | null;
        status: string | null;
        goalClicks: number | null;
        linkCount: number;
        clicks: number;
        conversions: number;
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
            name: campaignName,
            displayName: link.campaign?.displayName ?? null,
            status: link.campaign?.status ?? null,
            goalClicks: link.campaign?.goalClicks ?? null,
            linkCount: 0,
            clicks: 0,
            conversions: 0,
          });
        }
        const b = buckets.get(campaignName)!;
        b.linkCount += 1;
        b.clicks += windowClicksMap.get(link.id) ?? 0;
        b.conversions += windowConversionsMap.get(link.id) ?? 0;
      }

      const campaigns = Array.from(buckets.values())
        .map((b) => ({
          name: b.name,
          displayName: b.displayName,
          status: b.status,
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
        }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, ORPHAN_LIMIT);

      return {
        campaigns,
        orphans,
        meta: {
          days,
          totalCampaigns: campaigns.length,
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
