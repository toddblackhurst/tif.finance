import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

interface SummerBankLine {
  id: string;
  transaction_date: string;
  amount: number;
  description: string | null;
  account_identifier: string | null;
}

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

export default async function SummerPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { locale } = await params;
  const { month } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("bank_import_lines")
    .select("id, transaction_date, amount, description, account_identifier")
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1000);

  const monthRange = month ? parseMonth(month) : null;
  if (monthRange) {
    query = query.gte("transaction_date", monthRange.start).lt("transaction_date", monthRange.end);
  }

  const { data: rawLines } = await query;
  const lines = (rawLines ?? []) as SummerBankLine[];
  const income = lines.filter((line) => line.amount > 0).reduce((sum, line) => sum + line.amount, 0);
  const expenses = lines.filter((line) => line.amount < 0).reduce((sum, line) => sum + Math.abs(line.amount), 0);
  const net = income - expenses;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Summer</h1>
          <p className="text-sm text-gray-500">
            Bank-account income and expenses only.
          </p>
        </div>
        <form className="flex items-center gap-2" action="">
          <input
            type="month"
            name="month"
            defaultValue={monthRange ? month : ""}
            className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm"
          />
          <button
            type="submit"
            className="h-9 rounded-md bg-gray-900 px-3 text-sm font-medium text-white hover:bg-gray-800"
          >
            Filter
          </button>
          {monthRange && (
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
          <p className="mt-1 text-xl font-bold">{lines.length}</p>
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
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-left">Reference</th>
              <th className="px-4 py-3 text-right">Income</th>
              <th className="px-4 py-3 text-right">Expense</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lines.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                  No bank transactions found.
                </td>
              </tr>
            )}
            {lines.map((line) => {
              const isIncome = line.amount > 0;
              return (
                <tr key={line.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3">{line.transaction_date}</td>
                  <td className="px-4 py-3">{line.description ?? "-"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {line.account_identifier ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-green-700">
                    {isIncome ? fmt(line.amount) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-red-700">
                    {!isIncome ? fmt(Math.abs(line.amount)) : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
