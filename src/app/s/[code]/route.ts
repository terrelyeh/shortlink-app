import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";
import { headers } from "next/headers";
import { getGeoFromHeaders } from "@/lib/geoip";
import { allowRedirect } from "@/lib/ratelimit";
import { cacheEnabled, cacheSetIfAbsent } from "@/lib/cache";

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

// Click deduplication window (in seconds)
const DEDUP_WINDOW_SECONDS = 10;

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

    // Geo restriction — only IPs from allowedCountries pass through.
    // Empty array / null means no restriction. Uses the same geo data we'd
    // record anyway so no extra lookup cost. Unknown country (no geo headers)
    // is treated as not-allowed when a whitelist is configured.
    if (shortLink.allowedCountries.length > 0) {
      if (!geo.country || !shortLink.allowedCountries.includes(geo.country)) {
        return NextResponse.redirect(new URL("/link-geo-blocked", request.url));
      }
    }

    // Redirect immediately
    const redirectStatus = shortLink.redirectType === "PERMANENT" ? 301 : 302;
    const response = NextResponse.redirect(shortLink.originalUrl, redirectStatus);

    // Record click AFTER the response is sent using Next.js after() API
    // This is guaranteed to complete on Vercel (unlike fire-and-forget)
    if (!isBot(userAgent)) {
      after(async () => {
        try {
          await recordClick({
            shortLinkId: shortLink.id,
            workspaceId: shortLink.workspaceId,
            ip: clientIp,
            userAgent,
            referrer,
            geo,
            code,
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
  ip,
  userAgent,
  referrer,
  geo,
  code,
}: {
  shortLinkId: string;
  workspaceId: string | null;
  ip: string;
  userAgent: string | null;
  referrer: string | null;
  geo: { country: string | null; city: string | null };
  code: string;
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
  // they can't drift. Note: we only `update` the counter when maxClicks is
  // non-null would be an optimization, but unconditional is simpler and a
  // single indexed PK update is cheap.
  await prisma.$transaction([
    prisma.click.create({
      data: {
        shortLinkId,
        workspaceId: workspaceId ?? undefined,
        ipHash: ipHashed,
        userAgent,
        referrer: referrer || null,
        device,
        os,
        browser,
        country: geo.country,
        city: geo.city,
      },
    }),
    prisma.shortLink.update({
      where: { id: shortLinkId },
      data: { clickCount: { increment: 1 } },
    }),
  ]);
}
