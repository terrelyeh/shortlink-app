"use client";

/**
 * Multi-campaign daily click overlay.
 *
 * Shared by the /campaigns list (where users pick 2-4 campaigns to
 * compare at a glance) and /campaigns/compare (which always shows an
 * overlay for the selected set). Keeping one component means the axis,
 * colour assignment and tooltip formatting stay consistent between the
 * two surfaces.
 *
 * Axis / date format: short "MM-DD" labels; tooltip shows full ISO
 * date. Empty days are zero-filled upstream so lines don't break.
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// 8 distinct, high-contrast line colours. More than 4-5 overlaid lines
// is visually unusable, so extras just wrap.
const PALETTE = [
  "#03A9F4", // primary sky
  "#10b981", // emerald
  "#8b5cf6", // violet
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
];

interface Props {
  /** Daily date axis as ISO yyyy-mm-dd strings. */
  dates: string[];
  /** Map of campaign name → per-day click counts (aligned to dates). */
  series: Record<string, number[]>;
  /** Height override; defaults to 260 which fits above a table well. */
  height?: number;
}

export function MultiCampaignChart({ dates, series, height = 260 }: Props) {
  const campaignNames = Object.keys(series);

  // Reshape into Recharts-friendly rows: one object per day, keys are
  // campaign names plus a `date` label. Done in-render because the
  // parent already ran the expensive aggregation upstream.
  const data = dates.map((date, i) => {
    const row: Record<string, string | number> = {
      date,
      shortDate: date.slice(5), // "MM-DD" for axis
    };
    for (const name of campaignNames) {
      row[name] = series[name]?.[i] ?? 0;
    }
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="shortDate"
          stroke="#94a3b8"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#94a3b8"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => v.toLocaleString()}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            fontSize: 12,
            boxShadow: "0 4px 12px -2px rgba(0,0,0,0.08)",
          }}
          labelFormatter={(label, payload) => {
            // Recharts passes the x-axis value; we want the full ISO date
            // from the underlying row. Payload carries the row.
            const row = payload?.[0]?.payload as { date?: string } | undefined;
            return row?.date ?? label;
          }}
          formatter={(value) => {
            const n = typeof value === "number" ? value : Number(value);
            return [n.toLocaleString(), "clicks"] as [string, string];
          }}
        />
        <Legend
          iconType="plainline"
          iconSize={18}
          wrapperStyle={{ fontSize: 12, paddingTop: 6 }}
          formatter={(value) => <span className="text-slate-600">{value}</span>}
        />
        {campaignNames.map((name, idx) => (
          <Line
            key={name}
            type="monotone"
            dataKey={name}
            stroke={PALETTE[idx % PALETTE.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
