import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";
import { headers } from "next/headers";

// Validate IP_HASH_SALT at module load time
const IP_HASH_SALT = process.env.IP_HASH_SALT;
if (!IP_HASH_SALT) {
  console.warn(
    "WARNING: IP_HASH_SALT environment variable is not set. " +
    "IP addresses will not be properly anonymized. " +
    "Please set IP_HASH_SALT in production."
  );
}

// Helper to hash IP address
function hashIP(ip: string): string {
  if (!IP_HASH_SALT) {
    throw new Error("IP_HASH_SALT environment variable is required");
  }
  return createHash("sha256").update(ip + IP_HASH_SALT).digest("hex");
}

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

    // Get request headers for tracking
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for")?.split(",")[0] ||
               headersList.get("x-real-ip") ||
               "unknown";
    const userAgent = headersList.get("user-agent");
    const referrer = headersList.get("referer");
    const { device, os, browser } = parseUserAgent(userAgent);

    // Record the click - await to ensure data is saved before response
    try {
      await prisma.click.create({
        data: {
          shortLinkId: shortLink.id,
          ipHash: hashIP(ip),
          userAgent,
          referrer,
          device,
          os,
          browser,
          // Note: Country/City would require a GeoIP service
        },
      });
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
