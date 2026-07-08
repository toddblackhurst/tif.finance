import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/filter-bar";
import { SummerDeleteButton } from "@/components/summer-delete-button";

interface ExpenseRow {
  id: string;
  serial_number: string | null;
  expense_date: string;
  description: string;
  amount: number;
  status: string;
  category: string;
  payment_method: string | null;
  campuses: { name: string } | null;
  funds: { name: string } | null;
}

interface CampusRow { id: string; name: string }
const PAYMENT_METHOD_VALUES = ["cash", "card", "bank_transfer", "check", "other"] as const;
const SORT_VALUES = ["expense_date_desc", "expense_date_asc", "payment_method_asc"] as const;

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
  searchParams: Promise<{ status?: string; campus?: string; month?: string; method?: string; sort?: string }>;
}) {
  const { locale } = await params;
  const {
    status: statusFilter,
    campus: campusFilter,
    month: monthFilter,
    method: rawMethodFilter,
    sort: rawSort,
  } = await searchParams;
  const t = await getTranslations("expenses");
  const donationT = await getTranslations("donations");
  const supabase = await createClient();
  const sortLabel = locale === "zh-TW" ? "排序" : "Sort";
  const newestFirstLabel = locale === "zh-TW" ? "新到舊" : "Newest First";
  const oldestFirstLabel = locale === "zh-TW" ? "舊到新" : "Oldest First";
  const allPaymentMethodsLabel = locale === "zh-TW" ? "所有付款方式" : "All Payment Methods";
  const methodFilter = PAYMENT_METHOD_VALUES.includes(rawMethodFilter as typeof PAYMENT_METHOD_VALUES[number])
    ? rawMethodFilter as typeof PAYMENT_METHOD_VALUES[number]
    : "";
  const sort = SORT_VALUES.includes(rawSort as typeof SORT_VALUES[number]) ? rawSort : "";
  const paymentMethods = PAYMENT_METHOD_VALUES.map((method) => ({
    value: method,
    label: donationT(`paymentMethods.${method}`),
  }));
  const paymentMethodLabels: Record<string, string> = Object.fromEntries(
    paymentMethods.map((method) => [method.value, method.label])
  );
  const sortOptions = [
    { value: "expense_date_desc", label: `${t("expenseDate")} (${newestFirstLabel})` },
    { value: "expense_date_asc", label: `${t("expenseDate")} (${oldestFirstLabel})` },
    { value: "payment_method_asc", label: `${t("paymentMethod")} (A-Z)` },
  ];

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
      id, serial_number, expense_date, description, amount, status, category, payment_method,
      campuses ( name ),
      funds ( name )
    `)
    .is("deleted_at", null)
    .limit(200);

  if (statusFilter) query = query.eq("status", statusFilter);
  if (campusFilter) query = query.eq("campus_id", campusFilter);
  if (monthFilter) {
    const { start, end } = parseMonth(monthFilter);
    query = query.gte("expense_date", start).lt("expense_date", end);
  }
  if (methodFilter) query = query.eq("payment_method", methodFilter);
  if (sort === "expense_date_asc") {
    query = query
      .order("expense_date", { ascending: true })
      .order("created_at", { ascending: true });
  } else if (sort === "payment_method_asc") {
    query = query
      .order("payment_method", { ascending: true, nullsFirst: false })
      .order("expense_date", { ascending: false });
  } else {
    query = query
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });
  }

  const { data: rawData } = await query;
  const expenses = (rawData ?? []) as ExpenseRow[];

  const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);
  const hasFilter = !!(statusFilter || campusFilter || monthFilter || methodFilter || sort);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="flex items-center gap-2">
          {canSubmit && (
            <Link
              href={`/${locale}/expense-review`}
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 transition-colors"
            >
              Review Other
            </Link>
          )}
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
          <FilterBar
            campuses={campuses}
            showStatus
            paymentMethodMode="single"
            allPaymentMethodsLabel={allPaymentMethodsLabel}
            paymentMethodLabel={t("paymentMethod")}
            paymentMethods={paymentMethods}
            sortLabel={sortLabel}
            sortOptions={sortOptions}
          />
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
              <th className="px-4 py-3 text-left">{t("serialNumber")}</th>
              <th className="px-4 py-3 text-left">{t("description")}</th>
              <th className="px-4 py-3 text-left">{t("campus")}</th>
              <th className="px-4 py-3 text-left">{t("category")}</th>
              <th className="px-4 py-3 text-right">{t("amount")}</th>
              <th className="px-4 py-3 text-left">{t("paymentMethod")}</th>
              <th className="px-4 py-3 text-left">{t("status")}</th>
              {canSubmit && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {expenses.length === 0 && (
              <tr>
                <td colSpan={canSubmit ? 9 : 8} className="px-4 py-8 text-center text-gray-400">
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
                <td className="px-4 py-3 font-mono text-xs font-semibold uppercase text-gray-700">
                  {e.serial_number ?? "-"}
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
                  {e.payment_method ? paymentMethodLabels[e.payment_method] ?? e.payment_method : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[e.status] ?? ""}`}>
                    {t(`statuses.${e.status}`)}
                  </span>
                </td>
                {canSubmit && (
                  <td className="px-4 py-3 text-right">
                    <SummerDeleteButton
                      locale={locale}
                      recordId={e.id}
                      kind="expense"
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {expenses.length > 0 && (
            <tfoot className="bg-gray-50 font-semibold text-sm border-t">
              <tr>
                <td colSpan={5} className="px-4 py-2 text-gray-600">
                  Total ({expenses.length})
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  NT${totalAmount.toLocaleString()}
                </td>
                <td colSpan={canSubmit ? 3 : 2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
