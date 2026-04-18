/**
 * Rate limiting for the redirect endpoint.
 *
 * Uses Upstash's sliding-window algorithm keyed on client IP. When Upstash
 * env vars are missing we fall through to "always allowed" so local dev
 * and fresh deploys don't 429 themselves.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let limiter: Ratelimit | null = null;
let initialised = false;

function getLimiter(): Ratelimit | null {
  if (initialised) return limiter;
  initialised = true;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    // 60 redirects / minute per IP — high enough for legitimate bursts
    // (a single article with many anchor-link clicks) but stops scripted
    // abuse hammering a single short code.
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "rl:redirect",
    analytics: false,
  });
  return limiter;
}

/**
 * Check whether a redirect from `ip` is allowed.
 * Returns true when Upstash is not configured (fail-open for local dev).
 */
export async function allowRedirect(ip: string): Promise<boolean> {
  const rl = getLimiter();
  if (!rl) return true;
  try {
    const { success } = await rl.limit(ip);
    return success;
  } catch (err) {
    // Don't block redirects because of a Redis hiccup.
    console.warn("[ratelimit] check failed, allowing through:", err);
    return true;
  }
}
