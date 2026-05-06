import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createHash, randomBytes } from "crypto";
import { headers } from "next/headers";
import { getGeoFromHeaders } from "@/lib/geoip";
import { allowRedirect } from "@/lib/ratelimit";
import { cacheEnabled, cacheSetIfAbsent } from "@/lib/cache";
import { appendSessionParam, parseVariants, pickVariant } from "@/lib/variants";
import { auth } from "@/lib/auth";

// Query param that flags a click as internal pre-launch testing. Stripped
// before the redirect so it doesn't leak into the destination URL or
// pollute the landing page's GA referrer.
const TEST_FLAG_PARAM = "_test";

// Opaque session token handed to the destination page via ?_sl= so
// later /api/track calls can attribute conversions back to this click.
// 16 bytes (128 bits) — collision-free for any realistic volume, short
// enough to not bloat URLs.
function createSessionId(): string {
  return randomBytes(12).toString("base64url");
}

// Helper to hash IP address — validates IP_HASH_SALT at runtime (not module load)
// so Vercel build can succeed without env vars present
function hashIP(ip: string): string {
  const salt = process.env.IP_HASH_SALT;
  if (!salt) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("IP_HASH_SALT environment variable is required in production");
    }
    console.warn("WARNING: IP_HASH_SALT not set, using fallback for development");
    return createHash("sha256").update(ip + "dev-fallback-salt").digest("hex");
  }
  return createHash("sha256").update(ip + salt).digest("hex");
}

// Known bot User-Agent patterns
const BOT_PATTERNS = [
  /bot/i, /crawl/i, /spider/i, /slurp/i, /mediapartners/i,
  /facebookexternalhit/i, /linkedinbot/i, /twitterbot/i, /whatsapp/i,
  /telegrambot/i, /discordbot/i, /slackbot/i, /applebot/i,
  /bingpreview/i, /googlebot/i, /yandexbot/i, /baiduspider/i,
  /duckduckbot/i, /seznambot/i, /ia_archiver/i, /semrushbot/i,
  /ahrefsbot/i, /mj12bot/i, /dotbot/i, /petalbot/i,
  /curl/i, /wget/i, /python-requests/i, /axios/i, /node-fetch/i,
  /go-http-client/i, /java\//i, /libwww/i, /httpie/i,
  /headlesschrome/i, /phantomjs/i, /prerender/i,
];

function isBot(ua: string | null): boolean {
  if (!ua) return true;
  return BOT_PATTERNS.some((pattern) => pattern.test(ua));
}

// Click deduplication window (in seconds).
// 2s is tuned to catch obvious double-clicks / misfires without trapping
// legitimate re-visits. A longer window (previously 10s) ate too many
// real clicks — marketers testing a link they just created would see
// only the first of their taps recorded.
const DEDUP_WINDOW_SECONDS = 2;

