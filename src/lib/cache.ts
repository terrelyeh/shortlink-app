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

/**
 * Atomic SETNX with TTL. Returns true when the key was set (caller "wins"),
 * false when it already existed or when caching is disabled.
 *
 * When caching is disabled we return **false** on purpose — callers use the
 * return value as "I have exclusive ownership of this token right now", and
 * claiming ownership you can't actually hold would be a bug. Callers that
 * want a graceful fallback (e.g. dedup) should handle `false` with a
 * best-effort path.
 */
export async function cacheSetIfAbsent(
  key: string,
  value: string | number,
  ttlSeconds: number,
): Promise<boolean> {
  const redis = getClient();
  if (!redis) return false;
  try {
    const res = await redis.set(key, value, { ex: ttlSeconds, nx: true });
    return res === "OK";
  } catch (err) {
    console.warn("[cache] SETNX failed:", key, err);
    return false;
  }
}

/** True iff Upstash env vars are configured. Used by callers to choose a
 * fallback path when the cache is disabled. */
export function cacheEnabled(): boolean {
  return getClient() !== null;
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
 * Versioned-key invalidation.
 *
 * Instead of deleting specific cache keys on every write (hard when keys are
 * parameterised by filter combinations), bake a monotonic version number
 * into the key. Writes bump the version → all prior keys become unreachable
 * and expire on their own TTL.
 *
 * One Redis `INCR` per write, one `GET` per read. Safe when disabled
 * (version stays at 0, keys still work — they just never invalidate until
 * TTL, which is fine without Redis since computes are also direct DB).
 */
export async function cacheGetVersion(namespace: string): Promise<number> {
  const redis = getClient();
  if (!redis) return 0;
  try {
    return (await redis.get<number>(`ver:${namespace}`)) ?? 0;
  } catch {
    return 0;
  }
}

export async function cacheBumpVersion(namespace: string): Promise<void> {
  const redis = getClient();
  if (!redis) return;
  try {
    await redis.incr(`ver:${namespace}`);
  } catch (err) {
    console.warn("[cache] bump version failed:", namespace, err);
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
