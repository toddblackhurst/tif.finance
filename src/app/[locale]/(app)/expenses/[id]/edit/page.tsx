import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ExpenseForm } from "@/components/expense-form";

interface CampusRow { id: string; name: string }

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const t = await getTranslations("expenses");
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: profileData } = await supabase
    .from("user_profiles").select("role").eq("id", user.id).single();
  const role = (profileData as { role: string } | null)?.role ?? "viewer";
  if (role !== "admin" && role !== "campus-finance") redirect(`/${locale}/expenses/${id}`);

  const [{ data: rawExpense }, { data: campusData }] = await Promise.all([
    supabase
      .from("expenses")
      .select("id, description, category, expense_date, amount, campus_id, notes, status")
      .eq("id", id)
      .is("deleted_at", null)
      .single(),
    supabase.from("campuses").select("id, name").order("name"),
  ]);

  if (!rawExpense) notFound();

  const expense = rawExpense as {
    id: string;
    description: string;
    category: string;
    expense_date: string;
    amount: number;
    campus_id: string;
    notes: string | null;
    status: string;
  };

  const campuses = (campusData ?? []) as CampusRow[];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/${locale}/expenses/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← {t("title")}
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold">Edit Expense</h1>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <ExpenseForm
          locale={locale}
          campuses={campuses}
          editId={id}
          initialValues={{
            description: expense.description,
            category: expense.category,
            expense_date: expense.expense_date,
            amount: expense.amount,
            campus_id: expense.campus_id,
            notes: expense.notes,
          }}
        />
      </div>
    </div>
  );
}
