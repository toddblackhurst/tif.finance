/**
 * Public Stewardship Dashboard — no authentication required.
 * Embedded as an iframe on taichunginternationalfellowship.org/stewardship-dashboard
 * URL: https://tif-finance.vercel.app/en/public  (or /zh-TW/public)
 *
 * Uses raw Supabase REST API fetch (confirmed working) rather than the JS client,
 * to ensure the service-role key is correctly sent in both apikey + Authorization headers.
 */
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { PublicMonthlyChart } from "@/components/charts/public-monthly-chart";
import { CampusBarChart } from "@/components/charts/campus-bar-chart";

export const dynamic = "force-dynamic";

// ─── Direct REST fetch (bypasses JS-client auth quirks) ──────────────────────
async function sbFetch<T>(path: string): Promise<T[]> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return [];
  try {
    const res = await fetch(`${base}/rest/v1/${path}`, {
      headers: {
        apikey:        key,
        Authorization: `Bearer ${key}`,
        Accept:        "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return [];
    return res.json() as Promise<T[]>;
  } catch {
    return [];
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────
type RollupRow = {
  campus: string; fund: string;
  year: number; month: number;
  total_donations: number; donation_count: number;
};
type VarianceRow = {
  campus: string; fund: string;
  fiscal_year: number; fiscal_month: number;
  budgeted_amount: number; actual_donations: number; variance: number;
};
type ExpenseRow = {
  amount: number; category: string; expense_date: string;
  campuses: { name: string } | null;
};

const CAMPUS_ORDER = [
  "TIF System","TIF North","TIF South","Hope Fellowship 盼望教會","All Praise",
];

function fmt(n: number) { return `NT$${Math.round(n).toLocaleString()}`; }
function fmtShort(n: number) {
  if (n >= 1_000_000) return `NT$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `NT$${(n / 1_000).toFixed(0)}K`;
  return fmt(n);
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default async function PublicDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ year?: string }>;
}) {
  const { locale } = await params;
  const sp = (await (searchParams ?? Promise.resolve({}))) as Record<string, string | undefined>;
  const currentYear = parseInt(sp.year ?? "") || new Date().getFullYear();
  const otherLocale = locale === "zh-TW" ? "en" : "zh-TW";

  const t = await getTranslations("publicDashboard");

  // ── Fetch all data ─────────────────────────────────────────────────────────
  const [rollup, variance, expenseRows] = await Promise.all([
    sbFetch<RollupRow>("monthly_campus_rollup?select=*&order=month.asc"),
    sbFetch<VarianceRow>(`budget_variance?select=*&fiscal_year=eq.${currentYear}`),
    sbFetch<ExpenseRow>(
      `expenses?select=amount,category,expense_date,campuses(name)` +
      `&status=in.(paid,approved)` +
      `&expense_date=gte.${currentYear}-01-01` +
      `&expense_date=lte.${currentYear}-12-31` +
      `&deleted_at=is.null`
    ),
  ]);

  // ── Aggregate: Donations ───────────────────────────────────────────────────
  const yearRollup = rollup.filter((r) => r.year === currentYear);

  const ytdDonations = yearRollup.reduce((s, r) => s + r.total_donations, 0);
  const totalDonationCount = yearRollup.reduce((s, r) => s + r.donation_count, 0);

  // Monthly donations (total all campuses)
  const monthlyDonations: Record<number, number> = {};
  for (const r of yearRollup) {
    monthlyDonations[r.month] = (monthlyDonations[r.month] ?? 0) + r.total_donations;
  }

  // Per-campus donation totals
  const campusDonationMap: Record<string, number> = {};
  for (const r of yearRollup) {
    campusDonationMap[r.campus] = (campusDonationMap[r.campus] ?? 0) + r.total_donations;
  }

  // Fund breakdown
  const fundTotals: Record<string, number> = {};
  for (const r of yearRollup) {
    fundTotals[r.fund] = (fundTotals[r.fund] ?? 0) + r.total_donations;
  }

  // ── Aggregate: Expenses ────────────────────────────────────────────────────
  const ytdExpenses = expenseRows.reduce((s, r) => s + r.amount, 0);

  // Monthly expenses
  const monthlyExpenses: Record<number, number> = {};
  for (const e of expenseRows) {
    const month = new Date(e.expense_date).getMonth() + 1;
    monthlyExpenses[month] = (monthlyExpenses[month] ?? 0) + e.amount;
  }

  // Per-campus expenses
  const campusExpenseMap: Record<string, number> = {};
  for (const e of expenseRows) {
    const name = e.campuses?.name ?? "Unknown";
    campusExpenseMap[name] = (campusExpenseMap[name] ?? 0) + e.amount;
  }

  // Category breakdown
  const categoryTotals: Record<string, number> = {};
  for (const e of expenseRows) {
    categoryTotals[e.category] = (categoryTotals[e.category] ?? 0) + e.amount;
  }

  // ── Aggregate: Budget ──────────────────────────────────────────────────────
  // TIF System holds central/shared budget items (ops, church care, fixed costs).
  // Campus entries hold per-campus variable allocations shown in the budget table.
  const campusBudget: Record<string, { budgeted: number; actual: number }> = {};
  let totalBudgeted = 0; // Central expense budget (TIF System only) — shown as "Annual Budget" KPI
  for (const r of variance) {
    if (r.campus === "TIF System") {
      totalBudgeted += r.budgeted_amount;
      continue;
    }
    if (!campusBudget[r.campus]) campusBudget[r.campus] = { budgeted: 0, actual: 0 };
    campusBudget[r.campus].budgeted += r.budgeted_amount;
    campusBudget[r.campus].actual   += r.actual_donations;
  }
  // Fallback: if no TIF System budget is set, sum all campuses
  if (totalBudgeted === 0)
    totalBudgeted = Object.values(campusBudget).reduce((s, v) => s + v.budgeted, 0);
  const totalCampusBudgeted = Object.values(campusBudget).reduce((s, v) => s + v.budgeted, 0);

  // ── Misc ───────────────────────────────────────────────────────────────────
  const ytdNet = ytdDonations - ytdExpenses;
  const campusCount = new Set(yearRollup.filter((r) => r.campus !== "TIF System").map((r) => r.campus)).size;
  const pctOfBudget = totalBudgeted > 0 ? (ytdExpenses / totalBudgeted) * 100 : 0;

  // % of year elapsed
  const now = new Date();
  const startOfYear = new Date(currentYear, 0, 1);
  const endOfYear   = new Date(currentYear + 1, 0, 1);
  const pctYearElapsed = Math.min(
    100,
    ((now.getTime() - startOfYear.getTime()) / (endOfYear.getTime() - startOfYear.getTime())) * 100
  );

  const updatedDate = now.toLocaleDateString(locale === "zh-TW" ? "zh-TW" : "en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  // Only show 2026 onwards — no historical data before launch
  const years = Array.from(new Set(rollup.map((r) => r.year)))
    .filter((y) => y >= 2026)
    .sort((a, b) => b - a);
  if (!years.includes(currentYear)) years.unshift(currentYear);

  // Chart data
  const campusDonationData = [
    ...CAMPUS_ORDER.filter((c) => campusDonationMap[c]),
    ...Object.keys(campusDonationMap).filter((c) => !CAMPUS_ORDER.includes(c)),
  ].map((campus) => ({ campus, total: campusDonationMap[campus] ?? 0 }))
   .filter((d) => d.total > 0)
   .sort((a, b) => b.total - a.total);

  const campusExpenseData = [
    ...CAMPUS_ORDER.filter((c) => campusExpenseMap[c]),
    ...Object.keys(campusExpenseMap).filter((c) => !CAMPUS_ORDER.includes(c)),
  ].map((campus) => ({ campus, total: campusExpenseMap[campus] ?? 0 }))
   .filter((d) => d.total > 0)
   .sort((a, b) => b.total - a.total);

  // Sorted campus list for detail cards
  const campusKeys = [
    ...CAMPUS_ORDER.filter((c) => campusDonationMap[c] || campusExpenseMap[c]),
    ...Object.keys({ ...campusDonationMap, ...campusExpenseMap })
      .filter((c) => !CAMPUS_ORDER.includes(c)),
  ];

  // Category rows sorted by total
  const categoryRows = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1]);

  const hasData = yearRollup.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 text-sm">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="text-white px-5 py-4" style={{backgroundColor:"#1b2327"}}>
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-semibold bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
                  {t("liveData")}
                </span>
              </div>
              <h1 className="text-lg font-bold">{t("orgName")}</h1>
              <p className="text-white/60 text-sm">{t("title")}</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Language toggle */}
              <Link
                href={`/${otherLocale}/public${sp.year ? `?year=${sp.year}` : ""}`}
                className="px-3 py-1.5 rounded-md text-sm font-semibold bg-white hover:bg-white/90 transition-colors" style={{color:"#1b2327"}}
              >
                {t("langToggle")}
              </Link>
              {/* Year selector */}
              {years.map((y) => (
                <a
                  key={y}
                  href={`?year=${y}`}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    y === currentYear
                      ? "text-white"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  {y}
                </a>
              ))}
            </div>
          </div>

          {/* Sub-header stats */}
          {hasData && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-white/50 text-xs">
              <span>{t("dataUpdatedTo")} {new Date().toISOString().slice(0, 10)}</span>
              <span>·</span>
              <span>{campusCount} {t("campuses")}</span>
              <span>·</span>
              <span>{totalDonationCount.toLocaleString()} {t("donationsCount")}</span>
              <span>·</span>
              <span>{t("updatedAt")} {updatedDate}</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-5 space-y-5">

        {!hasData ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white py-20 text-center text-gray-400">
            {t("noData")} {currentYear}
          </div>
        ) : (
          <>
            {/* ── KPI Cards ────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">{t("ytdGiving")}</p>
                <p className="text-2xl font-bold text-emerald-700">{fmtShort(ytdDonations)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t("ytdGivingDesc")}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">{t("ytdExpenses")}</p>
                <p className="text-2xl font-bold text-red-600">{fmtShort(ytdExpenses)}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {totalBudgeted > 0 ? `${pctOfBudget.toFixed(1)}% ${t("ytdExpensesDesc")}` : "—"}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">{t("ytdNet")}</p>
                <p className={`text-2xl font-bold ${ytdNet >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                  {ytdNet >= 0 ? "+" : ""}{fmtShort(ytdNet)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{t("ytdNetDesc")}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">{t("annualBudget")}</p>
                <p className="text-2xl font-bold text-gray-800">
                  {totalBudgeted > 0 ? fmtShort(totalBudgeted) : "—"}
                </p>
                {totalBudgeted > 0 && (
                  <div className="mt-1.5">
                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        style={{ backgroundColor:"#27b7d8", width: `${Math.min(pctYearElapsed, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {pctYearElapsed.toFixed(0)}% {t("yearElapsed")}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Monthly Chart ─────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">{t("monthlyChartTitle")} — {currentYear}</h2>
              <PublicMonthlyChart
                monthlyDonations={monthlyDonations}
                monthlyExpenses={monthlyExpenses}
                givingLabel={t("giving")}
                expensesLabel={t("expenses")}
                locale={locale}
              />
            </div>

            {/* ── Analysis: Campus Breakdown ────────────────────────────── */}
            <div>
              <h2 className="text-base font-bold text-gray-800 mb-3">{t("analysisSectionTitle")}</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Campus Donations */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">{t("campusGivingTitle")}</h3>
                  <p className="text-xs text-gray-400 mb-3">{t("campusGivingSubtitle")}</p>
                  <CampusBarChart data={campusDonationData} />
                </div>
                {/* Campus Expenses */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">{t("campusExpensesTitle")}</h3>
                  <p className="text-xs text-gray-400 mb-3">{t("campusExpensesSubtitle")}</p>
                  <CampusBarChart data={campusExpenseData} />
                </div>
              </div>
            </div>

            {/* ── Expense Categories ────────────────────────────────────── */}
            {categoryRows.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700">{t("expenseCategoriesTitle")}</h3>
                  <p className="text-xs text-gray-400">{t("expenseCategoriesSubtitle")} {fmt(ytdExpenses)}</p>
                </div>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-100">
                    {categoryRows.map(([cat, total]) => {
                      const pct = ytdExpenses > 0 ? (total / ytdExpenses) * 100 : 0;
                      // Translate category name
                      const catKey = cat as keyof typeof tCategories;
                      const tCategories: Record<string, string> = {
                        ministry: t("categories.ministry"),
                        facilities: t("categories.facilities"),
                        staffing: t("categories.staffing"),
                        missions: t("categories.missions"),
                        vbs: t("categories.vbs"),
                        worship: t("categories.worship"),
                        admin: t("categories.admin"),
                        other: t("categories.other"),
                      };
                      const catLabel = tCategories[catKey] ?? cat.replace(/_/g, " ");
                      return (
                        <tr key={cat} className="hover:bg-gray-50">
                          <td className="px-5 py-2.5 capitalize">{catLabel}</td>
                          <td className="px-5 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="h-1.5 rounded-full bg-red-400"
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 w-8 text-right">{pct.toFixed(0)}%</span>
                            </div>
                          </td>
                          <td className="px-5 py-2.5 text-right font-mono font-medium">{fmt(total)}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-5 py-2.5">{t("total")}</td>
                      <td />
                      <td className="px-5 py-2.5 text-right font-mono">{fmt(ytdExpenses)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Campus Detail Cards ───────────────────────────────────── */}
            <div>
              <h2 className="text-base font-bold text-gray-800 mb-3">{t("campusReportsTitle")}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {campusKeys.map((campus) => {
                  const don = campusDonationMap[campus] ?? 0;
                  const exp = campusExpenseMap[campus] ?? 0;
                  const net = don - exp;
                  return (
                    <div key={campus} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                      <h3 className="font-semibold text-gray-800 text-sm mb-3 pb-2 border-b border-gray-100">
                        {campus}
                      </h3>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">{t("ytdGiving")}</span>
                          <span className="font-mono font-semibold text-emerald-700">{fmt(don)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">{t("ytdExpenses")}</span>
                          <span className="font-mono font-semibold text-red-600">{fmt(exp)}</span>
                        </div>
                        <div className="flex justify-between text-xs border-t border-gray-100 pt-2 mt-2">
                          <span className="text-gray-700 font-medium">{t("net")}</span>
                          <span className={`font-mono font-bold ${net >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                            {net >= 0 ? "+" : ""}{fmt(net)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Budget Table ──────────────────────────────────────────── */}
            {Object.keys(campusBudget).length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700">{t("budgetTableTitle")}</h3>
                  <p className="text-xs text-gray-400">{t("budgetTableSubtitle")}</p>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                      <th className="px-5 py-3 text-left font-semibold">{t("campus")}</th>
                      <th className="px-5 py-3 text-right font-semibold">{t("allocationPct")}</th>
                      <th className="px-5 py-3 text-right font-semibold">{t("usage")}</th>
                      <th className="px-5 py-3 text-right font-semibold">{t("ytdSpent")}</th>
                      <th className="px-5 py-3 text-right font-semibold">{t("remaining")}</th>
                      <th className="px-5 py-3 text-right font-semibold">{t("utilizationRate")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      ...CAMPUS_ORDER.filter((c) => campusBudget[c]),
                      ...Object.keys(campusBudget).filter((c) => !CAMPUS_ORDER.includes(c)),
                    ].map((campus) => {
                      const v = campusBudget[campus];
                      const pct = v.budgeted > 0 ? (v.actual / v.budgeted) * 100 : 0;
                      const remaining = v.budgeted - v.actual;
                      const allocPct = totalCampusBudgeted > 0 ? (v.budgeted / totalCampusBudgeted) * 100 : 0;
                      return (
                        <tr key={campus} className="hover:bg-gray-50">
                          <td className="px-5 py-2.5 font-medium">{campus}</td>
                          <td className="px-5 py-2.5 text-right text-gray-500">{allocPct.toFixed(1)}%</td>
                          <td className="px-5 py-2.5">
                            <div className="flex justify-end items-center gap-1.5">
                              <div className="w-16 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-1.5 rounded-full ${pct > 80 ? "bg-red-400" : "bg-blue-500"}`}
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-2.5 text-right font-mono">{fmt(v.actual)}</td>
                          <td className={`px-5 py-2.5 text-right font-mono ${remaining < 0 ? "text-red-600" : ""}`}>
                            {fmt(Math.abs(remaining))}{remaining < 0 ? " ↑" : ""}
                          </td>
                          <td className="px-5 py-2.5 text-right font-semibold">{pct.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-5 py-2.5">{t("total")}</td>
                      <td className="px-5 py-2.5 text-right">100%</td>
                      <td />
                      <td className="px-5 py-2.5 text-right font-mono">
                        {fmt(Object.values(campusBudget).reduce((s, v) => s + v.actual, 0))}
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono">
                        {fmt(totalCampusBudgeted - Object.values(campusBudget).reduce((s, v) => s + v.actual, 0))}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        {totalCampusBudgeted > 0
                          ? `${(Object.values(campusBudget).reduce((s, v) => s + v.actual, 0) / totalCampusBudgeted * 100).toFixed(1)}%`
                          : "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <p className="text-center text-xs text-gray-400 py-3 border-t border-gray-200">
          {t("footer")}
        </p>
      </div>
    </div>
  );
}
