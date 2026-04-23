import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

interface DonorStatRow {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  preferred_campus: string | null;
  ytd_amount: number;
  gift_count: number;
  last_gift_date: string | null;
}

export default async function DonorsPage() {
  const t = await getTranslations("donors");
  const supabase = await createClient();

  const { data: rawData } = await supabase
    .from("donor_statistics")
    .select("*")
    .order("ytd_amount", { ascending: false })
    .limit(100);

  const donors = (rawData ?? []) as DonorStatRow[];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <div className="rounded-lg border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left">{t("displayName")}</th>
              <th className="px-4 py-3 text-left">{t("email")}</th>
              <th className="px-4 py-3 text-left">{t("campus")}</th>
              <th className="px-4 py-3 text-right">{t("ytdAmount")}</th>
              <th className="px-4 py-3 text-right">{t("giftCount")}</th>
              <th className="px-4 py-3 text-left">{t("lastGiftDate")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {donors.map((d) => (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{d.display_name}</td>
                <td className="px-4 py-3 text-gray-600">{d.email ?? "—"}</td>
                <td className="px-4 py-3">{d.preferred_campus ?? "—"}</td>
                <td className="px-4 py-3 text-right font-mono">
                  NT${(d.ytd_amount ?? 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right">{d.gift_count ?? 0}</td>
                <td className="px-4 py-3">{d.last_gift_date ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
