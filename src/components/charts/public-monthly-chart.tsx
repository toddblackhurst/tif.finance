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

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun",
                      "Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_LABELS_ZH = ["1月","2月","3月","4月","5月","6月",
                          "7月","8月","9月","10月","11月","12月"];

function ntFormat(value: number) {
  if (value >= 1_000_000) return `NT$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)     return `NT$${(value / 1_000).toFixed(0)}K`;
  return `NT$${value.toLocaleString()}`;
}

interface Props {
  monthlyDonations: Record<number, number>;
  monthlyExpenses: Record<number, number>;
  givingLabel: string;
  expensesLabel: string;
  locale?: string;
}

export function PublicMonthlyChart({
  monthlyDonations,
  monthlyExpenses,
  givingLabel,
  expensesLabel,
  locale = "en",
}: Props) {
  const labels = locale === "zh-TW" ? MONTH_LABELS_ZH : MONTH_LABELS;

  const chartData = labels.map((label, idx) => ({
    month: label,
    [givingLabel]:   monthlyDonations[idx + 1] ?? 0,
    [expensesLabel]: monthlyExpenses[idx + 1]  ?? 0,
  }));

  const hasData = Object.values(monthlyDonations).some((v) => v > 0) ||
                  Object.values(monthlyExpenses).some((v) => v > 0);

  if (!hasData) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">
        {locale === "zh-TW" ? "暫無資料" : "No data yet"}
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={ntFormat} tick={{ fontSize: 10 }} width={60} />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [
            `NT$${Number(value).toLocaleString()}`,
            String(name),
          ]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey={givingLabel}   fill="#16a34a" radius={[2,2,0,0]} />
        <Bar dataKey={expensesLabel} fill="#dc2626" radius={[2,2,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
