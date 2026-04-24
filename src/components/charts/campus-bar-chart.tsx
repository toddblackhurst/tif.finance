"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const CAMPUS_COLORS: Record<string, string> = {
  "TIF North":                 "#2563eb",
  "TIF South":                 "#16a34a",
  "All Praise":                "#d97706",
  "Hope Fellowship 盼望教會":   "#9333ea",
  "Hope Fellowship":           "#9333ea",
  "TIF System":                "#64748b",
};
const FALLBACK = ["#ef4444","#06b6d4","#f59e0b","#84cc16"];

function ntFormat(value: number) {
  if (value >= 1_000_000) return `NT$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)     return `NT$${(value / 1_000).toFixed(0)}K`;
  return `NT$${value.toLocaleString()}`;
}

interface Props {
  data: { campus: string; total: number }[];
  color?: string;
}

export function CampusBarChart({ data }: Props) {
  if (!data.length) return null;
  let fi = 0;
  const color = (name: string) => CAMPUS_COLORS[name] ?? FALLBACK[fi++ % FALLBACK.length];

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
        <XAxis type="number" tickFormatter={ntFormat} tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="campus" tick={{ fontSize: 11 }} width={130} />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [`NT$${Number(value).toLocaleString()}`]}
        />
        <Bar dataKey="total" radius={[0,2,2,0]}>
          {data.map((entry, idx) => (
            <Cell key={idx} fill={color(entry.campus)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
