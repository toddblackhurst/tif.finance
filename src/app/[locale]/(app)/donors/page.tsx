import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { FilterBar } from "@/components/filter-bar";

interface CampusRow { id: string; name: string }

// When no month filter: from donor_statistics view
interface StatRow {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  preferred_campus_id: string | null;
  preferred_campus: string | null;
  ytd_amount: number;
  lifetime_amount: number;
  gift_count: number;
  last_gift_date: string | null;
}

// When month filter: aggregated from donations + donors
interface PeriodRow {
  id: string;
  display_name: string;
  email: string | null;
  preferred_campus: string | null;
  period_amount: number;
  gift_count: number;
  last_gift_date: string | null;
}

const PAYMENT_METHODS = [
  { value: "", label: "All Methods" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "check", label: "Check" },
  { value: "other", label: "Other" },
] as const;

function parseMonth(m: string): { start: string; end: string; label: string } {
  const [y, mo] = m.split("-").map(Number);
  const start = `${y}-${String(mo).padStart(2, "0")}-01`;
  const end = mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, "0")}-01`;
  const label = new Date(y, mo - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
  return { start, end, label };
}

function methodHref(method: string, q?: string, campus?: string, month?: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (campus) params.set("campus", campus);
  if (month) params.set("month", month);
  if (method) params.set("method", method);
  return `?${params.toString()}`;
}

function pageHref(page: number, q?: string, campus?: string, month?: string, method?: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (campus) params.set("campus", campus);
  if (month) params.set("month", month);
  if (method) params.set("method", method);
  params.set("page", String(page));
  return `?${params.toString()}`;
}

export default async function DonorsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; campus?: string; month?: string; method?: string; page?: string }>;
}) {
  const { locale } = await params;
  const { q, campus: campusFilter, month: monthFilter, method: rawMethodFilter, page } = await searchParams;
  const t = await getTranslations("donors");
  const supabase = await createClient();
  const pageSize = 100;
  const currentPage = Math.max(1, Number(page) || 1);
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;
  const methodFilter = PAYMENT_METHODS.some((m) => m.value === rawMethodFilter) ? rawMethodFilter ?? "" : "";

  const { data: campusData } = await supabase.from("campuses").select("id, name").order("name");
  const campuses = (campusData ?? []) as CampusRow[];

  let periodLabel: string | null = null;
  let periodDonors: PeriodRow[] = [];
  let ytdDonors: StatRow[] = [];
  const isMethodView = !!methodFilter;
  const isMonthView = !!monthFilter || isMethodView;
  let totalRows = 0;

  if (isMonthView) {
    // ── Filtered view: aggregate donations for the period/method, grouped by donor ────
    const thisYear = new Date().getFullYear();
    const period = monthFilter
      ? parseMonth(monthFilter)
      : { start: `${thisYear}-01-01`, end: `${thisYear + 1}-01-01`, label: `${thisYear} YTD` };
    periodLabel = period.label;

    let donQuery = supabase
      .from("donations")
      .select("donor_id, amount, gift_date")
      .gte("gift_date", period.start)
      .lt("gift_date", period.end)
      .is("deleted_at", null)
      .not("donor_id", "is", null)
      .limit(2000);

    if (campusFilter) donQuery = donQuery.eq("campus_id", campusFilter);
    if (methodFilter) donQuery = donQuery.eq("payment_method", methodFilter);

    const { data: donRows } = await donQuery as {
      data: { donor_id: string | null; amount: number; gift_date: string }[] | null;
    };

    // Group amounts and gift count by donor_id
    const amountMap: Record<string, number> = {};
    const countMap: Record<string, number> = {};
    const lastDateMap: Record<string, string> = {};
    for (const r of donRows ?? []) {
      if (!r.donor_id) continue;
      amountMap[r.donor_id] = (amountMap[r.donor_id] ?? 0) + r.amount;
      countMap[r.donor_id] = (countMap[r.donor_id] ?? 0) + 1;
      if (!lastDateMap[r.donor_id] || r.gift_date > lastDateMap[r.donor_id])
        lastDateMap[r.donor_id] = r.gift_date;
    }

    const donorIds = Object.keys(amountMap);
    if (donorIds.length > 0) {
      let donorQuery = supabase
        .from("donors")
        .select("id, display_name, email, preferred_campus_id, campuses!preferred_campus_id ( name )")
        .in("id", donorIds)
        .is("deleted_at", null);

      if (q?.trim()) donorQuery = donorQuery.or(`display_name.ilike.%${q}%,email.ilike.%${q}%`);

      const { data: donorRows } = await donorQuery;
      const allPeriodDonors = ((donorRows ?? []) as {
        id: string; display_name: string; email: string | null;
        preferred_campus_id: string | null;
        campuses: { name: string } | null;
      }[]).map((d) => ({
        id: d.id,
        display_name: d.display_name,
        email: d.email,
        preferred_campus: d.campuses?.name ?? null,
        period_amount: amountMap[d.id] ?? 0,
        gift_count: countMap[d.id] ?? 0,
        last_gift_date: lastDateMap[d.id] ?? null,
      })).sort((a, b) => b.period_amount - a.period_amount);
      totalRows = allPeriodDonors.length;
      periodDonors = allPeriodDonors.slice(from, to + 1);
    }
  } else {
    // ── YTD view: use donor_statistics view ───────────────────────────────
    let query = supabase
      .from("donor_statistics")
      .select("*", { count: "exact" })
      .order("ytd_amount", { ascending: false })
      .range(from, to);

    if (campusFilter) query = query.eq("preferred_campus_id", campusFilter);
    if (q?.trim()) query = query.or(`display_name.ilike.%${q}%,email.ilike.%${q}%`);

    const { data, count } = await query;
    ytdDonors = (data ?? []) as StatRow[];
    totalRows = count ?? ytdDonors.length;
  }

  const displayCount = isMonthView ? periodDonors.length : ytdDonors.length;
  const periodTotal = isMonthView ? periodDonors.reduce((s, d) => s + d.period_amount, 0) : 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const firstVisible = totalRows === 0 ? 0 : from + 1;
  const lastVisible = from + displayCount;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <span className="text-sm text-gray-500">
          Showing {firstVisible}-{lastVisible} of {totalRows} donor{totalRows !== 1 ? "s" : ""}
          {isMonthView && periodTotal > 0 && ` · NT$${periodTotal.toLocaleString()}`}
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Suspense>
          <FilterBar campuses={campuses} />
        </Suspense>
        <form method="GET" className="flex items-center gap-2">
          {campusFilter && <input type="hidden" name="campus" value={campusFilter} />}
          {monthFilter && <input type="hidden" name="month" value={monthFilter} />}
          {methodFilter && <input type="hidden" name="method" value={methodFilter} />}
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder={t("searchPlaceholder")}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
          />
        </form>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        {PAYMENT_METHODS.map((method) => (
          <Link
            key={method.value || "all"}
            href={methodHref(method.value, q, campusFilter, monthFilter)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              methodFilter === method.value
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            {method.label}
          </Link>
        ))}
      </div>

      {isMonthView && periodLabel && (
        <p className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-2">
          Showing giving for <strong>{periodLabel}</strong>
          {methodFilter && (
            <> · {PAYMENT_METHODS.find((m) => m.value === methodFilter)?.label}</>
          )}
          {campusFilter && campuses.find(c => c.id === campusFilter) && (
            <> · {campuses.find(c => c.id === campusFilter)!.name}</>
          )}
        </p>
      )}

      <div className="rounded-lg border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left">{t("displayName")}</th>
              <th className="px-4 py-3 text-left">{t("email")}</th>
              <th className="px-4 py-3 text-left">{t("campus")}</th>
              <th className="px-4 py-3 text-right">
                {isMonthView ? "Period Giving" : t("ytdAmount")}
              </th>
              <th className="px-4 py-3 text-right">{t("giftCount")}</th>
              <th className="px-4 py-3 text-left">{t("lastGiftDate")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {displayCount === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No donors found.
                </td>
              </tr>
            )}

            {isMonthView
              ? periodDonors.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/${locale}/donors/${d.id}`} className="font-medium hover:text-blue-600">
                      {d.display_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{d.email ?? "—"}</td>
                  <td className="px-4 py-3">{d.preferred_campus ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono">NT${d.period_amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">{d.gift_count}</td>
                  <td className="px-4 py-3">{d.last_gift_date ?? "—"}</td>
                </tr>
              ))
              : ytdDonors.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/${locale}/donors/${d.id}`} className="font-medium hover:text-blue-600">
                      {d.display_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{d.email ?? "—"}</td>
                  <td className="px-4 py-3">{d.preferred_campus ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono">NT${(d.ytd_amount ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">{d.gift_count ?? 0}</td>
                  <td className="px-4 py-3">{d.last_gift_date ?? "—"}</td>
                </tr>
              ))
            }
          </tbody>
          {isMonthView && periodDonors.length > 0 && (
            <tfoot className="bg-gray-50 font-semibold text-sm border-t">
              <tr>
                <td colSpan={3} className="px-4 py-2 text-gray-600">Total ({periodDonors.length})</td>
                <td className="px-4 py-2 text-right font-mono">NT${periodTotal.toLocaleString()}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Page {currentPage} of {totalPages}</span>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link
                href={pageHref(currentPage - 1, q, campusFilter, monthFilter, methodFilter)}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-gray-700 hover:bg-gray-50"
              >
                Previous
              </Link>
            )}
            {currentPage < totalPages && (
              <Link
                href={pageHref(currentPage + 1, q, campusFilter, monthFilter, methodFilter)}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-gray-700 hover:bg-gray-50"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
