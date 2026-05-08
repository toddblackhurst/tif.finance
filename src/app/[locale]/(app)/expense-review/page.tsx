import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OtherExpenseReviewRow } from "@/components/other-expense-review-row";

interface OtherExpenseRow {
  id: string;
  expense_date: string;
  description: string;
  amount: number;
  notes: string | null;
  status: string;
  campuses: { name: string } | null;
}

interface AuditRow {
  entity_id: string;
  after_snapshot: unknown;
  change_summary: string | null;
  created_at: string;
  actor: { full_name: string | null; email: string | null } | null;
}

const REVIEWED_STATUS = "kept_other";

function isReviewedAsOther(row: AuditRow) {
  const snapshot = row.after_snapshot as { category_review_status?: string } | null;
  return snapshot?.category_review_status === REVIEWED_STATUS;
}

export default async function ExpenseReviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("expenses");
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profile as { role: string } | null)?.role ?? "viewer";
  if (role !== "admin" && role !== "campus-finance") redirect(`/${locale}`);

  const { data: rawExpenses } = await supabase
    .from("expenses")
    .select("id, expense_date, description, amount, notes, status, campuses ( name )")
    .eq("category", "other")
    .is("deleted_at", null)
    .order("amount", { ascending: false })
    .limit(500);
  const expenses = (rawExpenses ?? []) as unknown as OtherExpenseRow[];

  const admin = createAdminClient();
  const expenseIds = expenses.map((expense) => expense.id);
  let auditRows: AuditRow[] = [];
  if (expenseIds.length > 0) {
    const { data } = await admin
      .from("audit_log")
      .select(`
        entity_id, after_snapshot, change_summary, created_at,
        actor:user_profiles ( full_name, email )
      `)
      .eq("entity_type", "expense")
      .eq("action", "update")
      .in("entity_id", expenseIds)
      .order("created_at", { ascending: false })
      .limit(1000);
    auditRows = (data ?? []) as unknown as AuditRow[];
  }

  const latestReviewByExpense = new Map<string, AuditRow>();
  for (const row of auditRows) {
    if (!latestReviewByExpense.has(row.entity_id) && isReviewedAsOther(row)) {
      latestReviewByExpense.set(row.entity_id, row);
    }
  }

  const reviewedIds = new Set(latestReviewByExpense.keys());
  const needsReview = expenses.filter((expense) => !reviewedIds.has(expense.id));
  const reviewedOther = expenses.filter((expense) => reviewedIds.has(expense.id));
  const needsReviewTotal = needsReview.reduce((sum, expense) => sum + expense.amount, 0);
  const reviewedTotal = reviewedOther.reduce((sum, expense) => sum + expense.amount, 0);

  const categoryLabels = {
    ministry: t("categories.ministry"),
    facilities: t("categories.facilities"),
    staffing: t("categories.staffing"),
    missions: t("categories.missions"),
    vbs: t("categories.vbs"),
    worship: t("categories.worship"),
    admin: t("categories.admin"),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Other Expense Review</h1>
          <p className="text-sm text-gray-500">
            Review visible expenses currently categorized as Other. Reclassify them when the purpose is clear, or mark them as intentionally left in Other.
          </p>
        </div>
        <Link
          href={`/${locale}/expenses`}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          All Expenses
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm font-medium text-gray-500">Needs review</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">{needsReview.length}</p>
          <p className="text-sm font-mono text-gray-500">NT${needsReviewTotal.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm font-medium text-gray-500">Kept as Other</p>
          <p className="mt-1 text-2xl font-bold text-slate-700">{reviewedOther.length}</p>
          <p className="text-sm font-mono text-gray-500">NT${reviewedTotal.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm font-medium text-gray-500">Visible Other total</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{expenses.length}</p>
          <p className="text-sm font-mono text-gray-500">NT${(needsReviewTotal + reviewedTotal).toLocaleString()}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold text-sm">Needs Review</h2>
          <p className="text-xs text-gray-500">Sorted by amount so the largest ambiguous expenses are handled first.</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Expense</th>
              <th className="px-4 py-3 text-left">Campus</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Review Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {needsReview.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No Other expenses need review.
                </td>
              </tr>
            )}
            {needsReview.map((expense) => (
              <OtherExpenseReviewRow
                key={expense.id}
                locale={locale}
                expense={expense}
                categoryLabels={categoryLabels}
              />
            ))}
          </tbody>
        </table>
      </div>

      {reviewedOther.length > 0 && (
        <div className="rounded-lg border bg-white overflow-hidden">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold text-sm">Reviewed and Left as Other</h2>
            <p className="text-xs text-gray-500">These remain in the Other category but no longer appear in the active review queue.</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Expense</th>
                <th className="px-4 py-3 text-left">Campus</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-left">Reviewed By</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {reviewedOther.map((expense) => {
                const review = latestReviewByExpense.get(expense.id);
                return (
                  <tr key={expense.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">{expense.expense_date}</td>
                    <td className="px-4 py-3">
                      <Link href={`/${locale}/expenses/${expense.id}`} className="font-medium hover:text-blue-600">
                        {expense.description}
                      </Link>
                      <p className="text-xs text-gray-500">{review?.change_summary ?? "Left as Other"}</p>
                    </td>
                    <td className="px-4 py-3">{expense.campuses?.name ?? "-"}</td>
                    <td className="px-4 py-3 text-right font-mono">NT${expense.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm">
                      {review?.actor?.full_name ?? review?.actor?.email ?? "Unknown"}
                      {review?.created_at && (
                        <span className="block text-xs text-gray-400">
                          {new Date(review.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
