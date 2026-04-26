"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  sendExpenseSubmittedEmail,
  sendExpenseApprovedEmail,
  sendExpenseRejectedEmail,
  sendExpenseNeedsPaymentEmail,
  sendExpensePaidEmail,
} from "@/lib/email";

// expData.submitter is null when submitter_id is null (public/unauthenticated submission)
function isPublicSubmission(expData: { submitter: { full_name: string | null; email: string | null } | null }): boolean {
  return expData.submitter === null;
}

export interface ExpenseFormState {
  error?: string;
  success?: boolean;
}

const EXPENSE_CATEGORIES = [
  "ministry", "facilities", "staffing", "missions",
  "vbs", "worship", "admin", "other",
] as const;

// ─── helpers ─────────────────────────────────────────────────────────────────

// Returns emails of campus-finance users assigned to the given campus + all admins.
async function getApproverEmailsForCampus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  campusId: string
): Promise<string[]> {
  const emailSet = new Set<string>();

  const { data: admins } = await supabase
    .from("user_profiles")
    .select("email")
    .eq("role", "admin")
    .not("email", "is", null) as { data: { email: string }[] | null };
  for (const a of admins ?? []) if (a.email) emailSet.add(a.email);

  const { data: assignments } = await supabase
    .from("user_campus_assignments")
    .select("user_id, user_profiles!user_campus_assignments_user_id_fkey(email)")
    .eq("campus_id", campusId) as unknown as {
      data: { user_profiles: { email: string | null } | null }[] | null
    };
  for (const row of assignments ?? []) {
    const email = row.user_profiles?.email;
    if (email) emailSet.add(email);
  }

  return Array.from(emailSet);
}

