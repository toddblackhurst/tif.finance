import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ExpenseForm } from "@/components/expense-form";

interface CampusRow { id: string; name: string }

export default async function NewExpensePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("expenses");
  const supabase = await createClient();

  const { data: campusData } = await supabase
    .from("campuses").select("id, name").order("name");

  const campuses = (campusData ?? []) as CampusRow[];

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
        <ExpenseForm locale={locale} campuses={campuses} />
      </div>
    </div>
  );
}
