import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { SummerDeleteButton } from "@/components/summer-delete-button";

type SourceFilter = "all" | "bank" | "cash";
type FlowFilter = "all" | "income" | "expense";

interface BankLine {
  id: string;
  import_batch_id: string;
  transaction_date: string;
  amount: number;
  description: string | null;
  account_identifier: string | null;
  match_status: "unmatched" | "matched" | "ignored";
}

interface CashDonationLine {
  id: string;
  gift_date: string;
  amount: number;
  notes: string | null;
  donors: { display_name: string } | null;
  campuses: { name: string } | null;
  funds: { name: string } | null;
}

interface CashExpenseLine {
  id: string;
  expense_date: string;
  description: string;
  amount: number;
  status: string;
  category: string;
  campuses: { name: string } | null;
  funds: { name: string } | null;
}

interface SummerRow {
  id: string;
  recordId: string;
  date: string;
  source: "bank" | "cash";
  flow: "income" | "expense";
  label: string;
  description: string;
  reference: string;
  detail: string;
  amount: number;
  href: string | null;
  deleteKind: "bank" | "donation" | "expense";
}

const SOURCE_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: "all", label: "All Sources" },
  { value: "bank", label: "Bank Only" },
  { value: "cash", label: "Cash Only" },
];

const FLOW_OPTIONS: { value: FlowFilter; label: string }[] = [
  { value: "all", label: "All Flow" },
  { value: "income", label: "Income Only" },
  { value: "expense", label: "Expense Only" },
];

const EXPENSE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
};

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  ministry: "Ministry",
  facilities: "Facilities",
  staffing: "Staffing",
  missions: "Missions",
  vbs: "VBS",
  worship: "Worship",
  admin: "Administration",
  other: "Other",
};

function parseMonth(month: string): { start: string; end: string } | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const [year, monthIndex] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthIndex - 1, 1));
  const end = new Date(Date.UTC(year, monthIndex, 1));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function fmt(amount: number) {
  return `NT$${Math.round(amount).toLocaleString()}`;
}

function normalizeSource(value: string | undefined): SourceFilter {
  return SOURCE_OPTIONS.some((option) => option.value === value) ? (value as SourceFilter) : "all";
}

function normalizeFlow(value: string | undefined): FlowFilter {
  return FLOW_OPTIONS.some((option) => option.value === value) ? (value as FlowFilter) : "all";
}

function matchesSearch(row: SummerRow, q: string) {
  if (!q) return true;
  const search = q.toLowerCase();
  return [row.label, row.description, row.reference, row.detail]
    .join(" ")
    .toLowerCase()
    .includes(search);
}

function sourceBadge(source: SummerRow["source"]) {
  return source === "bank"
    ? "bg-blue-50 text-blue-700 border-blue-200"
    : "bg-amber-50 text-amber-700 border-amber-200";
}

function flowBadge(flow: SummerRow["flow"]) {
  return flow === "income"
    ? "bg-green-50 text-green-700 border-green-200"
    : "bg-red-50 text-red-700 border-red-200";
}

