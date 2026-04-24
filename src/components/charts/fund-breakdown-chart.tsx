"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = ["#2563eb", "#16a34a", "#d97706", "#9333ea", "#ef4444", "#06b6d4", "#f59e0b"];

export interface FundTotalRow {
  fund: string;
  total: number;
}

interface Props {
  data: FundTotalRow[];
  year: number;
}

export function FundBreakdownChart({ data, year }: Props) {
  const filtered = data.filter((r) => r.total > 0);

  if (filtered.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No fund data for {year}.</p>;
  }

  const grandTotal = filtered.reduce((s, r) => s + r.total, 0);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={filtered}
          dataKey="total"
          nameKey="fund"
          cx="50%"
          cy="45%"
          outerRadius={90}
          innerRadius={45}
          paddingAngle={2}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label={({ name, value }: any) =>
            `${name}: ${((Number(value) / grandTotal) * 100).toFixed(0)}%`
          }
          labelLine={false}
        >
          {filtered.map((_, idx) => (
            <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [`NT$${Number(value).toLocaleString()}`, String(name)]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
