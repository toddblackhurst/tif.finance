import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RecentDonation {
  id: string;
  gift_date: string;
  amount: number;
  donors: { display_name: string } | null;
  campuses: { name: string } | null;
}

interface RecentExpense {
  id: string;
  expense_date: string;
  description: string;
  amount: number;
  status: string;
  campuses: { name: string } | null;
}

interface AuditRow {
  entity_id: string;
  after_snapshot: unknown;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  paid: "bg-purple-100 text-purple-700",
};

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("dashboard");
  const te = await getTranslations("expenses");
  const supabase = await createClient();
  const admin = createAdminClient();

  const currentYear = new Date().getFullYear();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profileData } = await supabase
    .from("user_profiles").select("role").eq("id", user?.id ?? "").single();
  const role = (profileData as { role: string } | null)?.role ?? "viewer";
  const canReviewExpenses = role === "admin" || role === "campus-finance";

  const [donationsResult, expensesResult, pendingResult, recentDonationsResult, recentExpensesResult, otherExpensesResult] =
    await Promise.all([
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
      supabase
        .from("donations")
        .select("id, gift_date, amount, donors ( display_name ), campuses ( name )")
        .is("deleted_at", null)
        .order("gift_date", { ascending: false })
        .limit(5),
      supabase
        .from("expenses")
        .select("id, expense_date, description, amount, status, campuses ( name )")
        .is("deleted_at", null)
        .order("expense_date", { ascending: false })
        .limit(5),
      canReviewExpenses
        ? supabase
            .from("expenses")
            .select("id, amount")
            .eq("category", "other")
            .is("deleted_at", null)
            .limit(500)
        : Promise.resolve({ data: [] }),
    ]);

  const ytdDonations = ((donationsResult.data ?? []) as { amount: number }[]).reduce(
    (s, r) => s + (r.amount ?? 0), 0
  );
  const ytdExpenses = ((expensesResult.data ?? []) as { amount: number }[]).reduce(
    (s, r) => s + (r.amount ?? 0), 0
  );
  const pendingCount = pendingResult.count ?? 0;

  const recentDonations = (recentDonationsResult.data ?? []) as unknown as RecentDonation[];
  const recentExpenses = (recentExpensesResult.data ?? []) as unknown as RecentExpense[];
  const otherExpenses = (otherExpensesResult.data ?? []) as { id: string; amount: number }[];
  const otherExpenseIds = otherExpenses.map((expense) => expense.id);
  let keptOtherIds = new Set<string>();
  if (otherExpenseIds.length > 0) {
    const { data: auditRows } = await admin
      .from("audit_log")
      .select("entity_id, after_snapshot")
      .eq("entity_type", "expense")
      .eq("action", "update")
      .in("entity_id", otherExpenseIds)
      .order("created_at", { ascending: false })
      .limit(1000);
    keptOtherIds = new Set(
      ((auditRows ?? []) as unknown as AuditRow[])
        .filter((row) => {
          const snapshot = row.after_snapshot as { category_review_status?: string } | null;
          return snapshot?.category_review_status === "kept_other";
        })
        .map((row) => row.entity_id)
    );
  }
  const otherNeedsReview = otherExpenses.filter((expense) => !keptOtherIds.has(expense.id));
  const otherNeedsReviewTotal = otherNeedsReview.reduce((sum, expense) => sum + (expense.amount ?? 0), 0);

  const fmt = (n: number) => `NT$${n.toLocaleString()}`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")} — {currentYear}</h1>

      {/* KPI Cards */}
      <div className={`grid grid-cols-1 gap-4 ${canReviewExpenses ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{t("ytdDonations")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-700">{fmt(ytdDonations)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{t("ytdExpenses")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-700">{fmt(ytdExpenses)}</p>
          </CardContent>
        </Card>
        <Card className={pendingCount > 0 ? "border-blue-300 bg-blue-50" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{t("pendingApprovals")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${pendingCount > 0 ? "text-blue-700" : ""}`}>
              {pendingCount}
            </p>
            {pendingCount > 0 && (
              <Link href={`/${locale}/expenses`} className="text-xs text-blue-600 hover:underline">
                Review →
              </Link>
            )}
          </CardContent>
        </Card>
        {canReviewExpenses && (
          <Card className={otherNeedsReview.length > 0 ? "border-amber-300 bg-amber-50" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Other Review</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${otherNeedsReview.length > 0 ? "text-amber-700" : ""}`}>
                {otherNeedsReview.length}
              </p>
              <p className="text-xs text-gray-500">{fmt(otherNeedsReviewTotal)}</p>
              {otherNeedsReview.length > 0 && (
                <Link href={`/${locale}/expense-review`} className="text-xs text-blue-600 hover:underline">
                  Review →
                </Link>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Donations */}
        <div className="bg-white rounded-lg border">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="font-semibold text-sm">{t("recentDonations")}</h2>
            <Link href={`/${locale}/donations`} className="text-xs text-blue-600 hover:underline">
              View all →
            </Link>
          </div>
          {recentDonations.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">No donations yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {recentDonations.map((d) => (
                <li key={d.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{d.donors?.display_name ?? "Anonymous"}</p>
                    <p className="text-xs text-gray-400">{d.gift_date} · {d.campuses?.name}</p>
                  </div>
                  <span className="font-mono font-medium">{fmt(d.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Expenses */}
        <div className="bg-white rounded-lg border">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="font-semibold text-sm">{t("recentExpenses")}</h2>
            <Link href={`/${locale}/expenses`} className="text-xs text-blue-600 hover:underline">
              View all →
            </Link>
          </div>
          {recentExpenses.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">No expenses yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {recentExpenses.map((e) => (
                <li key={e.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/${locale}/expenses/${e.id}`} className="font-medium hover:text-blue-600 truncate block">
                      {e.description}
                    </Link>
                    <p className="text-xs text-gray-400">{e.expense_date} · {e.campuses?.name}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[e.status] ?? ""}`}>
                      {te(`statuses.${e.status}`)}
                    </span>
                    <span className="font-mono font-medium">{fmt(e.amount)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
