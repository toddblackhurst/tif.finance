import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/filter-bar";

interface DonationRow {
  id: string;
  gift_date: string;
  amount: number;
  payment_method: string;
  notes: string | null;
  donors: { display_name: string } | null;
  campuses: { name: string } | null;
  funds: { name: string } | null;
}

interface CampusRow { id: string; name: string }

function parseMonth(m: string): { start: string; end: string } {
  const [y, mo] = m.split("-").map(Number);
  const start = `${y}-${String(mo).padStart(2, "0")}-01`;
  const end = mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, "0")}-01`;
  return { start, end };
}

export default async function DonationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ campus?: string; month?: string }>;
}) {
  const { locale } = await params;
  const { campus: campusFilter, month: monthFilter } = await searchParams;
  const t = await getTranslations("donations");
  const supabase = await createClient();

  const { data: campusData } = await supabase.from("campuses").select("id, name").order("name");
  const campuses = (campusData ?? []) as CampusRow[];

  let query = supabase
    .from("donations")
    .select(`
      id, gift_date, amount, payment_method, notes,
      donors ( display_name ),
      campuses ( name ),
      funds ( name )
    `)
    .is("deleted_at", null)
    .order("gift_date", { ascending: false })
    .limit(200);

  if (campusFilter) query = query.eq("campus_id", campusFilter);
  if (monthFilter) {
    const { start, end } = parseMonth(monthFilter);
    query = query.gte("gift_date", start).lt("gift_date", end);
  }

  const { data: rawData } = await query;
  const donations = (rawData ?? []) as DonationRow[];

  const totalAmount = donations.reduce((s, d) => s + d.amount, 0);
  const hasFilter = !!(campusFilter || monthFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <a
            href={`/api/export/donations?year=${new Date().getFullYear()}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            ↓ Export CSV
          </a>
          <Button asChild>
            <Link href={`/${locale}/donations/new`}>{t("newDonation")}</Link>
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Suspense>
          <FilterBar campuses={campuses} />
        </Suspense>
        {hasFilter && (
          <span className="text-sm text-gray-500">
            {donations.length} result{donations.length !== 1 ? "s" : ""} · NT${totalAmount.toLocaleString()}
          </span>
        )}
      </div>

      <div className="rounded-lg border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left">{t("giftDate")}</th>
              <th className="px-4 py-3 text-left">{t("donor")}</th>
              <th className="px-4 py-3 text-left">{t("campus")}</th>
              <th className="px-4 py-3 text-left">{t("fund")}</th>
              <th className="px-4 py-3 text-right">{t("amount")}</th>
              <th className="px-4 py-3 text-left">{t("paymentMethod")}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {donations.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No donations found.
                </td>
              </tr>
            )}
            {donations.map((d) => (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">{d.gift_date}</td>
                <td className="px-4 py-3">{d.donors?.display_name ?? "—"}</td>
                <td className="px-4 py-3">{d.campuses?.name ?? "—"}</td>
                <td className="px-4 py-3">{d.funds?.name ?? "—"}</td>
                <td className="px-4 py-3 text-right font-mono">
                  NT${d.amount.toLocaleString()}
                </td>
                <td className="px-4 py-3 capitalize">{d.payment_method}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/${locale}/donations/${d.id}/edit`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
          {donations.length > 0 && (
            <tfoot className="bg-gray-50 font-semibold text-sm border-t">
              <tr>
                <td colSpan={4} className="px-4 py-2 text-gray-600">
                  Total ({donations.length})
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  NT${totalAmount.toLocaleString()}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
