import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

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

export default async function DonationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("donations");
  const supabase = await createClient();

  const { data: rawData } = await supabase
    .from("donations")
    .select(`
      id, gift_date, amount, payment_method, notes,
      donors ( display_name ),
      campuses ( name ),
      funds ( name )
    `)
    .is("deleted_at", null)
    .order("gift_date", { ascending: false })
    .limit(50);

  const donations = (rawData ?? []) as DonationRow[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Button asChild>
          <Link href={`/${locale}/donations/new`}>{t("newDonation")}</Link>
        </Button>
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
            </tr>
          </thead>
          <tbody className="divide-y">
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
