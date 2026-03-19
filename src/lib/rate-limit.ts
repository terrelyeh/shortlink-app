/**
 * Simple in-memory rate limiter.
 *
 * On Vercel serverless this is best-effort only (each instance has its own memory).
 * Sufficient for password brute-force protection on low-traffic endpoints.
 * For high-traffic rate limiting, use Upstash Redis or Vercel KV.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitEntry>();

// Lazy cleanup: evict stale entries when store exceeds threshold
const MAX_STORE_SIZE = 1000;

function cleanupIfNeeded() {
  if (store.size <= MAX_STORE_SIZE) return;
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetTime) {
      store.delete(key);
    }
  }
}

interface RateLimitOptions {
  /** Maximum number of requests in the window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(
  key: string,
  options: RateLimitOptions = { limit: 60, windowSeconds: 60 }
): RateLimitResult {
  cleanupIfNeeded();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetTime) {
    // New window
    const resetTime = now + options.windowSeconds * 1000;
    store.set(key, { count: 1, resetTime });
    return { allowed: true, remaining: options.limit - 1, resetAt: resetTime };
  }

  if (entry.count >= options.limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetTime };
  }

  entry.count++;
  return { allowed: true, remaining: options.limit - entry.count, resetAt: entry.resetTime };
}

/**
 * Rate limit helper for Next.js API routes.
 * Returns a Response if rate limited, or null if allowed.
 */
export function checkRateLimit(
  ip: string,
  endpoint: string,
  options?: RateLimitOptions
): Response | null {
  const key = `${endpoint}:${ip}`;
  const result = rateLimit(key, options);

  if (!result.allowed) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please try again later." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Limit": String(options?.limit || 60),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
        },
      }
    );
  }

  return null;
}
