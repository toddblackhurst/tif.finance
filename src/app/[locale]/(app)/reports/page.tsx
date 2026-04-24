import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonthlyDonationsChart } from "@/components/charts/monthly-donations-chart";
import { BudgetVarianceChart } from "@/components/charts/budget-variance-chart";
import { FundBreakdownChart } from "@/components/charts/fund-breakdown-chart";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<{ year?: string }>;
}) {
  const t = await getTranslations("reports");
  const supabase = await createClient();

  const sp = (await (searchParams ?? Promise.resolve({}))) as Record<string, string | undefined>;
  const currentYear = parseInt(sp.year ?? "") || new Date().getFullYear();

  const [rollupResult, varianceResult, expensesResult] = await Promise.all([
    supabase
      .from("monthly_campus_rollup")
      .select("*")
      .order("month", { ascending: true }),
    supabase
      .from("budget_variance")
      .select("*")
      .eq("fiscal_year", currentYear),
    supabase
      .from("expenses")
      .select("amount, category, expense_date")
      .in("status", ["paid", "approved"])
      .gte("expense_date", `${currentYear}-01-01`)
      .lte("expense_date", `${currentYear}-12-31`)
      .is("deleted_at", null),
  ]);

  type RollupRow = {
    campus: string; fund: string; year: number; month: number;
    total_donations: number; donation_count: number;
  };
  type VarianceRow = {
    campus: string; fund: string; fiscal_year: number; fiscal_month: number;
    budgeted_amount: number; actual_donations: number; variance: number;
  };
  type ExpenseRow = { amount: number; category: string; expense_date: string };

  const rollup     = (rollupResult.data    ?? []) as RollupRow[];
  const variance   = (varianceResult.data  ?? []) as VarianceRow[];
  const expenses   = (expensesResult.data  ?? []) as ExpenseRow[];

  // Fund breakdown: aggregate rollup by fund for current year
  const fundTotals: Record<string, number> = {};
  for (const r of rollup) {
    if (r.year === currentYear) {
      fundTotals[r.fund] = (fundTotals[r.fund] ?? 0) + r.total_donations;
    }
  }
  const fundData = Object.entries(fundTotals)
    .map(([fund, total]) => ({ fund, total }))
    .sort((a, b) => b.total - a.total);

  // YTD totals
  const ytdDonations = rollup
    .filter((r) => r.year === currentYear)
    .reduce((s, r) => s + r.total_donations, 0);
  const ytdExpenses = expenses.reduce((s, r) => s + r.amount, 0);

  // Budget totals for year
  const totalBudgeted = variance
    .reduce((s, r) => s + r.budgeted_amount, 0) / 12; // per-month * 12 already summed above

  // Budget variance summary per campus
  const campusBudget: Record<string, { budgeted: number; actual: number }> = {};
  for (const r of variance) {
    if (!campusBudget[r.campus]) campusBudget[r.campus] = { budgeted: 0, actual: 0 };
    campusBudget[r.campus].budgeted += r.budgeted_amount;
    campusBudget[r.campus].actual   += r.actual_donations;
  }

  // Expense breakdown by category
  const categoryTotals: Record<string, number> = {};
  for (const e of expenses) {
    categoryTotals[e.category] = (categoryTotals[e.category] ?? 0) + e.amount;
  }

  const fmt = (n: number) => `NT$${Math.round(n).toLocaleString()}`;

  // Available years (from rollup data)
  const years = Array.from(new Set(rollup.map((r) => r.year))).sort((a, b) => b - a);
  if (!years.includes(currentYear)) years.unshift(currentYear);

  // Current month summary rows
  const currentMonth = new Date().getMonth() + 1;
  const monthRollup = rollup
    .filter((r) => r.year === currentYear && r.month <= currentMonth)
    .sort((a, b) => b.month - a.month || a.campus.localeCompare(b.campus));

  return (
    <div className="space-y-8">
      {/* Header + year selector */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Year:</span>
          <div className="flex gap-1">
            {years.map((y) => (
              <a
                key={y}
                href={`?year=${y}`}
                className={`px-3 py-1 rounded-md border text-sm font-medium transition-colors ${
                  y === currentYear
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {y}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* KPI summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-gray-500 font-medium uppercase tracking-wide">
              YTD Donations
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-xl font-bold text-green-700">{fmt(ytdDonations)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-gray-500 font-medium uppercase tracking-wide">
              YTD Expenses
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-xl font-bold text-red-700">{fmt(ytdExpenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-gray-500 font-medium uppercase tracking-wide">
              Net Surplus
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className={`text-xl font-bold ${ytdDonations - ytdExpenses >= 0 ? "text-green-700" : "text-red-700"}`}>
              {fmt(ytdDonations - ytdExpenses)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-gray-500 font-medium uppercase tracking-wide">
              Annual Budget
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-xl font-bold text-gray-700">{fmt(totalBudgeted * 12)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly donations stacked bar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Monthly Donations — {currentYear}</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyDonationsChart data={rollup} year={currentYear} />
          </CardContent>
        </Card>

        {/* Fund breakdown donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">YTD by Fund — {currentYear}</CardTitle>
          </CardHeader>
          <CardContent>
            <FundBreakdownChart data={fundData} year={currentYear} />
          </CardContent>
        </Card>
      </div>

      {/* Budget vs Actual full width */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Budget vs. Actual Donations — {currentYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <BudgetVarianceChart data={variance} year={currentYear} />
        </CardContent>
      </Card>

      {/* Campus budget summary table */}
      <section>
        <h2 className="text-base font-semibold mb-3">Budget Variance by Campus — {currentYear}</h2>
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Campus</th>
                <th className="px-4 py-3 text-right">Annual Budget</th>
                <th className="px-4 py-3 text-right">YTD Actual</th>
                <th className="px-4 py-3 text-right">Variance</th>
                <th className="px-4 py-3 text-right">% of Budget</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {Object.entries(campusBudget)
                .sort((a, b) => b[1].budgeted - a[1].budgeted)
                .map(([campus, vals]) => {
                  const pct = vals.budgeted > 0 ? (vals.actual / vals.budgeted) * 100 : 0;
                  const over = vals.actual > vals.budgeted;
                  return (
                    <tr key={campus} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{campus}</td>
                      <td className="px-4 py-3 text-right font-mono">{fmt(vals.budgeted)}</td>
                      <td className="px-4 py-3 text-right font-mono">{fmt(vals.actual)}</td>
                      <td className={`px-4 py-3 text-right font-mono ${over ? "text-green-700" : "text-red-700"}`}>
                        {over ? "+" : ""}{fmt(vals.actual - vals.budgeted)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 bg-gray-200 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${pct > 100 ? "bg-green-500" : "bg-blue-500"}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          <span className={`text-xs font-medium w-10 text-right ${pct > 100 ? "text-green-700" : "text-gray-700"}`}>
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Expense category breakdown */}
      {Object.keys(categoryTotals).length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-3">Expenses by Category — {currentYear}</h2>
          <div className="rounded-lg border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">% of Expenses</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {Object.entries(categoryTotals)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, total]) => (
                    <tr key={cat} className="hover:bg-gray-50">
                      <td className="px-4 py-3 capitalize">{cat.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 text-right font-mono">{fmt(total)}</td>
                      <td className="px-4 py-3 text-right text-xs text-gray-600">
                        {ytdExpenses > 0 ? ((total / ytdExpenses) * 100).toFixed(1) : "0"}%
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Monthly detail table */}
      <section>
        <h2 className="text-base font-semibold mb-3">{t("monthlySummary")} — {currentYear}</h2>
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">{t("month")}</th>
                <th className="px-4 py-3 text-left">{t("campus")}</th>
                <th className="px-4 py-3 text-left">{t("fund")}</th>
                <th className="px-4 py-3 text-right">Gifts</th>
                <th className="px-4 py-3 text-right">{t("totalDonations")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {monthRollup.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{MONTH_NAMES[r.month]}</td>
                  <td className="px-4 py-3">{r.campus}</td>
                  <td className="px-4 py-3">{r.fund}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{r.donation_count}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {fmt(r.total_donations)}
                  </td>
                </tr>
              ))}
              {monthRollup.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No donation data for {currentYear}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
