/**
 * Share-report period, stored in ShareToken.rangeWindow (a free String
 * column, so no schema change):
 *   "all"                     — everything
 *   "YYYY-MM-DD..YYYY-MM-DD"  — fixed dates, inclusive, Asia/Taipei days
 *   "7d" / "14d" / "30d" / "90d" — legacy rolling window (old tokens only)
 */

const TZ = "Asia/Taipei";
const TZ_OFFSET = "+08:00";
export const FIXED_PERIOD_RE = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/;
export const ROLLING_PERIOD_RE = /^(7|14|30|90)d$/;

/** Calendar date in Taiwan time, e.g. "2026-06-02". */
export function toShareDate(d: Date): string {
  // sv-SE formats as YYYY-MM-DD.
  return d.toLocaleDateString("sv-SE", { timeZone: TZ });
}

export function isValidSharePeriod(v: string): boolean {
  if (v === "all" || ROLLING_PERIOD_RE.test(v)) return true;
  const m = v.match(FIXED_PERIOD_RE);
  return Boolean(m && m[1] <= m[2]);
}

/** Timestamp bounds for a stored period; undefined bound = open. */
export function sharePeriodBounds(v: string | null): { gte?: Date; lte?: Date } {
  if (!v || v === "all") return {};
  const fixed = v.match(FIXED_PERIOD_RE);
  if (fixed) {
    return {
      gte: new Date(`${fixed[1]}T00:00:00${TZ_OFFSET}`),
      lte: new Date(`${fixed[2]}T23:59:59.999${TZ_OFFSET}`),
    };
  }
  const days = parseInt(v.replace("d", ""), 10) || 30;
  return { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
}

/** "2026-06-01 – 2026-06-30", or allLabel / "last 30d" for the other forms. */
export function formatSharePeriod(v: string | null, allLabel: string): string {
  if (!v || v === "all") return allLabel;
  const fixed = v.match(FIXED_PERIOD_RE);
  if (fixed) return fixed[1] === fixed[2] ? fixed[1] : `${fixed[1]} – ${fixed[2]}`;
  return v;
}