async function getTreasurerEmails(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string[]> {
  const { data } = await supabase
    .from("user_profiles")
    .select("email")
    .eq("role", "admin")
    .not("email", "is", null);
  return ((data ?? []) as { email: string }[]).map((u) => u.email).filter(Boolean);
}

async function getExpenseWithPeople(
  supabase: Awaited<ReturnType<typeof createClient>>,
  expenseId: string
) {
  const { data } = await supabase
    .from("expenses")
    .select(`
      id, description, amount, campus_id, submitter_name, submitter_email,
      campuses ( name ),
      submitter:user_profiles!expenses_submitter_id_fkey ( full_name, email ),
      approver:user_profiles!expenses_approver_id_fkey ( full_name, email )
    `)
    .eq("id", expenseId)
    .single();
  return data as {
    id: string;
    description: string;
    amount: number;
    campus_id: string;
    submitter_name: string | null;
    submitter_email: string | null;
    campuses: { name: string } | null;
    submitter: { full_name: string | null; email: string | null } | null;
    approver: { full_name: string | null; email: string | null } | null;
  } | null;
}

function resolveSubmitter(expData: Awaited<ReturnType<typeof getExpenseWithPeople>>) {
  if (!expData) return { name: "Unknown", email: null };
  const name =
    expData.submitter?.full_name ??
    expData.submitter_name ??
    expData.submitter?.email ??
    expData.submitter_email ??
    "A church member";
  const email = expData.submitter?.email ?? expData.submitter_email ?? null;
  return { name, email };
}

// ─────────────────────────────────────────────────────────────────────────────

export async function updateExpense(
  locale: string,
  expenseId: string,
  _prev: ExpenseFormState,
  formData: FormData
): Promise<ExpenseFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("user_profiles").select("role").eq("id", user.id).single();
  const role = (profile as { role: string } | null)?.role ?? "viewer";

  const description = formData.get("description") as string;
  const category = formData.get("category") as string;
  const expenseDate = formData.get("expense_date") as string;
  const amount = Number(formData.get("amount"));
  const campusId = formData.get("campus_id") as string;
  const notes = (formData.get("notes") as string) || null;

  if (!description || !category || !expenseDate || !amount || !campusId)
    return { error: "Please fill in all required fields." };
  if (amount <= 0) return { error: "Amount must be greater than zero." };
  if (!EXPENSE_CATEGORIES.includes(category as typeof EXPENSE_CATEGORIES[number]))
    return { error: "Invalid category." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("expenses")
    .update({ description, category, expense_date: expenseDate, amount, campus_id: campusId, notes })
    .eq("id", expenseId)
    .is("deleted_at", null)
    .select("id");

  if (role !== "admin") {
    query = query.eq("submitter_id", user.id).in("status", ["draft", "submitted"]);
  }

  const { data: updated, error } = await query as { data: { id: string }[] | null; error: { message: string } | null };
  if (error) return { error: error.message };
  if (!updated || updated.length === 0) return { error: "Expense not found or you don't have permission to edit it." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("audit_log").insert({
    entity_type: "expense", entity_id: expenseId,
    action: "update", actor_id: user.id,
    after_snapshot: { description, amount, campus_id: campusId },
    change_summary: `Expense updated to NT$${amount.toLocaleString()}`,
  });

  revalidatePath(`/${locale}/expenses`);
  revalidatePath(`/${locale}/expenses/${expenseId}`);
  redirect(`/${locale}/expenses/${expenseId}`);
}

export async function createExpense(
  locale: string,
  _prev: ExpenseFormState,
  formData: FormData
): Promise<ExpenseFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const description = formData.get("description") as string;
  const category = formData.get("category") as string;
  const expenseDate = formData.get("expense_date") as string;
  const amount = Number(formData.get("amount"));
  const campusId = formData.get("campus_id") as string;
  const notes = (formData.get("notes") as string) || null;

  if (!description || !category || !expenseDate || !amount || !campusId) {
    return { error: "Please fill in all required fields." };
  }
  if (amount <= 0) return { error: "Amount must be greater than zero." };
  if (!EXPENSE_CATEGORIES.includes(category as typeof EXPENSE_CATEGORIES[number])) {
    return { error: "Invalid category." };
  }

  const submitAction = formData.get("_action") as string;
  const status = submitAction === "submit" ? "submitted" : "draft";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: expense, error } = await (supabase as any)
    .from("expenses")
    .insert({
      submitter_id: user.id,
      description, category,
      expense_date: expenseDate,
      amount, campus_id: campusId,
      notes, status,
    })
    .select("id")
    .single() as { data: { id: string } | null; error: { message: string } | null };

  if (error) return { error: error.message };
  if (!expense) return { error: "Failed to create expense." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("audit_log").insert({
    entity_type: "expense", entity_id: expense.id,
    action: "create", actor_id: user.id,
    after_snapshot: { description, amount, campus_id: campusId, status },
    change_summary: `Expense of NT$${amount.toLocaleString()} ${status === "submitted" ? "submitted" : "saved as draft"}`,
  });

  if (status === "submitted") {
    try {
      const [approverEmails, expData] = await Promise.all([
        getApproverEmailsForCampus(supabase, campusId),
        getExpenseWithPeople(supabase, expense.id),
      ]);
      const profile = await supabase.from("user_profiles").select("full_name").eq("id", user.id).single();
      const submitterName = (profile.data as { full_name: string | null } | null)?.full_name ?? "A staff member";
      if (approverEmails.length && expData) {
        await sendExpenseSubmittedEmail({
          approverEmails, submitterName, description, amount,
          campus: expData.campuses?.name ?? "",
          expenseId: expense.id, locale,
        });
      }
    } catch (e) { console.error("Email failed:", e); }
  }

  revalidatePath(`/${locale}/expenses`);
  redirect(`/${locale}/expenses`);
}

export async function submitDraftExpense(
  locale: string,
  expenseId: string
): Promise<ExpenseFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("expenses")
    .update({ status: "submitted" })
    .eq("id", expenseId)
    .eq("submitter_id", user.id)
    .eq("status", "draft") as { error: { message: string } | null };

  if (error) return { error: error.message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("audit_log").insert({
    entity_type: "expense", entity_id: expenseId,
    action: "update", actor_id: user.id,
    after_snapshot: { status: "submitted" },
    change_summary: "Draft expense submitted for approval",
  });

  try {
    const expData = await getExpenseWithPeople(supabase, expenseId);
    if (expData) {
      const approverEmails = await getApproverEmailsForCampus(supabase, expData.campus_id);
      const { name: submitterName } = resolveSubmitter(expData);
      if (approverEmails.length) {
        await sendExpenseSubmittedEmail({
          approverEmails, submitterName,
          description: expData.description, amount: expData.amount,
          campus: expData.campuses?.name ?? "",
          expenseId, locale,
        });
      }
    }
  } catch (e) { console.error("Email failed:", e); }

  revalidatePath(`/${locale}/expenses`);
  revalidatePath(`/${locale}/expenses/${expenseId}`);
  return { success: true };
}

export async function approveExpense(
  locale: string,
  expenseId: string,
  approvalNotes: string | null
): Promise<ExpenseFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("user_profiles").select("role, full_name").eq("id", user.id).single();
  const role = (profile as { role: string; full_name: string | null } | null)?.role;
  const approverName = (profile as { role: string; full_name: string | null } | null)?.full_name ?? "An approver";

  if (role !== "admin" && role !== "campus-finance") {
    return { error: "Not authorized to approve expenses." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("expenses")
    .update({
      status: "approved",
      approver_id: user.id,
      approved_at: new Date().toISOString(),
      approval_notes: approvalNotes,
    })
    .eq("id", expenseId)
    .eq("status", "submitted") as { error: { message: string } | null };

  if (error) return { error: error.message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("audit_log").insert({
    entity_type: "expense", entity_id: expenseId,
    action: "update", actor_id: user.id,
    after_snapshot: { status: "approved" },
    change_summary: "Expense approved",
  });

  try {
    const [expData, treasurerEmails] = await Promise.all([
      getExpenseWithPeople(supabase, expenseId),
      getTreasurerEmails(supabase),
    ]);
    if (expData) {
      const { name: submitterName, email: submitterEmail } = resolveSubmitter(expData);

      if (submitterEmail) {
        await sendExpenseApprovedEmail({
          submitterEmail, submitterName,
          description: expData.description, amount: expData.amount,
          approverName,
          expenseId: isPublicSubmission(expData) ? null : expenseId,
          locale,
        });
      }

      if (treasurerEmails.length) {
        await sendExpenseNeedsPaymentEmail({
          treasurerEmails, submitterName,
          description: expData.description, amount: expData.amount,
          campus: expData.campuses?.name ?? "",
          approverName, expenseId, locale,
        });
      }
    }
  } catch (e) { console.error("Email failed:", e); }

  revalidatePath(`/${locale}/expenses`);
  revalidatePath(`/${locale}/expenses/${expenseId}`);
  return { success: true };
}

export async function rejectExpense(
  locale: string,
  expenseId: string,
  approvalNotes: string | null
): Promise<ExpenseFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("user_profiles").select("role, full_name").eq("id", user.id).single();
  const role = (profile as { role: string; full_name: string | null } | null)?.role;
  const approverName = (profile as { role: string; full_name: string | null } | null)?.full_name ?? "An approver";

  if (role !== "admin" && role !== "campus-finance") {
    return { error: "Not authorized to reject expenses." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("expenses")
    .update({
      status: "rejected",
      approver_id: user.id,
      approved_at: new Date().toISOString(),
      approval_notes: approvalNotes,
    })
    .eq("id", expenseId)
    .eq("status", "submitted") as { error: { message: string } | null };

  if (error) return { error: error.message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("audit_log").insert({
    entity_type: "expense", entity_id: expenseId,
    action: "update", actor_id: user.id,
    after_snapshot: { status: "rejected" },
    change_summary: "Expense rejected",
  });

  try {
    const expData = await getExpenseWithPeople(supabase, expenseId);
    if (expData) {
      const { name: submitterName, email: submitterEmail } = resolveSubmitter(expData);
      if (submitterEmail) {
        await sendExpenseRejectedEmail({
          submitterEmail, submitterName,
          description: expData.description, amount: expData.amount,
          approverName, rejectionNote: approvalNotes,
          expenseId: isPublicSubmission(expData) ? null : expenseId,
          locale,
        });
      }
    }
  } catch (e) { console.error("Email failed:", e); }

  revalidatePath(`/${locale}/expenses`);
  revalidatePath(`/${locale}/expenses/${expenseId}`);
  return { success: true };
}

export async function markExpensePaid(
  locale: string,
  expenseId: string,
  paymentReference: string | null
): Promise<ExpenseFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("user_profiles").select("role").eq("id", user.id).single();
  const role = (profile as { role: string } | null)?.role;
  if (role !== "admin") return { error: "Only admins can mark expenses as paid." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("expenses")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      paid_by_id: user.id,
      payment_reference: paymentReference,
    })
    .eq("id", expenseId)
    .eq("status", "approved") as { error: { message: string } | null };

  if (error) return { error: error.message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("audit_log").insert({
    entity_type: "expense", entity_id: expenseId,
    action: "update", actor_id: user.id,
    after_snapshot: { status: "paid", payment_reference: paymentReference },
    change_summary: "Expense marked as paid",
  });

  try {
    const expData = await getExpenseWithPeople(supabase, expenseId);
    if (expData) {
      const { name: submitterName, email: submitterEmail } = resolveSubmitter(expData);
      if (submitterEmail) {
        await sendExpensePaidEmail({
          submitterEmail, submitterName,
          description: expData.description, amount: expData.amount,
          paymentReference,
          expenseId: isPublicSubmission(expData) ? null : expenseId,
          locale,
        });
      }
    }
  } catch (e) { console.error("Email failed:", e); }

  revalidatePath(`/${locale}/expenses`);
  revalidatePath(`/${locale}/expenses/${expenseId}`);
  return { success: true };
}
