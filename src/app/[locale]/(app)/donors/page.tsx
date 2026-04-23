import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Input } from "@/components/ui/input";

interface DonorStatRow {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  preferred_campus: string | null;
  ytd_amount: number;
  lifetime_amount: number;
  gift_count: number;
  last_gift_date: string | null;
}

export default async function DonorsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  const { q } = await searchParams;
  const t = await getTranslations("donors");
  const supabase = await createClient();

  let query = supabase
    .from("donor_statistics")
    .select("*")
    .order("ytd_amount", { ascending: false })
    .limit(200);

  if (q?.trim()) {
    query = query.or(`display_name.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const { data: rawData } = await query;
  const donors = (rawData ?? []) as DonorStatRow[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <span className="text-sm text-gray-500">{donors.length} donors</span>
      </div>

      {/* Search */}
      <form method="GET">
        <Input
          name="q"
          defaultValue={q ?? ""}
          placeholder={t("searchPlaceholder")}
          className="max-w-sm"
        />
      </form>

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
            {donors.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No donors found.
                </td>
              </tr>
            )}
            {donors.map((d) => (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/${locale}/donors/${d.id}`}
                    className="font-medium hover:text-blue-600"
                  >
                    {d.display_name}
                  </Link>
                </td>
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
