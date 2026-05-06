"use client";

/**
 * Click decay curve — answers "how fast does a campaign's traffic
 * decay?" Plots cumulative clicks vs hours-from-first-click for the
 * selected window. Most marketing campaigns concentrate 50–70% of
 * total clicks in the first 24h; the curve visually confirms that or
 * surfaces unusual long-tail behaviour.
 */

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DecayChartProps {
  data: { hourFromFirst: number; clicks: number; cumClicks: number }[];
  /** Used by the legend / hint to phrase the result, e.g. "60% in
   *  first 24h". Caller computes; we only render. */
  totalClicks: number;
}

export function DecayChart({ data, totalClicks }: DecayChartProps) {
  if (data.length === 0 || totalClicks === 0) {
    return (
      <div
        style={{
          height: 240,
          display: "grid",
          placeItems: "center",
          color: "var(--ink-500)",
          fontSize: 13,
        }}
      >
        —
      </div>
    );
  }

  // Format X axis: small numbers as "2h", "24h", "72+"
  const formatted = data.map((d) => ({
    ...d,
    label:
      d.hourFromFirst >= 72 ? "72h+" : `${d.hourFromFirst}h`,
    cumPct: totalClicks > 0 ? (d.cumClicks / totalClicks) * 100 : 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={formatted} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="label"
          stroke="#888"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          interval={11} // show every 12h tick to keep readable
        />
        <YAxis
          stroke="#888"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value, key) => {
            const v = typeof value === "number" ? value : 0;
            if (key === "cumClicks") {
              return [
                `${v} (${((v / totalClicks) * 100).toFixed(0)}% of total)`,
                "Cumulative clicks",
              ];
            }
            return [v, "Clicks in this hour"];
          }}
        />
        <Area
          type="monotone"
          dataKey="cumClicks"
          fill="var(--brand-100)"
          stroke="var(--brand-500)"
          strokeWidth={2}
          name="Cumulative"
        />
        <Line
          type="monotone"
          dataKey="clicks"
          stroke="#94a3b8"
          strokeWidth={1.5}
          dot={false}
          name="Per hour"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
