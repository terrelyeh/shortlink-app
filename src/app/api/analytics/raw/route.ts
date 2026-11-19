/**
 * GET /api/analytics/raw
 *
 * Returns the last ~2 years of raw clicks + all link metadata in one
 * response. The client uses this to render Analytics entirely in the
 * browser — filter switches become pure useMemo with zero network.
 *
 * Caps at CLICK_CAP to keep payload size sane. When truncated we return
 * only the MOST RECENT CLICK_CAP clicks and set meta.truncated=true so
 * the client can show a banner.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceScope } from "@/lib/workspace";
import { cached, cacheKey } from "@/lib/cache";
import { countedClickWhere } from "@/lib/click-quality";

// Two years, not 90 days: this is a seasonal tool — exhibition campaigns
// (Computex in June) get reviewed months later, and a 90-day window made
// those campaigns read 0 while /links showed hundreds of clicks. Total
// volume is small (~4k clicks all-time), so CLICK_CAP still bounds it.
const DAYS_WINDOW = 730;
const CLICK_CAP = 10_000;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const scope = await resolveWorkspaceScope(request, session);
    if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { workspaceId, where: workspaceWhere } = scope;

    // Floor to UTC midnight so the Redis key below is stable for a whole
    // day (a millisecond timestamp in the key meant it never hit).
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - DAYS_WINDOW);
    since.setUTCHours(0, 0, 0, 0);
    const sinceIso = since.toISOString();

    // Pre-launch testing filter — by default we exclude clicks that the
    // redirect handler flagged as isInternal (URL had ?_test=1, or an
    // authenticated workspace member triggered the click). Pass
    // includeInternal=1 to opt back in.
    const { searchParams } = new URL(request.url);
    const includeInternal = searchParams.get("includeInternal") === "1";

    // Redis-cache the whole raw payload. This is the heaviest call in the
    // app (can return 1-2 MB) and the result is identical for every view of
    // the Analytics page within 60s. Massive hit-rate.
    // v3: payload now reports excludedInternal counts + filters
    // isInternal=true by default. Bump key so old v2 doesn't serve
    // stale data with test clicks mixed in.
    // v4: window 90 → 730 days.
    // v5: excludes suspected scanner clicks; meta adds excludedBot + per-link counts.
    const key = cacheKey(
      "analytics-raw-v5",
      session.user.id,
      workspaceId ?? "_",
      sinceIso,
      includeInternal ? "with-internal" : "real-only",
    );

    const payload = await cached(key, 60, async () => {
      const clickWhere = {
        timestamp: { gte: since },
        ...(workspaceId ? { workspaceId } : {}),
        shortLink: { deletedAt: null, ...workspaceWhere },
        ...countedClickWhere(includeInternal),
      };

      const excludedBase = {
        timestamp: { gte: since },
        ...(workspaceId ? { workspaceId } : {}),
        shortLink: { deletedAt: null, ...workspaceWhere },
      };
      const [links, clicks, internalByLink, botByLink] = await Promise.all([
        prisma.shortLink.findMany({
          where: { deletedAt: null, ...workspaceWhere },
          select: {
            id: true,
            code: true,
            title: true,
            originalUrl: true,
            utmCampaign: true,
            utmSource: true,
            utmMedium: true,
            utmContent: true,
            tags: { select: { tagId: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.click.findMany({
          where: clickWhere,
          select: {
            shortLinkId: true,
            timestamp: true,
            device: true,
            browser: true,
            os: true,
            country: true,
            city: true,
            ipHash: true,
            referrer: true,
          },
          orderBy: { timestamp: "desc" },
          take: CLICK_CAP + 1, // +1 so we can tell if we hit the cap
        }),
        // Clicks we filtered out, per link — surfaced as 「已過濾 N 筆…」.
        // Per link (not one workspace total) so a campaign page can show
        // only its own count. Skipped when the filter is off.
        includeInternal
          ? Promise.resolve([] as { shortLinkId: string; _count: { _all: number } }[])
          : prisma.click.groupBy({
              by: ["shortLinkId"],
              where: { ...excludedBase, isInternal: true },
              _count: { _all: true },
            }),
        includeInternal
          ? Promise.resolve([] as { shortLinkId: string; _count: { _all: number } }[])
          : prisma.click.groupBy({
              by: ["shortLinkId"],
              where: { ...excludedBase, isInternal: false, isSuspectedBot: true },
              _count: { _all: true },
            }),
      ]);

      const excludedByLink: Record<string, { internal: number; bot: number }> = {};
      for (const r of internalByLink) (excludedByLink[r.shortLinkId] ??= { internal: 0, bot: 0 }).internal = r._count._all;
      for (const r of botByLink) (excludedByLink[r.shortLinkId] ??= { internal: 0, bot: 0 }).bot = r._count._all;
      const excludedInternal = internalByLink.reduce((n, r) => n + r._count._all, 0);
      const excludedBot = botByLink.reduce((n, r) => n + r._count._all, 0);

      const truncated = clicks.length > CLICK_CAP;
      const trimmed = truncated ? clicks.slice(0, CLICK_CAP) : clicks;

      return {
        clicks: trimmed.map((c) => ({
          shortLinkId: c.shortLinkId,
          timestamp: c.timestamp.toISOString(),
          device: c.device,
          browser: c.browser,
          os: c.os,
          country: c.country,
          city: c.city,
          ipHash: c.ipHash,
          referrer: c.referrer,
        })),
        links: links.map((l) => ({
          id: l.id,
          code: l.code,
          title: l.title,
          originalUrl: l.originalUrl,
          utmCampaign: l.utmCampaign,
          utmSource: l.utmSource,
          utmMedium: l.utmMedium,
          utmContent: l.utmContent,
          tagIds: l.tags.map((t) => t.tagId),
        })),
        meta: {
          totalClicks: trimmed.length,
          truncated,
          since: sinceIso,
          includeInternal,
          excludedInternal,
          excludedBot,
          excludedByLink,
        },
      };
    });

    return NextResponse.json(payload, {
      headers: {
        // Browser cache 30s on top of the 60s Redis cache
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("Failed to fetch raw analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch raw analytics" },
      { status: 500 },
    );
  }
}