// Helper to parse User Agent
function parseUserAgent(ua: string | null): {
  device: string;
  os: string;
  browser: string;
} {
  if (!ua) return { device: "unknown", os: "unknown", browser: "unknown" };

  // Device detection
  let device = "desktop";
  if (/Mobile|Android|iPhone|iPad/i.test(ua)) {
    device = /iPad|Tablet/i.test(ua) ? "tablet" : "mobile";
  }

  // OS detection
  let os = "unknown";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iOS|iPhone|iPad/i.test(ua)) os = "iOS";

  // Browser detection
  let browser = "unknown";
  if (/Chrome/i.test(ua) && !/Edge|Edg/i.test(ua)) browser = "Chrome";
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  else if (/Firefox/i.test(ua)) browser = "Firefox";
  else if (/Edge|Edg/i.test(ua)) browser = "Edge";

  return { device, os, browser };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  const headersList = await headers();
  const clientIp = headersList.get("x-forwarded-for")?.split(",")[0] ||
                   headersList.get("x-real-ip") ||
                   "unknown";

  // Per-IP rate limit on the redirect endpoint. Fails open if Upstash env
  // vars are missing so local dev and fresh deploys still work.
  if (!(await allowRedirect(clientIp))) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    // Find the short link
    const shortLink = await prisma.shortLink.findUnique({
      where: {
        code,
        deletedAt: null,
      },
    });

    // 404 if not found
    if (!shortLink) {
      return NextResponse.redirect(new URL("/404", request.url));
    }

    // Check if link is active
    if (shortLink.status !== "ACTIVE") {
      return NextResponse.redirect(new URL("/link-inactive", request.url));
    }

    // Scheduled activation — link hasn't gone live yet
    if (shortLink.startsAt && new Date() < shortLink.startsAt) {
      return NextResponse.redirect(new URL("/link-not-yet-active", request.url));
    }

    // Check expiration
    if (shortLink.expiresAt && new Date() > shortLink.expiresAt) {
      return NextResponse.redirect(new URL("/link-expired", request.url));
    }

    // Check max clicks — reads the denormalized counter on the row we just
    // fetched, so this is O(1) instead of SELECT COUNT(*) on the clicks
    // table. The counter is incremented atomically in recordClick().
    if (shortLink.maxClicks && shortLink.clickCount >= shortLink.maxClicks) {
      return NextResponse.redirect(new URL("/link-limit-reached", request.url));
    }

    // Extract data before after() — headers are not available inside after()
    const userAgent = headersList.get("user-agent");
    const referrer = headersList.get("referer") || headersList.get("referrer");
    const geo = getGeoFromHeaders(headersList);

    // ---- Internal click detection (pre-launch testing filter) ----
    // Two paths set isInternal=true:
    //   (1) Inbound URL has ?_test=1 — explicit test flag (from "測試短
    //       網址" button on /links). Stripped before redirect so it doesn't
    //       leak to destination GA.
    //   (2) Authenticated workspace member is clicking their own link from
    //       the same browser as the dashboard. Catches "tested by clicking
    //       in /links list" without requiring an explicit flag.
    const requestUrl = new URL(request.url);
    const explicitTestFlag =
      requestUrl.searchParams.get(TEST_FLAG_PARAM) === "1";

    let isInternalClick = explicitTestFlag;
    if (!isInternalClick && shortLink.workspaceId) {
      // Only check session when the link belongs to a workspace — a
      // legacy null-workspace link can't be matched to a member anyway.
      // auth() reads the NextAuth cookie; on cross-domain (go.engenius.ai)
      // the cookie may not be present, in which case session is null and
      // we just skip — the explicit ?_test=1 path still works.
      try {
        const session = await auth();
        if (session?.user?.id) {
          const membership = await prisma.workspaceMember.findFirst({
            where: {
              userId: session.user.id,
              workspaceId: shortLink.workspaceId,
            },
            select: { id: true },
          });
          if (membership) isInternalClick = true;
        }
      } catch {
        // Auth lookup failure shouldn't block the redirect; treat as
        // anonymous (= public click).
      }
    }

    // Geo restriction — only IPs from allowedCountries pass through.
    // Empty array / null means no restriction. Uses the same geo data we'd
    // record anyway so no extra lookup cost. Unknown country (no geo headers)
    // is treated as not-allowed when a whitelist is configured.
    if (shortLink.allowedCountries.length > 0) {
      if (!geo.country || !shortLink.allowedCountries.includes(geo.country)) {
        return NextResponse.redirect(new URL("/link-geo-blocked", request.url));
      }
    }

    // A/B variant pick. Empty variants → fall back to originalUrl.
    // Variant ID is stamped onto the Click for later breakdown reports.
    const variants = parseVariants(shortLink.variants);
    const chosenVariant = pickVariant(variants);
    let rawDestination = chosenVariant?.url ?? shortLink.originalUrl;

    // Strip the test flag from the outgoing destination if present —
    // we don't want it leaking into landing pages or downstream
    // analytics tools.
    if (explicitTestFlag) {
      try {
        const destUrl = new URL(rawDestination);
        destUrl.searchParams.delete(TEST_FLAG_PARAM);
        let cleaned = destUrl.toString();
        if (cleaned.endsWith("?")) cleaned = cleaned.slice(0, -1);
        rawDestination = cleaned;
      } catch {
        // Bad URL — let appendSessionParam handle / fail downstream.
      }
    }

    // Session ID for conversion attribution. Regenerated per click so each
    // conversion is scoped to one visit, not a returning user. Appended as
    // ?_sl=<id> to the destination URL — the landing-page snippet reads it
    // and POSTs back to /api/track on purchase/signup/etc.
    const sessionId = createSessionId();
    const destinationUrl = appendSessionParam(rawDestination, sessionId);

    // Redirect immediately
    const redirectStatus = shortLink.redirectType === "PERMANENT" ? 301 : 302;
    const response = NextResponse.redirect(destinationUrl, redirectStatus);

    // Record click AFTER the response is sent using Next.js after() API
    // This is guaranteed to complete on Vercel (unlike fire-and-forget)
    if (!isBot(userAgent)) {
      after(async () => {
        try {
          await recordClick({
            shortLinkId: shortLink.id,
            workspaceId: shortLink.workspaceId,
            sessionId,
            variantId: chosenVariant?.id ?? null,
            ip: clientIp,
            userAgent,
            referrer,
            geo,
            code,
            isInternal: isInternalClick,
          });
        } catch (err) {
          console.error("Failed to record click:", err);
        }
      });
    }

    return response;
  } catch (error) {
    console.error("Redirect error:", error);
    return NextResponse.redirect(new URL("/error", request.url));
  }
}

