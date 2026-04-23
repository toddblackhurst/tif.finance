import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const supabase = await createClient();

  const currentYear = new Date().getFullYear();

  const [donationsResult, expensesResult, pendingResult] = await Promise.all([
    supabase
      .from("donations")
      .select("amount")
      .gte("gift_date", `${currentYear}-01-01`)
      .is("deleted_at", null),
    supabase
      .from("expenses")
      .select("amount")
      .gte("expense_date", `${currentYear}-01-01`)
      .is("deleted_at", null),
    supabase
      .from("expenses")
      .select("id", { count: "exact" })
      .eq("status", "submitted")
      .is("deleted_at", null),
  ]);

  const ytdDonations = ((donationsResult.data ?? []) as { amount: number }[]).reduce((s, r) => s + (r.amount ?? 0), 0);
  const ytdExpenses = ((expensesResult.data ?? []) as { amount: number }[]).reduce((s, r) => s + (r.amount ?? 0), 0);
  const pendingCount = pendingResult.count ?? 0;

  const fmt = (n: number) => `NT$${n.toLocaleString()}`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{t("ytdDonations")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmt(ytdDonations)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{t("ytdExpenses")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmt(ytdExpenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{t("pendingApprovals")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pendingCount}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
