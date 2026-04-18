/**
 * A/B variant helpers — weighted random pick, shared by the redirect
 * route and any UI previews that want to show expected distribution.
 */

export interface LinkVariant {
  /** Stable ID — kept in sync with Click.variantId for breakdown reports. */
  id: string;
  url: string;
  /** Positive integer; we normalise against the sum, not a fixed total. */
  weight: number;
  /** Optional human label (e.g. "Landing A", "Product page variant"). */
  label?: string;
}

/**
 * Best-effort parse of the `ShortLink.variants` JSON column into a typed
 * array. Bad data → empty array (fail safe — redirect will use originalUrl).
 */
export function parseVariants(raw: unknown): LinkVariant[] {
  if (!Array.isArray(raw)) return [];
  const out: LinkVariant[] = [];
  for (const v of raw) {
    if (!v || typeof v !== "object") continue;
    const obj = v as Record<string, unknown>;
    const url = typeof obj.url === "string" ? obj.url : "";
    const weight = Number(obj.weight);
    if (!url || !Number.isFinite(weight) || weight <= 0) continue;
    const id = typeof obj.id === "string" && obj.id ? obj.id : `v_${out.length}`;
    const label = typeof obj.label === "string" ? obj.label : undefined;
    out.push({ id, url, weight, label });
  }
  return out;
}

/**
 * Weighted random pick. Returns null when the list is empty so callers
 * can fall back to the primary originalUrl.
 */
export function pickVariant(
  variants: LinkVariant[],
  rand: () => number = Math.random,
): LinkVariant | null {
  if (variants.length === 0) return null;
  const total = variants.reduce((s, v) => s + v.weight, 0);
  if (total <= 0) return variants[0];
  let r = rand() * total;
  for (const v of variants) {
    r -= v.weight;
    if (r <= 0) return v;
  }
  return variants[variants.length - 1];
}

/**
 * Append an opaque session token to a destination URL without clobbering
 * existing query params. Uses `_sl` as the param name — short and
 * unlikely to collide with marketer-defined UTM values.
 */
export function appendSessionParam(url: string, sessionId: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("_sl", sessionId);
    return u.toString();
  } catch {
    // Malformed URL — return unchanged rather than throw. The redirect
    // will still work; conversion attribution just won't fire for this link.
    return url;
  }
}
