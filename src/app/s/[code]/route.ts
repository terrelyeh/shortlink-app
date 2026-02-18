import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";
import { headers } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";
import { lookupIP } from "@/lib/geoip";

// Validate IP_HASH_SALT at module load time
const IP_HASH_SALT = process.env.IP_HASH_SALT;
if (!IP_HASH_SALT && process.env.NODE_ENV === "production") {
  throw new Error(
    "IP_HASH_SALT environment variable is required in production. " +
    "IP addresses cannot be properly anonymized without it."
  );
} else if (!IP_HASH_SALT) {
  console.warn(
    "WARNING: IP_HASH_SALT environment variable is not set. " +
    "Please set IP_HASH_SALT before deploying to production."
  );
}

// Helper to hash IP address
function hashIP(ip: string): string {
  if (!IP_HASH_SALT) {
    throw new Error("IP_HASH_SALT environment variable is required");
  }
  return createHash("sha256").update(ip + IP_HASH_SALT).digest("hex");
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

  // Rate limit: 100 requests per minute per IP
  const headersList = await headers();
  const clientIp = headersList.get("x-forwarded-for")?.split(",")[0] ||
                   headersList.get("x-real-ip") ||
                   "unknown";
  const rateLimitResponse = checkRateLimit(clientIp, "redirect", { limit: 100, windowSeconds: 60 });
  if (rateLimitResponse) return rateLimitResponse;

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

    // Check expiration
    if (shortLink.expiresAt && new Date() > shortLink.expiresAt) {
      return NextResponse.redirect(new URL("/link-expired", request.url));
    }

    // Check max clicks
    if (shortLink.maxClicks) {
      const clickCount = await prisma.click.count({
        where: { shortLinkId: shortLink.id },
      });
      if (clickCount >= shortLink.maxClicks) {
        return NextResponse.redirect(new URL("/link-limit-reached", request.url));
      }
    }

    // Get request headers for tracking (headersList already fetched above for rate limiting)
    const ip = clientIp;
    const userAgent = headersList.get("user-agent");
    const referrer = headersList.get("referer");
    const { device, os, browser } = parseUserAgent(userAgent);

    // Record the click (skip bots and duplicate clicks)
    try {
      if (!isBot(userAgent)) {
        const ipHashed = hashIP(ip);

        // Check for duplicate clicks (same IP + same link within dedup window)
        const dedupCutoff = new Date(Date.now() - DEDUP_WINDOW_SECONDS * 1000);
        const recentClick = await prisma.click.findFirst({
          where: {
            shortLinkId: shortLink.id,
            ipHash: ipHashed,
            timestamp: { gte: dedupCutoff },
          },
          select: { id: true },
        });

        if (!recentClick) {
          const geo = lookupIP(ip);
          await prisma.click.create({
            data: {
              shortLinkId: shortLink.id,
              ipHash: ipHashed,
              userAgent,
              referrer,
              device,
              os,
              browser,
              country: geo.country,
              city: geo.city,
            },
          });
        }
      }
    } catch (clickError) {
      // Log but don't fail the redirect if click recording fails
      console.error("Failed to record click:", clickError);
    }

    // Redirect
    const redirectStatus = shortLink.redirectType === "PERMANENT" ? 301 : 302;
    return NextResponse.redirect(shortLink.originalUrl, redirectStatus);
  } catch (error) {
    console.error("Redirect error:", error);
    return NextResponse.redirect(new URL("/error", request.url));
  }
}
