import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { DonationForm } from "@/components/donation-form";

interface CampusRow { id: string; name: string }
interface FundRow { id: string; name: string }

export default async function EditDonationPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const t = await getTranslations("donations");
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: profileData } = await supabase
    .from("user_profiles").select("role").eq("id", user.id).single();
  const role = (profileData as { role: string } | null)?.role ?? "viewer";
  if (role !== "admin" && role !== "campus-finance") redirect(`/${locale}/donations`);

  const [{ data: rawDonation }, { data: campusData }, { data: fundData }] = await Promise.all([
    supabase
      .from("donations")
      .select(`
        id, gift_date, amount, campus_id, fund_id, payment_method,
        deposit_reference, notes, donor_id,
        donors ( display_name )
      `)
      .eq("id", id)
      .is("deleted_at", null)
      .single(),
    supabase.from("campuses").select("id, name").order("name"),
    supabase.from("funds").select("id, name").eq("is_active", true).order("name"),
  ]);

  if (!rawDonation) notFound();

  const donation = rawDonation as {
    id: string;
    gift_date: string;
    amount: number;
    campus_id: string;
    fund_id: string;
    payment_method: string;
    deposit_reference: string | null;
    notes: string | null;
    donor_id: string | null;
    donors: { display_name: string } | null;
  };

  const campuses = (campusData ?? []) as CampusRow[];
  const funds = (fundData ?? []) as FundRow[];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/${locale}/donations`} className="text-sm text-gray-500 hover:text-gray-700">
          ← {t("title")}
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold">Edit Donation</h1>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <DonationForm
          locale={locale}
          campuses={campuses}
          funds={funds}
          editId={id}
          initialValues={{
            gift_date: donation.gift_date,
            amount: donation.amount,
            campus_id: donation.campus_id,
            fund_id: donation.fund_id,
            payment_method: donation.payment_method,
            deposit_reference: donation.deposit_reference,
            notes: donation.notes,
            donor_id: donation.donor_id,
            donor_name: donation.donors?.display_name ?? null,
          }}
        />
      </div>
    </div>
  );
}
