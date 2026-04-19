/**
 * Format a timestamp as a short relative time like "2h ago" / "3d ago".
 * Resolution drops below minute granularity (seconds collapse to "just now")
 * since marketing dashboards don't care about sub-minute precision.
 *
 * The `t` argument is optional so server-side / non-React contexts can
 * still call this; omit it and the fallback strings are English. In
 * client components, pass `useTranslations("common")` so the label
 * follows the user's locale.
 */
export function formatRelativeTime(
  date: Date,
  t?: (key: string, values?: Record<string, string | number>) => string,
): string {
  const diffMs = Date.now() - date.getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return t ? t("justNow") : "just now";
  const min = Math.floor(s / 60);
  if (min < 60) return t ? t("minutesAgo", { n: min }) : `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return t ? t("hoursAgo", { n: h }) : `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return t ? t("daysAgo", { n: d }) : `${d}d ago`;
  const mo = Math.floor(d / 30);
  return t ? t("monthsAgo", { n: mo }) : `${mo}mo ago`;
}
