"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

export interface BudgetVarianceRow {
  campus: string;
  fund: string;
  fiscal_year: number;
  fiscal_month: number;
  budgeted_amount: number;
  actual_donations: number;
  variance: number;
}

interface Props {
  data: BudgetVarianceRow[];
  year: number;
}

function ntFormat(value: number) {
  if (Math.abs(value) >= 1_000_000) return `NT$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000)     return `NT$${(value / 1_000).toFixed(0)}K`;
  return `NT$${value.toLocaleString()}`;
}

export function BudgetVarianceChart({ data, year }: Props) {
  // Aggregate by campus: sum budgeted and actual across all months
  const campusMap: Record<string, { budgeted: number; actual: number }> = {};
  for (const row of data) {
    if (row.fiscal_year !== year) continue;
    if (!campusMap[row.campus]) campusMap[row.campus] = { budgeted: 0, actual: 0 };
    campusMap[row.campus].budgeted += row.budgeted_amount;
    campusMap[row.campus].actual  += row.actual_donations;
  }

  const chartData = Object.entries(campusMap)
    .map(([campus, vals]) => ({
      campus: campus.replace(" 盼望教會", " 盼望"),
      Budgeted: Math.round(vals.budgeted),
      Actual:   Math.round(vals.actual),
      variance: Math.round(vals.actual - vals.budgeted),
    }))
    .sort((a, b) => b.Budgeted - a.Budgeted);

  if (chartData.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No budget data for {year}.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 48 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis
          dataKey="campus"
          tick={{ fontSize: 11 }}
          angle={-20}
          textAnchor="end"
          interval={0}
        />
        <YAxis tickFormatter={ntFormat} tick={{ fontSize: 11 }} width={72} />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [`NT$${Number(value).toLocaleString()}`, String(name)]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <ReferenceLine y={0} stroke="#666" />
        <Bar dataKey="Budgeted" fill="#94a3b8" radius={[2, 2, 0, 0]} />
        <Bar dataKey="Actual"   fill="#3b82f6" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
