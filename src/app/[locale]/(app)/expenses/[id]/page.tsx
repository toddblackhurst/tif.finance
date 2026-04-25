import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ExpenseActionPanel } from "@/components/expense-action-panel";

interface ExpenseDetail {
  id: string;
  description: string;
  category: string;
  expense_date: string;
  amount: number;
  status: string;
  notes: string | null;
  approval_notes: string | null;
  approved_at: string | null;
  paid_at: string | null;
  submitter_id: string | null;
  submitter_name: string | null;
  submitter_email: string | null;
  campuses: { name: string } | null;
  funds: { name: string } | null;
  submitter: { full_name: string | null; email: string | null } | null;
  approver: { full_name: string | null; email: string | null } | null;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  paid: "bg-purple-100 text-purple-700",
};

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const t = await getTranslations("expenses");
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: profileData } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profileData as { role: string } | null)?.role ?? "viewer";

  const { data: rawExpense } = await supabase
    .from("expenses")
    .select(`
      id, description, category, expense_date, amount, status,
      notes, approval_notes, approved_at, paid_at,
      submitter_id, submitter_name, submitter_email,
      campuses ( name ),
      funds ( name ),
      submitter:user_profiles!expenses_submitter_id_fkey ( full_name, email ),
      approver:user_profiles!expenses_approver_id_fkey ( full_name, email )
    `)
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!rawExpense) notFound();
  const expense = rawExpense as unknown as ExpenseDetail;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href={`/${locale}/expenses`} className="text-sm text-gray-500 hover:text-gray-700">
          ← {t("title")}
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold">{expense.description}</h1>
      </div>

      <div className="bg-white rounded-lg border divide-y">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between">
          <span className={`inline-flex items-center px-2.5 py-1 rounded text-sm font-medium ${STATUS_COLORS[expense.status] ?? ""}`}>
            {t(`statuses.${expense.status}`)}
          </span>
          <span className="text-xl font-semibold font-mono">
            NT${expense.amount.toLocaleString()}
          </span>
        </div>

        {/* Details grid */}
        <div className="px-6 py-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">{t("expenseDate")}</p>
            <p className="font-medium">{expense.expense_date}</p>
          </div>
          <div>
            <p className="text-gray-500">{t("category")}</p>
            <p className="font-medium capitalize">{t(`categories.${expense.category}`)}</p>
          </div>
          <div>
            <p className="text-gray-500">{t("campus")}</p>
            <p className="font-medium">{expense.campuses?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-gray-500">{t("fund")}</p>
            <p className="font-medium">{expense.funds?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-gray-500">Submitted by</p>
            <p className="font-medium">
              {expense.submitter?.full_name ??
               expense.submitter_name ??
               expense.submitter?.email ??
               expense.submitter_email ??
               "Church member"}
            </p>
            {(expense.submitter_email && !expense.submitter_id) && (
              <p className="text-xs text-gray-400">{expense.submitter_email}</p>
            )}
          </div>
          {expense.approver && (
            <div>
              <p className="text-gray-500">
                {expense.status === "rejected" ? "Rejected by" : "Approved by"}
              </p>
              <p className="font-medium">
                {expense.approver.full_name ?? expense.approver.email ?? "—"}
              </p>
            </div>
          )}
        </div>

        {expense.notes && (
          <div className="px-6 py-4 text-sm">
            <p className="text-gray-500">{t("notes")}</p>
            <p className="mt-1">{expense.notes}</p>
          </div>
        )}

        {expense.approval_notes && (
          <div className="px-6 py-4 text-sm">
            <p className="text-gray-500">{t("approvalNotes")}</p>
            <p className="mt-1">{expense.approval_notes}</p>
          </div>
        )}
      </div>

      {/* Approval actions */}
      <ExpenseActionPanel
        locale={locale}
        expenseId={expense.id}
        status={expense.status}
        role={role}
        currentUserId={user.id}
        submitterId={expense.submitter_id ?? ""}
      />
    </div>
  );
}
