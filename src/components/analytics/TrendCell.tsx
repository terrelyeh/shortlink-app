import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export type TrendState = "up" | "down" | "flat" | "new" | "dead" | "none";

/**
 * Mini sparkline + trend label. Used in the Campaign Detail "Links in this
 * campaign" table and the /campaigns Leaderboard.
 *
 *   - last7d > 0, prev7d > 0 → ±N% with ▲ / ▼ / — (flat if |%|<2)
 *   - last7d > 0, prev7d = 0 → NEW (green, no denominator)
 *   - last7d = 0, prev7d > 0 → —100% (red, dying)
 *   - both 0                 → "none" (caller shows "—")
 *
 * Callers should compute sparkline + trendPct + trendState upstream (the
 * API does this for the leaderboard; the detail page does it client-side
 * from raw clicks).
 */
export function TrendCell({
  sparkline,
  trendPct,
  trendState,
}: {
  sparkline: number[];
  trendPct: number | null;
  trendState: TrendState;
}) {
  const w = 60;
  const h = 20;
  const max = Math.max(1, ...sparkline);
  const step = sparkline.length > 1 ? w / (sparkline.length - 1) : 0;
  const points = sparkline
    .map((v, i) => `${i * step},${h - (v / max) * h}`)
    .join(" ");

  const color =
    trendState === "up" || trendState === "new"
      ? "var(--data-emerald)"
      : trendState === "down" || trendState === "dead"
        ? "var(--err-fg)"
        : "var(--ink-400)";

  const Icon =
    trendState === "up" || trendState === "new"
      ? TrendingUp
      : trendState === "down" || trendState === "dead"
        ? TrendingDown
        : Minus;

  const label =
    trendState === "new"
      ? "NEW"
      : trendState === "dead"
        ? "—100%"
        : trendPct === null
          ? "—"
          : `${trendPct > 0 ? "+" : ""}${trendPct.toFixed(0)}%`;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{ display: "block", overflow: "visible" }}
        aria-hidden="true"
      >
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        title={
          trendPct !== null ? `${trendPct.toFixed(1)}% vs prev 7d` : "last 7d vs prev 7d"
        }
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 2,
          fontSize: 11,
          fontWeight: 600,
          color,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <Icon size={10} />
        {label}
      </span>
    </div>
  );
}

/**
 * Pure helper: given last 7d and previous 7d click sums, classify the trend
 * into a discrete state + compute the % change. Keep side-effect-free so it
 * can be used in both client (raw clicks in useMemo) and server (aggregated
 * SQL) code paths.
 */
export function classifyTrend(
  last7d: number,
  prev7d: number,
): { trendState: TrendState; trendPct: number | null } {
  if (last7d === 0 && prev7d === 0) return { trendState: "none", trendPct: null };
  if (prev7d === 0 && last7d > 0) return { trendState: "new", trendPct: null };
  if (prev7d > 0 && last7d === 0) return { trendState: "dead", trendPct: -100 };
  const pct = ((last7d - prev7d) / prev7d) * 100;
  const state: TrendState = pct > 2 ? "up" : pct < -2 ? "down" : "flat";
  return { trendState: state, trendPct: pct };
}
