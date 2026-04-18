/**
 * Thin wrapper around Upstash Redis with a **graceful no-op fallback**.
 *
 * If UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are not configured:
 *   - cacheGet()  → returns null (cache miss)
 *   - cacheSet()  → does nothing
 *   - cacheDel()  → does nothing
 *
 * So the app keeps working locally / on fresh deploys without Redis,
 * and turning caching on is just "add two env vars + redeploy".
 *
 * Using Upstash free tier: 10,000 commands/day, 256MB storage. That's
 * plenty for a small team — analytics + dashboard queries with a 60s TTL
 * means maybe a few hundred commands/day.
 */

import { Redis } from "@upstash/redis";

let client: Redis | null = null;
let initialised = false;

function getClient(): Redis | null {
  if (initialised) return client;
  initialised = true;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (process.env.NODE_ENV !== "production") {
      console.info(
        "[cache] Upstash Redis env vars not set — cache is disabled (no-op)."
      );
    }
    return null;
  }

  client = new Redis({ url, token });
  return client;
}

/** Read a cached value. Returns null on miss, on error, or when cache is disabled. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getClient();
  if (!redis) return null;
  try {
    return (await redis.get<T>(key)) ?? null;
  } catch (err) {
    console.warn("[cache] get failed, falling through:", err);
    return null;
  }
}

/** Write a cached value with TTL (seconds). Silent no-op when disabled or on error. */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number,
): Promise<void> {
  const redis = getClient();
  if (!redis) return;
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch (err) {
    // console.error surfaces in Vercel runtime logs so we can diagnose if
    // the Upstash URL/token is wrong or the network call failed.
    console.error("[cache] SET failed:", key, err);
  }
}

/** Delete a cached value (or pattern). Used for invalidation on writes. */
export async function cacheDel(key: string): Promise<void> {
  const redis = getClient();
  if (!redis) return;
  try {
    await redis.del(key);
  } catch (err) {
    console.warn("[cache] del failed, ignoring:", err);
  }
}

/**
 * Cache-aside helper: look up key; on miss, call `compute`, store the
 * result with TTL, and return it. Returns computed value on cache errors too.
 *
 * IMPORTANT: we `await` cacheSet before returning. Fire-and-forget looked
 * tempting (save ~50ms), but Vercel terminates the Lambda the moment the
 * response is sent, killing any pending promise — meaning the SET never
 * actually happens, every request is a miss, and Redis stays empty. The
 * extra 50ms on a cache-miss buys 60 seconds of sub-100ms cache-hits.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== null) {
    if (process.env.NODE_ENV !== "production") console.log(`[cache] HIT  ${key}`);
    return hit;
  }

  if (process.env.NODE_ENV !== "production") console.log(`[cache] MISS ${key}`);
  const fresh = await compute();
  // Await so the Lambda stays alive long enough for Upstash to ack the write.
  await cacheSet(key, fresh, ttlSeconds);
  return fresh;
}

/**
 * Build a stable namespaced cache key.
 * Example: cacheKey("analytics", userId, range, linkId ?? "all")
 */
export function cacheKey(...parts: (string | number | null | undefined)[]): string {
  return parts.map((p) => p ?? "_").join(":");
}
