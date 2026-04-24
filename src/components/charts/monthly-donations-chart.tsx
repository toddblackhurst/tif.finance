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
} from "recharts";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const CAMPUS_COLORS: Record<string, string> = {
  "TIF North":                   "#2563eb",
  "TIF South":                   "#16a34a",
  "All Praise":                  "#d97706",
  "Hope Fellowship 盼望教會":      "#9333ea",
  "TIF System":                  "#64748b",
};
const FALLBACK_COLORS = ["#ef4444", "#06b6d4", "#f59e0b", "#84cc16"];

export interface MonthlyRollupRow {
  campus: string;
  fund: string;
  year: number;
  month: number;
  total_donations: number;
  donation_count: number;
}

interface Props {
  data: MonthlyRollupRow[];
  year: number;
}

function ntFormat(value: number) {
  if (value >= 1_000_000) return `NT$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)     return `NT$${(value / 1_000).toFixed(0)}K`;
  return `NT$${value.toLocaleString()}`;
}

export function MonthlyDonationsChart({ data, year }: Props) {
  // Pivot: array of { month: "Jan", "TIF North": 120000, "TIF South": 80000, ... }
  const campuses = Array.from(new Set(data.map((r) => r.campus))).sort();

  const byMonth: Record<number, Record<string, number>> = {};
  for (let m = 1; m <= 12; m++) byMonth[m] = {};
  for (const row of data) {
    if (row.year === year) {
      byMonth[row.month][row.campus] = (byMonth[row.month][row.campus] ?? 0) + row.total_donations;
    }
  }

  const chartData = MONTH_LABELS.map((label, idx) => ({
    month: label,
    ...byMonth[idx + 1],
  }));

  let fallbackIdx = 0;
  const campusColor = (name: string) => {
    if (CAMPUS_COLORS[name]) return CAMPUS_COLORS[name];
    return FALLBACK_COLORS[fallbackIdx++ % FALLBACK_COLORS.length];
  };

  if (campuses.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No donation data for {year}.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={ntFormat} tick={{ fontSize: 11 }} width={64} />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [`NT$${Number(value).toLocaleString()}`, String(name)]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {campuses.map((campus) => (
          <Bar key={campus} dataKey={campus} stackId="a" fill={campusColor(campus)} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
