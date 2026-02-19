"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

interface PieChartProps {
  data: { name: string; value: number }[];
  title: string;
}

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
];

export function PieChartComponent({ data, title }: PieChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="h-[180px] flex items-center justify-center text-slate-400 text-sm">
        No data available
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-slate-700 mb-1">{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={45}
            outerRadius={65}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => {
              const numValue = typeof value === 'number' ? value : Number(value);
              return [
                `${numValue.toLocaleString()} (${((numValue / total) * 100).toFixed(1)}%)`,
                "Clicks",
              ];
            }}
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Legend
            layout="horizontal"
            align="center"
            verticalAlign="bottom"
            iconSize={8}
            formatter={(value) => (
              <span className="text-xs text-slate-500">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
