import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DonorEditForm } from "@/components/donor-edit-form";

export default async function EditDonorPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: profileData } = await supabase
    .from("user_profiles").select("role").eq("id", user.id).single();
  const role = (profileData as { role: string } | null)?.role ?? "viewer";
  if (role !== "admin" && role !== "campus-finance") redirect(`/${locale}/donors`);

  const [{ data: rawDonor }, { data: campusData }] = await Promise.all([
    supabase
      .from("donors")
      .select("id, display_name, email, phone, notes, preferred_campus_id")
      .eq("id", id)
      .is("deleted_at", null)
      .is("merged_into_id", null)
      .single(),
    supabase.from("campuses").select("id, name").order("name"),
  ]);

  if (!rawDonor) notFound();

  const donor = rawDonor as {
    id: string;
    display_name: string;
    email: string | null;
    phone: string | null;
    notes: string | null;
    preferred_campus_id: string | null;
  };

  const campuses = (campusData ?? []) as { id: string; name: string }[];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href={`/${locale}/donors/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← {donor.display_name}
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold">Edit Donor</h1>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <DonorEditForm
          locale={locale}
          donorId={id}
          campuses={campuses}
          initialValues={{
            display_name: donor.display_name,
            email: donor.email,
            phone: donor.phone,
            notes: donor.notes,
            preferred_campus_id: donor.preferred_campus_id,
          }}
        />
      </div>
    </div>
  );
}
