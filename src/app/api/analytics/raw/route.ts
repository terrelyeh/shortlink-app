/**
 * GET /api/analytics/raw
 *
 * Returns the last 90 days of raw clicks + all link metadata in one
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

const DAYS_WINDOW = 90;
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

    const since = new Date();
    since.setDate(since.getDate() - DAYS_WINDOW);
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
    const key = cacheKey(
      "analytics-raw-v3",
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
        ...(includeInternal ? {} : { isInternal: false }),
      };

      const [links, clicks, excludedInternal] = await Promise.all([
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
        // Count of clicks we filtered out — surfaced in the UI as
        // "已過濾 N 筆測試點擊" so users know the filter is active.
        // Skip the count when the filter is off (would always be 0).
        includeInternal
          ? Promise.resolve(0)
          : prisma.click.count({
              where: {
                timestamp: { gte: since },
                ...(workspaceId ? { workspaceId } : {}),
                shortLink: { deletedAt: null, ...workspaceWhere },
                isInternal: true,
              },
            }),
      ]);

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
