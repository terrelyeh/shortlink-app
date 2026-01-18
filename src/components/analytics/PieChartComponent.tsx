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
      <div className="h-[250px] flex items-center justify-center text-gray-400">
        No data available
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-2">{title}</h3>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
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
            formatter={(value: number) => [
              `${value.toLocaleString()} (${((value / total) * 100).toFixed(1)}%)`,
              "Clicks",
            ]}
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
            }}
          />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            formatter={(value, entry) => (
              <span className="text-sm text-gray-600">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
