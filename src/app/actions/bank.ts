"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// ─── Upload CSV ───────────────────────────────────────────────────────────────

export async function uploadBankCSV(
  locale: string,
  _prevState: { error?: string } | null,
  formData: FormData
) {
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
  if (!file || file.size === 0) return { error: "Please select a CSV file." };

  const dateCol   = (formData.get("col_date")        as string).trim();
  const amountCol = (formData.get("col_amount")       as string).trim();
  const descCol   = (formData.get("col_description")  as string).trim() || "";
  const refCol    = (formData.get("col_reference")    as string).trim() || "";

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { error: "CSV has fewer than 2 lines." };

  // Parse header
  const header = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => {
    if (!name) return -1;
    // try exact match first, then partial
    let i = header.indexOf(name.toLowerCase());
    if (i === -1) i = header.findIndex((h) => h.includes(name.toLowerCase()));
    return i;
  };

  const dateIdx   = idx(dateCol);
  const amountIdx = idx(amountCol);
  const descIdx   = idx(descCol);
  const refIdx    = idx(refCol);

  if (dateIdx < 0)   return { error: `Column "${dateCol}" not found. Headers: ${header.join(", ")}` };
  if (amountIdx < 0) return { error: `Column "${amountCol}" not found. Headers: ${header.join(", ")}` };

  const batchId = crypto.randomUUID();
  const records: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    if (cells.length < 2) continue;

    const rawDate   = cells[dateIdx]?.trim() ?? "";
    const rawAmount = cells[amountIdx]?.trim() ?? "";
    const desc      = descIdx >= 0 ? (cells[descIdx]?.trim() ?? "") : "";
    const ref       = refIdx  >= 0 ? (cells[refIdx]?.trim()  ?? "") : "";

    if (!rawDate || !rawAmount) continue;

    // Parse date — try YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, YYYYMMDD
    const txDate = parseDate(rawDate);
    if (!txDate) {
      console.warn(`Row ${i}: cannot parse date "${rawDate}" — skipping`);
      continue;
    }

    // Parse amount — strip NT$, commas, spaces; negative = debit
    const amount = parseFloat(rawAmount.replace(/[^0-9.\-]/g, ""));
    if (isNaN(amount)) continue;

    records.push({
      import_batch_id:    batchId,
      imported_by_id:     profile.id,
      transaction_date:   txDate,
      amount:             Math.round(amount),
      description:        desc || null,
      account_identifier: ref || null,
      match_status:       "unmatched",
      raw_data:           { row: i, cells: Object.fromEntries(header.map((h, j) => [h, cells[j]])) },
    });
  }

  if (records.length === 0) return { error: "No valid rows found in CSV." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("bank_import_lines")
    .insert(records);

  if (error) return { error: `DB error: ${(error as { message: string }).message}` };

  revalidatePath(`/${locale}/bank`);
  redirect(`/${locale}/bank/${batchId}`);
}

// ─── Match / ignore individual lines ─────────────────────────────────────────

export async function matchBankLine(
  locale: string,
  lineId: string,
  donationId: string
) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("bank_import_lines")
    .update({ match_status: "matched", matched_donation_id: donationId })
    .eq("id", lineId);
  if (error) return { error: (error as { message: string }).message };
  revalidatePath(`/${locale}/bank`);
  return { ok: true };
}

export async function ignoreBankLine(locale: string, lineId: string) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("bank_import_lines")
    .update({ match_status: "ignored", matched_donation_id: null })
    .eq("id", lineId);
  if (error) return { error: (error as { message: string }).message };
  revalidatePath(`/${locale}/bank`);
  return { ok: true };
}

export async function unmatchBankLine(locale: string, lineId: string) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("bank_import_lines")
    .update({ match_status: "unmatched", matched_donation_id: null })
    .eq("id", lineId);
  if (error) return { error: (error as { message: string }).message };
  revalidatePath(`/${locale}/bank`);
  return { ok: true };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseDate(raw: string): string | null {
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // YYYYMMDD
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`;
  // MM/DD/YYYY or M/D/YYYY
  const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2,"0")}-${mdy[2].padStart(2,"0")}`;
  // DD/MM/YYYY (Taiwanese banks)
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}`;
  // YYYY/MM/DD
  const ymd = raw.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  return null;
}
