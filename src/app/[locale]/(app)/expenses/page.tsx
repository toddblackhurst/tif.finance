import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

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

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  paid: "bg-purple-100 text-purple-700",
};

export default async function ExpensesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("expenses");
  const supabase = await createClient();

  const { data: rawData } = await supabase
    .from("expenses")
    .select(`
      id, expense_date, description, amount, status, category,
      campuses ( name ),
      funds ( name )
    `)
    .is("deleted_at", null)
    .order("expense_date", { ascending: false })
    .limit(50);

  const expenses = (rawData ?? []) as ExpenseRow[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Button asChild>
          <Link href={`/${locale}/expenses/new`}>{t("newExpense")}</Link>
        </Button>
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
            {expenses.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">{e.expense_date}</td>
                <td className="px-4 py-3">{e.description}</td>
                <td className="px-4 py-3">{e.campuses?.name ?? "—"}</td>
                <td className="px-4 py-3">{e.category}</td>
                <td className="px-4 py-3 text-right font-mono">
                  NT${e.amount.toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[e.status] ?? ""}`}
                  >
                    {e.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
