import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DonationForm } from "@/components/donation-form";
import { buildDonationListPath, type DonationFilterSearchParams } from "@/lib/donation-filters";

interface CampusRow {
  id: string;
  name: string;
}

interface FundRow {
  id: string;
  name: string;
}

export default async function NewDonationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<DonationFilterSearchParams>;
}) {
  const { locale } = await params;
  const filters = await searchParams;
  const t = await getTranslations("donations");
  const supabase = await createClient();

  const [{ data: campusData }, { data: fundData }] = await Promise.all([
    supabase.from("campuses").select("id, name").order("name"),
    supabase.from("funds").select("id, name").eq("is_active", true).order("name"),
  ]);

  const campuses = (campusData ?? []) as CampusRow[];
  const funds = (fundData ?? []) as FundRow[];
  const returnTo = buildDonationListPath(locale, filters);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={returnTo}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← {t("title")}
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold">{t("newDonation")}</h1>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <DonationForm locale={locale} campuses={campuses} funds={funds} returnTo={returnTo} />
      </div>
    </div>
  );
}
