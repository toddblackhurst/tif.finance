import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

export default async function ReportsPage() {
  const t = await getTranslations("reports");
  const supabase = await createClient();
  const currentYear = new Date().getFullYear();

  interface RollupRow {
    campus: string;
    fund: string;
    year: number;
    month: number;
    total_donations: number;
    donation_count: number;
  }

  const { data: rawRollup } = await supabase
    .from("monthly_campus_rollup")
    .select("*")
    .eq("year", currentYear)
    .order("month", { ascending: false });

  const rollup = (rawRollup ?? []) as RollupRow[];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <section>
        <h2 className="text-lg font-semibold mb-3">{t("monthlySummary")} — {currentYear}</h2>
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left">{t("month")}</th>
                <th className="px-4 py-3 text-left">{t("campus")}</th>
                <th className="px-4 py-3 text-left">{t("fund")}</th>
                <th className="px-4 py-3 text-right">{t("totalDonations")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rollup.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{r.month}</td>
                  <td className="px-4 py-3">{r.campus}</td>
                  <td className="px-4 py-3">{r.fund}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    NT${(r.total_donations ?? 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
