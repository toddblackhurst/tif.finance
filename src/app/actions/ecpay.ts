"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildEcpayNotes, expectedCampusAndFund, parseEcpayCSV, type EcpayImportRow } from "@/lib/ecpay-import";

export interface EcpayUploadState {
  error?: string;
}

interface LookupRow {
  id: string;
  name: string;
}

interface DonorRow {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
}

function normalizeName(value: string | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizePhone(value: string | null): string {
  return (value ?? "").replace(/\D/g, "");
}

function singleDonorMatch(row: EcpayImportRow, donors: DonorRow[]): { donorId: string | null; reason: string } {
  const email = row.sourceEmail?.trim().toLowerCase();
  if (email) {
    const match = donors.find((donor) => donor.email?.trim().toLowerCase() === email);
    if (match) return { donorId: match.id, reason: "matched" };
  }

  const sourceName = normalizeName(row.sourceDonor);
  if (sourceName) {
    const matches = donors.filter((donor) => normalizeName(donor.display_name) === sourceName);
    if (matches.length === 1) return { donorId: matches[0].id, reason: "matched" };
  }

  const sourcePhone = normalizePhone(row.sourcePhone);
  if (sourcePhone.length >= 8) {
    const matches = donors.filter((donor) => normalizePhone(donor.phone) === sourcePhone);
    if (matches.length === 1) return { donorId: matches[0].id, reason: "matched" };
  }

  if (row.sourceDonor || row.sourceEmail || row.sourcePhone) {
    return { donorId: null, reason: "manual review: no high-confidence donor match" };
  }
  return { donorId: null, reason: "manual review: source donor blank" };
}

function lookupId(rows: LookupRow[], name: string): string | null {
  return rows.find((row) => row.name.trim().toLowerCase() === name.trim().toLowerCase())?.id ?? null;
}

function monthFromRows(rows: EcpayImportRow[]): string {
  return rows[0]?.giftDate.slice(0, 7) ?? new Date().toISOString().slice(0, 7);
}

export async function uploadEcpayCSV(
  locale: string,
  _prevState: EcpayUploadState | null,
  formData: FormData
): Promise<EcpayUploadState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: profileRaw } = await supabase
    .from("user_profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();
  const profile = profileRaw as { id: string; role: string } | null;
  if (!profile || profile.role !== "admin") return { error: "Admin only." };

  const file = formData.get("csv_file") as File | null;
  if (!file || file.size === 0) return { error: "Please select an ECPay CSV file." };

  const { rows, skipped } = parseEcpayCSV(await file.text());
  if (rows.length === 0) return { error: skipped[0] ?? "No valid ECPay rows found." };

  const [campusesResult, fundsResult, donorsResult, existingResult] = await Promise.all([
    supabase.from("campuses").select("id, name").eq("is_active", true),
    supabase.from("funds").select("id, name").eq("is_active", true),
    supabase.from("donors").select("id, display_name, email, phone").is("deleted_at", null).is("merged_into_id", null),
    supabase
      .from("donations")
      .select("id, gift_date, amount, donor_id, contact_email, deposit_reference, notes")
      .eq("payment_method", "card")
      .is("deleted_at", null),
  ]);

  if (campusesResult.error) return { error: campusesResult.error.message };
  if (fundsResult.error) return { error: fundsResult.error.message };
  if (donorsResult.error) return { error: donorsResult.error.message };
  if (existingResult.error) return { error: existingResult.error.message };

  const campuses = (campusesResult.data ?? []) as LookupRow[];
  const funds = (fundsResult.data ?? []) as LookupRow[];
  const donors = (donorsResult.data ?? []) as DonorRow[];
  const existingDonations = (existingResult.data ?? []) as {
    id: string;
    gift_date: string;
    amount: number;
    donor_id: string | null;
    contact_email: string | null;
    deposit_reference: string | null;
    notes: string | null;
  }[];

  const importedOrders = new Set(
    existingDonations
      .map((donation) => donation.notes?.match(/ECPay merchant order:\s*(.+)/)?.[1]?.trim())
      .filter((value): value is string => Boolean(value))
  );
  const usedExistingDonationIds = new Set<string>();

  let inserted = 0;
  let enriched = 0;
  let duplicate = 0;
  let auditDonationId: string | null = null;

  for (const row of rows) {
    if (importedOrders.has(row.merchantOrder)) {
      duplicate++;
      continue;
    }

    const expected = expectedCampusAndFund(row);
    const campusId = lookupId(campuses, expected.campus);
    const fundId = lookupId(funds, expected.fund);
    if (!campusId || !fundId) {
      return { error: `Missing lookup for ${expected.campus} / ${expected.fund}. Import stopped before row ${row.sourceRow}.` };
    }

    const donorMatch = singleDonorMatch(row, donors);
    const notes = buildEcpayNotes(row, donorMatch.reason);
    const existingCardDonation = existingDonations.find((donation) =>
      donation.gift_date === row.giftDate &&
      Number(donation.amount) === row.amount &&
      !usedExistingDonationIds.has(donation.id) &&
      !donation.notes?.includes("ECPay merchant order:")
    );

    if (existingCardDonation) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("donations")
        .update({
          donor_id: existingCardDonation.donor_id ?? donorMatch.donorId,
          campus_id: campusId,
          fund_id: fundId,
          contact_email: existingCardDonation.contact_email || row.sourceEmail,
          deposit_reference: existingCardDonation.deposit_reference || row.merchantOrder,
          notes: existingCardDonation.notes ? `${existingCardDonation.notes}\n\n${notes}` : notes,
        })
        .eq("id", existingCardDonation.id);
      if (error) return { error: error.message };
      enriched++;
      usedExistingDonationIds.add(existingCardDonation.id);
      auditDonationId ??= existingCardDonation.id;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: insertedDonation, error } = await (supabase as any).from("donations").insert({
        donor_id: donorMatch.donorId,
        gift_date: row.giftDate,
        amount: row.amount,
        campus_id: campusId,
        fund_id: fundId,
        payment_method: "card",
        contact_email: row.sourceEmail,
        deposit_reference: row.merchantOrder,
        notes,
        entered_by_id: profile.id,
      }).select("id").single();
      if (error) return { error: error.message };
      inserted++;
      auditDonationId ??= (insertedDonation as { id: string } | null)?.id ?? null;
    }

    importedOrders.add(row.merchantOrder);
  }

  if (auditDonationId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("audit_log").insert({
      entity_type: "donation",
      entity_id: auditDonationId,
      action: "create",
      actor_id: profile.id,
      change_summary: `ECPay CSV imported: ${inserted} inserted, ${enriched} enriched, ${duplicate} duplicate skipped, ${skipped.length} invalid skipped`,
      after_snapshot: { inserted, enriched, duplicate, skipped: skipped.slice(0, 20) },
    });
  }

  const month = monthFromRows(rows);
  revalidatePath(`/${locale}/donations`);
  revalidatePath(`/${locale}/card-reconciliation`);
  redirect(`/${locale}/card-reconciliation?month=${month}`);
}
