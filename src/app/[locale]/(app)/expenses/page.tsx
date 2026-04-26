import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/filter-bar";

interface ExpenseRow {
  id: string;
  expense_date: string;
  description: string;
  amount: number;
  status: string;
  category: string;
  campuses: { name: string } | null;
  funds: { name: string } | null;
}

interface CampusRow { id: string; name: string }

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  paid: "bg-purple-100 text-purple-700",
};

function parseMonth(m: string): { start: string; end: string } {
  const [y, mo] = m.split("-").map(Number);
  const start = `${y}-${String(mo).padStart(2, "0")}-01`;
  const end = mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, "0")}-01`;
  return { start, end };
}

export default async function ExpensesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; campus?: string; month?: string }>;
}) {
  const { locale } = await params;
  const { status: statusFilter, campus: campusFilter, month: monthFilter } = await searchParams;
  const t = await getTranslations("expenses");
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profileData } = await supabase
    .from("user_profiles").select("role").eq("id", user?.id ?? "").single();
  const role = (profileData as { role: string } | null)?.role ?? "viewer";
  const canSubmit = role === "admin" || role === "campus-finance";

  const { data: campusData } = await supabase.from("campuses").select("id, name").order("name");
  const campuses = (campusData ?? []) as CampusRow[];

  let query = supabase
    .from("expenses")
    .select(`
      id, expense_date, description, amount, status, category,
      campuses ( name ),
      funds ( name )
    `)
    .is("deleted_at", null)
    .order("expense_date", { ascending: false })
    .limit(200);

  if (statusFilter) query = query.eq("status", statusFilter);
  if (campusFilter) query = query.eq("campus_id", campusFilter);
  if (monthFilter) {
    const { start, end } = parseMonth(monthFilter);
    query = query.gte("expense_date", start).lt("expense_date", end);
  }

  const { data: rawData } = await query;
  const expenses = (rawData ?? []) as ExpenseRow[];

  const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);
  const hasFilter = !!(statusFilter || campusFilter || monthFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <a
            href={`/api/export/expenses?year=${new Date().getFullYear()}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            ↓ Export CSV
          </a>
          {canSubmit && (
            <Button asChild>
              <Link href={`/${locale}/expenses/new`}>{t("newExpense")}</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Suspense>
          <FilterBar campuses={campuses} showStatus />
        </Suspense>
        {hasFilter && (
          <span className="text-sm text-gray-500">
            {expenses.length} result{expenses.length !== 1 ? "s" : ""} · NT${totalAmount.toLocaleString()}
          </span>
        )}
      </div>

      <div className="rounded-lg border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left">{t("expenseDate")}</th>
              <th className="px-4 py-3 text-left">{t("description")}</th>
              <th className="px-4 py-3 text-left">{t("campus")}</th>
              <th className="px-4 py-3 text-left">{t("category")}</th>
              <th className="px-4 py-3 text-right">{t("amount")}</th>
              <th className="px-4 py-3 text-left">{t("status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {expenses.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No expenses found.
                </td>
              </tr>
            )}
            {expenses.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/${locale}/expenses/${e.id}`} className="block">
                    {e.expense_date}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/${locale}/expenses/${e.id}`} className="block font-medium hover:text-blue-600">
                    {e.description}
                  </Link>
                </td>
                <td className="px-4 py-3">{e.campuses?.name ?? "—"}</td>
                <td className="px-4 py-3">{t(`categories.${e.category}`)}</td>
                <td className="px-4 py-3 text-right font-mono">
                  NT${e.amount.toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[e.status] ?? ""}`}>
                    {t(`statuses.${e.status}`)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          {expenses.length > 0 && (
            <tfoot className="bg-gray-50 font-semibold text-sm border-t">
              <tr>
                <td colSpan={4} className="px-4 py-2 text-gray-600">
                  Total ({expenses.length})
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  NT${totalAmount.toLocaleString()}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
