import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

interface DonorRow {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  preferred_campus_id: string | null;
  preferred_campus: { name: string } | null;
  created_at: string;
}

interface GiftRow {
  id: string;
  gift_date: string;
  amount: number;
  payment_method: string;
  campuses: { name: string } | null;
  funds: { name: string } | null;
  notes: string | null;
}

export default async function DonorDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const t = await getTranslations("donors");
  const supabase = await createClient();

  const [{ data: rawDonor }, { data: rawGifts }, { data: rawStats }] = await Promise.all([
    supabase
      .from("donors")
      .select("id, display_name, email, phone, notes, preferred_campus_id, created_at")
      .eq("id", id)
      .is("deleted_at", null)
      .is("merged_into_id", null)
      .single(),
    supabase
      .from("donations")
      .select("id, gift_date, amount, payment_method, notes, campuses ( name ), funds ( name )")
      .eq("donor_id", id)
      .is("deleted_at", null)
      .order("gift_date", { ascending: false })
      .limit(50),
    supabase
      .from("donor_statistics")
      .select("ytd_amount, lifetime_amount, gift_count, last_gift_date")
      .eq("id", id)
      .single(),
  ]);

  if (!rawDonor) notFound();

  const donor = rawDonor as unknown as DonorRow;
  const gifts = (rawGifts ?? []) as unknown as GiftRow[];
  const stats = rawStats as {
    ytd_amount: number;
    lifetime_amount: number;
    gift_count: number;
    last_gift_date: string | null;
  } | null;

  const fmt = (n: number) => `NT$${(n ?? 0).toLocaleString()}`;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href={`/${locale}/donors`} className="text-sm text-gray-500 hover:text-gray-700">
          ← {t("title")}
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold">{donor.display_name}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Contact info */}
        <div className="bg-white rounded-lg border p-5 space-y-3 text-sm">
          <h2 className="font-semibold text-gray-700">Contact</h2>
          <div className="grid grid-cols-2 gap-2">
            <span className="text-gray-500">{t("email")}</span>
            <span>{donor.email ?? "—"}</span>
            <span className="text-gray-500">{t("phone")}</span>
            <span>{donor.phone ?? "—"}</span>
            <span className="text-gray-500">{t("campus")}</span>
            <span>{(donor as unknown as { preferred_campus: { name: string } | null }).preferred_campus?.name ?? "—"}</span>
          </div>
          {donor.notes && (
            <div>
              <p className="text-gray-500 mb-1">Notes</p>
              <p>{donor.notes}</p>
            </div>
          )}
        </div>

        {/* Giving stats */}
        <div className="bg-white rounded-lg border p-5 space-y-3 text-sm">
          <h2 className="font-semibold text-gray-700">Giving Summary</h2>
          <div className="grid grid-cols-2 gap-2">
            <span className="text-gray-500">{t("ytdAmount")}</span>
            <span className="font-mono font-semibold">{fmt(stats?.ytd_amount ?? 0)}</span>
            <span className="text-gray-500">Lifetime giving</span>
            <span className="font-mono font-semibold">{fmt(stats?.lifetime_amount ?? 0)}</span>
            <span className="text-gray-500">{t("giftCount")}</span>
            <span>{stats?.gift_count ?? 0}</span>
            <span className="text-gray-500">{t("lastGiftDate")}</span>
            <span>{stats?.last_gift_date ?? "—"}</span>
          </div>
        </div>
      </div>

      {/* Gift history */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold text-sm">Gift History</h2>
        </div>
        {gifts.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">No gifts recorded.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Campus</th>
                <th className="px-4 py-2 text-left">Fund</th>
                <th className="px-4 py-2 text-left">Method</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {gifts.map((g) => (
                <tr key={g.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">{g.gift_date}</td>
                  <td className="px-4 py-2">{g.campuses?.name ?? "—"}</td>
                  <td className="px-4 py-2">{g.funds?.name ?? "—"}</td>
                  <td className="px-4 py-2 capitalize">{g.payment_method}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmt(g.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