export default async function SummerPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ month?: string; source?: string; flow?: string; q?: string }>;
}) {
  const { locale } = await params;
  const {
    month,
    source: rawSource,
    flow: rawFlow,
    q: rawQuery,
  } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profileData } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single();
  const role = (profileData as { role: string } | null)?.role ?? "viewer";
  const canDelete = role === "admin" || role === "campus-finance";

  const source = normalizeSource(rawSource);
  const flow = normalizeFlow(rawFlow);
  const q = rawQuery?.trim() ?? "";
  const monthRange = month ? parseMonth(month) : null;
  const showBank = source !== "cash";
  const showCash = source !== "bank";

  let bankQuery = supabase
    .from("bank_import_lines")
    .select("id, import_batch_id, transaction_date, amount, description, account_identifier, match_status")
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);

  if (monthRange) {
    bankQuery = bankQuery.gte("transaction_date", monthRange.start).lt("transaction_date", monthRange.end);
  }
  if (flow === "income") bankQuery = bankQuery.gt("amount", 0);
  if (flow === "expense") bankQuery = bankQuery.lt("amount", 0);

  let donationQuery = supabase
    .from("donations")
    .select(`
      id, gift_date, amount, notes,
      donors ( display_name ),
      campuses ( name ),
      funds ( name )
    `)
    .eq("payment_method", "cash")
    .is("deleted_at", null)
    .order("gift_date", { ascending: false })
    .limit(500);

  if (monthRange) {
    donationQuery = donationQuery.gte("gift_date", monthRange.start).lt("gift_date", monthRange.end);
  }

  let expenseQuery = supabase
    .from("expenses")
    .select(`
      id, expense_date, description, amount, status, category,
      campuses ( name ),
      funds ( name )
    `)
    .eq("payment_method", "cash")
    .is("deleted_at", null)
    .order("expense_date", { ascending: false })
    .limit(500);

  if (monthRange) {
    expenseQuery = expenseQuery.gte("expense_date", monthRange.start).lt("expense_date", monthRange.end);
  }

  const [bankResult, donationResult, expenseResult] = await Promise.all([
    showBank ? bankQuery : Promise.resolve({ data: [] as BankLine[] }),
    showCash && flow !== "expense" ? donationQuery : Promise.resolve({ data: [] as CashDonationLine[] }),
    showCash && flow !== "income" ? expenseQuery : Promise.resolve({ data: [] as CashExpenseLine[] }),
  ]);

  const bankRows = ((bankResult.data ?? []) as BankLine[]).map((line): SummerRow => ({
    id: `bank-${line.id}`,
    recordId: line.id,
    date: line.transaction_date,
    source: "bank",
    flow: line.amount > 0 ? "income" : "expense",
    label: "Bank",
    description: line.description?.trim() || "Bank transaction",
    reference: line.account_identifier?.trim() || "—",
    detail: line.match_status,
    amount: Math.abs(line.amount),
    href: `/${locale}/bank/${line.import_batch_id}`,
    deleteKind: "bank",
  }));

  const cashDonationRows = ((donationResult.data ?? []) as CashDonationLine[]).map((line): SummerRow => ({
    id: `donation-${line.id}`,
    recordId: line.id,
    date: line.gift_date,
    source: "cash",
    flow: "income",
    label: "Cash Donation",
    description: line.donors?.display_name ?? "Cash donation",
    reference: [line.campuses?.name, line.funds?.name].filter(Boolean).join(" • ") || "Cash receipt",
    detail: line.notes?.trim() || "Recorded donation",
    amount: line.amount,
    href: `/${locale}/donations/${line.id}/edit`,
    deleteKind: "donation",
  }));

  const cashExpenseRows = ((expenseResult.data ?? []) as CashExpenseLine[]).map((line): SummerRow => ({
    id: `expense-${line.id}`,
    recordId: line.id,
    date: line.expense_date,
    source: "cash",
    flow: "expense",
    label: "Cash Expense",
    description: line.description,
    reference: [line.campuses?.name, line.funds?.name || EXPENSE_CATEGORY_LABELS[line.category] || line.category]
      .filter(Boolean)
      .join(" • ") || "Cash expense",
    detail: EXPENSE_STATUS_LABELS[line.status] ?? line.status,
    amount: line.amount,
    href: `/${locale}/expenses/${line.id}`,
    deleteKind: "expense",
  }));

  const rows = [...bankRows, ...cashDonationRows, ...cashExpenseRows]
    .filter((row) => matchesSearch(row, q))
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.id < b.id ? 1 : -1;
    });

  const income = rows
    .filter((row) => row.flow === "income")
    .reduce((sum, row) => sum + row.amount, 0);
  const expenses = rows
    .filter((row) => row.flow === "expense")
    .reduce((sum, row) => sum + row.amount, 0);
  const net = income - expenses;
  const hasFilter = !!(monthRange || source !== "all" || flow !== "all" || q);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Summer</h1>
          <p className="text-sm text-gray-500">
            Combined bank-import rows plus recorded cash donations and cash expenses.
          </p>
        </div>
        <form className="flex flex-wrap items-center gap-2" action={`/${locale}/summer`}>
          <input
            type="month"
            name="month"
            defaultValue={monthRange ? month : ""}
            className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm"
          />
          <select
            name="source"
            defaultValue={source}
            className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700"
          >
            {SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            name="flow"
            defaultValue={flow}
            className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700"
          >
            {FLOW_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search description, reference, or notes"
            className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm w-64"
          />
          <button
            type="submit"
            className="h-9 rounded-md bg-gray-900 px-3 text-sm font-medium text-white hover:bg-gray-800"
          >
            Filter
          </button>
          {hasFilter && (
            <Link
              href={`/${locale}/summer`}
              className="h-9 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Clear
            </Link>
          )}
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Rows</p>
          <p className="mt-1 text-xl font-bold">{rows.length}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-green-700">Income</p>
          <p className="mt-1 text-xl font-bold text-green-700">{fmt(income)}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-red-700">Expenses</p>
          <p className="mt-1 text-xl font-bold text-red-700">{fmt(expenses)}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Net</p>
          <p className={`mt-1 text-xl font-bold ${net < 0 ? "text-red-700" : "text-green-700"}`}>
            {fmt(net)}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Source</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-left">Reference</th>
              <th className="px-4 py-3 text-left">Detail</th>
              <th className="px-4 py-3 text-right">Income</th>
              <th className="px-4 py-3 text-right">Expense</th>
              {canDelete && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 && (
              <tr>
                <td colSpan={canDelete ? 9 : 8} className="px-4 py-10 text-center text-gray-500">
                  No Summer transactions found for the current filters.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3">{row.date}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${sourceBadge(row.source)}`}>
                    {row.source === "bank" ? "Bank" : "Cash"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${flowBadge(row.flow)}`}>
                    {row.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {row.href ? (
                    <Link href={row.href} className="font-medium hover:text-blue-600">
                      {row.description}
                    </Link>
                  ) : (
                    row.description
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">{row.reference}</td>
                <td className="px-4 py-3 capitalize text-gray-500">{row.detail}</td>
                <td className="px-4 py-3 text-right font-mono text-green-700">
                  {row.flow === "income" ? fmt(row.amount) : "-"}
                </td>
                <td className="px-4 py-3 text-right font-mono text-red-700">
                  {row.flow === "expense" ? fmt(row.amount) : "-"}
                </td>
                {canDelete && (
                  <td className="px-4 py-3 text-right">
                    <SummerDeleteButton
                      locale={locale}
                      recordId={row.recordId}
                      kind={row.deleteKind}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
