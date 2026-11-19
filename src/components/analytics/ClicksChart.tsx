"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useLocale } from "next-intl";

interface ClicksChartProps {
  /** `date` is YYYY-MM-DD (viewer's local day). */
  data: { date: string; clicks: number }[];
  height?: number;
}

/** Parse YYYY-MM-DD as a local date — `new Date("2026-11-03")` would be UTC midnight. */
function parseDay(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function ClicksChart({ data, height = 300 }: ClicksChartProps) {
  const locale = useLocale();
  const years = new Set(data.map((d) => d.date.slice(0, 4)));
  const thisYear = String(new Date().getFullYear());
  // Show the year on the axis whenever it isn't obvious (range crosses a
  // year, or it's all in a past year). The tooltip always has it.
  const axisWithYear = years.size > 1 || !years.has(thisYear);

  const axisFmt = new Intl.DateTimeFormat(locale, {
    ...(axisWithYear ? { year: "numeric" } : {}),
    month: "short",
    day: "numeric",
  });
  const fullFmt = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    weekday: "short",
  });

  const showDots = data.length <= 45;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          stroke="#888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
          tickFormatter={(v: string) => axisFmt.format(parseDay(v))}
        />
        <YAxis
          stroke="#888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          tickFormatter={(value) => value.toLocaleString()}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
          }}
          labelStyle={{ fontWeight: "bold", marginBottom: "4px" }}
          labelFormatter={(v) => fullFmt.format(parseDay(String(v)))}
        />
        <Line
          type="monotone"
          dataKey="clicks"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={showDots ? { fill: "#3b82f6", strokeWidth: 2, r: 3 } : false}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
