import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ExpenseForm, type BankAccountOption } from "@/components/expense-form";

interface CampusRow { id: string; name: string }

export default async function NewExpensePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("expenses");
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: campusData } = await supabase
    .from("campuses").select("id, name").order("name");

  const campuses = (campusData ?? []) as CampusRow[];
  const { data: accountRows } = await supabase
    .from("expenses")
    .select("bank_code, bank_account_number")
    .eq("submitter_id", user.id)
    .eq("payment_type", "reimbursement")
    .not("bank_code", "is", null)
    .not("bank_account_number", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);

  const seenAccounts = new Set<string>();
  const bankAccountOptions = ((accountRows ?? []) as BankAccountOption[])
    .filter((option) => {
      const key = `${option.bank_code}|||${option.bank_account_number}`;
      if (seenAccounts.has(key)) return false;
      seenAccounts.add(key);
      return true;
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/${locale}/expenses`} className="text-sm text-gray-500 hover:text-gray-700">
          ← {t("title")}
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold">{t("newExpense")}</h1>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <ExpenseForm locale={locale} campuses={campuses} bankAccountOptions={bankAccountOptions} />
      </div>
    </div>
  );
}