// Background click recording — runs after response via after() API
async function recordClick({
  shortLinkId,
  workspaceId,
  sessionId,
  variantId,
  ip,
  userAgent,
  referrer,
  geo,
  code,
  isInternal,
}: {
  shortLinkId: string;
  workspaceId: string | null;
  sessionId: string;
  variantId: string | null;
  ip: string;
  userAgent: string | null;
  referrer: string | null;
  geo: { country: string | null; city: string | null };
  code: string;
  isInternal: boolean;
}) {
  const ipHashed = hashIP(ip);

  // Dedup: atomic SETNX on Redis so two parallel requests can't both pass.
  // The DB-side select-then-insert pattern used previously had a race
  // window where both branches would read "no recent click" and both insert.
  // If Redis isn't configured, fall back to the old select-then-insert —
  // best-effort, not bulletproof, but preserves graceful degradation.
  if (cacheEnabled()) {
    const won = await cacheSetIfAbsent(
      `dedup:click:${shortLinkId}:${ipHashed}`,
      1,
      DEDUP_WINDOW_SECONDS,
    );
    if (!won) return;
  } else {
    const dedupCutoff = new Date(Date.now() - DEDUP_WINDOW_SECONDS * 1000);
    const recentClick = await prisma.click.findFirst({
      where: {
        shortLinkId,
        ipHash: ipHashed,
        timestamp: { gte: dedupCutoff },
      },
      select: { id: true },
    });
    if (recentClick) return;
  }

  const { device, os, browser } = parseUserAgent(userAgent);
  if (!geo.country) {
    console.warn(`[click] No geo data for code: ${code}`);
  }

  // Insert the click + bump the denormalized counter in one transaction so
  // they can't drift. Internal (test) clicks are recorded for forensic
  // purposes but **don't** bump clickCount — that way the "Clicks" column
  // on /links matches what marketers actually care about (real traffic),
  // and maxClicks isn't burned through during pre-launch testing.
  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.click.create({
      data: {
        shortLinkId,
        workspaceId: workspaceId ?? undefined,
        sessionId,
        variantId,
        ipHash: ipHashed,
        userAgent,
        referrer: referrer || null,
        device,
        os,
        browser,
        country: geo.country,
        city: geo.city,
        isInternal,
      },
    }),
  ];
  if (!isInternal) {
    ops.push(
      prisma.shortLink.update({
        where: { id: shortLinkId },
        data: { clickCount: { increment: 1 } },
      }),
    );
  }
  await prisma.$transaction(ops);
}
