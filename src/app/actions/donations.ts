"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export interface DonationFormState {
  error?: string;
  success?: boolean;
}

export async function createDonation(
  locale: string,
  _prev: DonationFormState,
  formData: FormData
): Promise<DonationFormState> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const giftDate = formData.get("gift_date") as string;
  const donorId = formData.get("donor_id") as string | null;
  const amount = Number(formData.get("amount"));
  const campusId = formData.get("campus_id") as string;
  const fundId = formData.get("fund_id") as string;
  const paymentMethod = formData.get("payment_method") as string;
  const depositReference = (formData.get("deposit_reference") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  if (!giftDate || !amount || !campusId || !fundId || !paymentMethod) {
    return { error: "Please fill in all required fields." };
  }
  if (amount <= 0) {
    return { error: "Amount must be greater than zero." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: donation, error } = await (supabase as any)
    .from("donations")
    .insert({
      donor_id: donorId || null,
      gift_date: giftDate,
      amount,
      campus_id: campusId,
      fund_id: fundId,
      payment_method: paymentMethod,
      deposit_reference: depositReference,
      notes,
      entered_by_id: user.id,
    })
    .select("id")
    .single() as { data: { id: string } | null; error: { message: string } | null };

  if (error) return { error: error.message };
  if (!donation) return { error: "Failed to create donation." };

  // Write audit log
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("audit_log").insert({
    entity_type: "donation",
    entity_id: donation.id,
    action: "create",
    actor_id: user.id,
    after_snapshot: { donor_id: donorId, amount, campus_id: campusId, fund_id: fundId },
    change_summary: `Donation of NT$${amount.toLocaleString()} entered`,
  });

  revalidatePath(`/${locale}/donations`);
  redirect(`/${locale}/donations`);
}

export async function updateDonation(
  locale: string,
  donationId: string,
  _prev: DonationFormState,
  formData: FormData
): Promise<DonationFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const giftDate = formData.get("gift_date") as string;
  const donorId = (formData.get("donor_id") as string) || null;
  const amount = Number(formData.get("amount"));
  const campusId = formData.get("campus_id") as string;
  const fundId = formData.get("fund_id") as string;
  const paymentMethod = formData.get("payment_method") as string;
  const depositReference = (formData.get("deposit_reference") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  if (!giftDate || !amount || !campusId || !fundId || !paymentMethod)
    return { error: "Please fill in all required fields." };
  if (amount <= 0) return { error: "Amount must be greater than zero." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("donations")
    .update({ donor_id: donorId, gift_date: giftDate, amount, campus_id: campusId, fund_id: fundId, payment_method: paymentMethod, deposit_reference: depositReference, notes })
    .eq("id", donationId);

  if (error) return { error: error.message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("audit_log").insert({
    entity_type: "donation", entity_id: donationId, action: "update", actor_id: user.id,
    after_snapshot: { donor_id: donorId, amount, campus_id: campusId, fund_id: fundId },
    change_summary: `Donation updated to NT$${amount.toLocaleString()}`,
  });

  revalidatePath(`/${locale}/donations`);
  redirect(`/${locale}/donations`);
}

export async function updateDonor(
  locale: string,
  donorId: string,
  _prev: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const displayName = (formData.get("display_name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const preferredCampusId = (formData.get("preferred_campus_id") as string) || null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!displayName) return { error: "Name is required." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("donors")
    .update({ display_name: displayName, email, phone, preferred_campus_id: preferredCampusId, notes })
    .eq("id", donorId);

  if (error) return { error: error.message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("audit_log").insert({
    entity_type: "donor", entity_id: donorId, action: "update", actor_id: user.id,
    after_snapshot: { display_name: displayName, email, phone },
    change_summary: `Donor profile updated`,
  });

  revalidatePath(`/${locale}/donors`);
  revalidatePath(`/${locale}/donors/${donorId}`);
  redirect(`/${locale}/donors/${donorId}`);
}

export async function searchDonors(query: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("donors")
    .select("id, display_name, email, preferred_campus_id")
    .or(`display_name.ilike.%${query}%,email.ilike.%${query}%`)
    .is("deleted_at", null)
    .is("merged_into_id", null)
    .limit(8);
  return data ?? [];
}

export async function createDonorAndReturn(displayName: string, email?: string) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("donors")
    .insert({ display_name: displayName, email: email || null })
    .select("id, display_name, email")
    .single() as { data: { id: string; display_name: string; email: string | null } | null; error: unknown };
  if (error) return null;
  return data;
}
