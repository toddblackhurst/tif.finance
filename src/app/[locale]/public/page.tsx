/**
 * Public Stewardship Dashboard — no authentication required.
 * Designed to be embedded as an iframe on taichunginternationalfellowship.org/stewardship-dashboard
 *
 * URL: https://tif-finance.vercel.app/en/public
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { MonthlyDonationsChart } from "@/components/charts/monthly-donations-chart";
import { FundBreakdownChart } from "@/components/charts/fund-breakdown-chart";

export const dynamic = "force-dynamic";

// --- Types reused from reports page ----------------------------------------
type RollupRow = {
  campus: string;
  fund: string;
  year: number;
  month: number;
  total_donations: number;
  donation_count: number;
};
type VarianceRow = {
  campus: string;
  fund: string;
  fiscal_year: number;
  fiscal_month: number;
  budgeted_amount: number;
  actual_donations: number;
  variance: number;
};

const CAMPUS_ORDER = [
  "TIF North",
  "TIF South",
  "Hope Fellowship 盼望教會",
  "All Praise",
];

function fmt(n: number) {
  return `NT$${Math.round(n).toLocaleString()}`;
}

function pctBar(pct: number, over: boolean) {
  const capped = Math.min(pct, 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full ${over ? "bg-emerald-500" : "bg-blue-500"}`}
          style={{ width: `${capped}%` }}
        />
      </div>
      <span
        className={`text-xs font-semibold tabular-nums w-10 text-right ${
          over ? "text-emerald-700" : "text-gray-700"
        }`}
      >
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

export default async function PublicDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ year?: string }>;
}) {
  const sp = (await (searchParams ?? Promise.resolve({}))) as Record<
    string,
    string | undefined
  >;
  const currentYear =
    parseInt(sp.year ?? "") || new Date().getFullYear();

  const supabase = createAdminClient();

  const [rollupResult, varianceResult] = await Promise.all([
    supabase
      .from("monthly_campus_rollup")
      .select("*")
      .order("month", { ascending: true }),
    supabase
      .from("budget_variance")
      .select("*")
      .eq("fiscal_year", currentYear),
  ]);

  const rollup = ((rollupResult.data ?? []) as unknown as RollupRow[]);
  const variance = ((varianceResult.data ?? []) as unknown as VarianceRow[]);

  // Available years
  const years = Array.from(new Set(rollup.map((r) => r.year))).sort(
    (a, b) => b - a
  );
  if (!years.includes(currentYear)) years.unshift(currentYear);

  // YTD totals
  const ytdDonations = rollup
    .filter((r) => r.year === currentYear)
    .reduce((s, r) => s + r.total_donations, 0);

  // Fund breakdown for pie chart
  const fundTotals: Record<string, number> = {};
  for (const r of rollup) {
    if (r.year === currentYear) {
      fundTotals[r.fund] = (fundTotals[r.fund] ?? 0) + r.total_donations;
    }
  }
  const fundData = Object.entries(fundTotals)
    .map(([fund, total]) => ({ fund, total }))
    .sort((a, b) => b.total - a.total);

  // Campus budget summary (annual budget = sum of all monthly budgeted_amount * 12? No — variance row is per-month already)
  // budget_variance rows are per fiscal_month per campus per fund.
  // Aggregate to per-campus for this year.
  const campusBudget: Record<string, { budgeted: number; actual: number }> = {};
  for (const r of variance) {
    if (!campusBudget[r.campus])
      campusBudget[r.campus] = { budgeted: 0, actual: 0 };
    campusBudget[r.campus].budgeted += r.budgeted_amount;
    campusBudget[r.campus].actual += r.actual_donations;
  }
  const totalBudgeted = Object.values(campusBudget).reduce(
    (s, v) => s + v.budgeted,
    0
  );

  const pctOfBudget =
    totalBudgeted > 0 ? (ytdDonations / totalBudgeted) * 100 : 0;

  const updatedAt = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Ordered campus list for table
  const campusKeys = [
    ...CAMPUS_ORDER.filter((c) => campusBudget[c]),
    ...Object.keys(campusBudget).filter((c) => !CAMPUS_ORDER.includes(c)),
  ];

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      {/* Header */}
      <div className="bg-blue-700 text-white px-6 py-5">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              TIF Financial Stewardship
            </h1>
            <p className="text-blue-200 text-sm mt-0.5">
              Taichung International Fellowship — {currentYear}
            </p>
          </div>
          {/* Year selector */}
          <div className="flex items-center gap-1.5">
            {years.map((y) => (
              <a
                key={y}
                href={`?year=${y}`}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  y === currentYear
                    ? "bg-white text-blue-700"
                    : "bg-blue-600 text-white hover:bg-blue-500"
                }`}
              >
                {y}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
              YTD Giving — {currentYear}
            </p>
            <p className="text-3xl font-bold text-emerald-700">
              {fmt(ytdDonations)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Total donations received
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
              Annual Budget Goal
            </p>
            <p className="text-3xl font-bold text-gray-800">
              {totalBudgeted > 0 ? fmt(totalBudgeted) : "—"}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Combined budgeted income
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
              Budget Progress
            </p>
            <p
              className={`text-3xl font-bold ${
                pctOfBudget >= 100 ? "text-emerald-700" : "text-blue-700"
              }`}
            >
              {totalBudgeted > 0 ? `${pctOfBudget.toFixed(0)}%` : "—"}
            </p>
            <div className="mt-2">
              {totalBudgeted > 0 &&
                pctBar(pctOfBudget, pctOfBudget >= 100)}
            </div>
          </div>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              Monthly Giving — {currentYear}
            </h2>
            <MonthlyDonationsChart data={rollup} year={currentYear} />
          </div>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              Giving by Fund — {currentYear}
            </h2>
            <FundBreakdownChart data={fundData} year={currentYear} />
          </div>
        </div>

        {/* Campus breakdown table */}
        {campusKeys.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">
                Campus Giving vs. Budget — {currentYear}
              </h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <th className="px-5 py-3 text-left font-semibold">Campus</th>
                  <th className="px-5 py-3 text-right font-semibold">
                    Annual Budget
                  </th>
                  <th className="px-5 py-3 text-right font-semibold">
                    YTD Actual
                  </th>
                  <th className="px-5 py-3 text-right font-semibold">
                    Progress
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {campusKeys.map((campus) => {
                  const v = campusBudget[campus];
                  const pct =
                    v.budgeted > 0 ? (v.actual / v.budgeted) * 100 : 0;
                  const over = v.actual >= v.budgeted && v.budgeted > 0;
                  return (
                    <tr key={campus} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 font-medium">{campus}</td>
                      <td className="px-5 py-3 text-right font-mono text-gray-600">
                        {v.budgeted > 0 ? fmt(v.budgeted) : "—"}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-semibold text-emerald-700">
                        {fmt(v.actual)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end">
                          {v.budgeted > 0
                            ? pctBar(pct, over)
                            : <span className="text-xs text-gray-400">—</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {/* Totals row */}
                {campusKeys.length > 1 && (
                  <tr className="bg-gray-50 font-semibold text-sm">
                    <td className="px-5 py-3">Total</td>
                    <td className="px-5 py-3 text-right font-mono">
                      {totalBudgeted > 0 ? fmt(totalBudgeted) : "—"}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-emerald-700">
                      {fmt(ytdDonations)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end">
                        {totalBudgeted > 0
                          ? pctBar(pctOfBudget, pctOfBudget >= 100)
                          : null}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty state */}
        {rollup.filter((r) => r.year === currentYear).length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-16 text-center">
            <p className="text-gray-500 text-sm">
              No giving data available for {currentYear} yet.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 pb-4 text-xs text-gray-400 border-t border-gray-100">
          <span>
            Financial data current as of {updatedAt}
          </span>
          <span className="text-gray-300">
            Taichung International Fellowship
          </span>
        </div>
      </div>
    </div>
  );
}
