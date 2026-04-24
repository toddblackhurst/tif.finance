"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  sendExpenseSubmittedEmail,
  sendExpenseApprovedEmail,
  sendExpenseRejectedEmail,
} from "@/lib/email";

export interface ExpenseFormState {
  error?: string;
  success?: boolean;
}

const EXPENSE_CATEGORIES = [
  "ministry", "facilities", "staffing", "missions",
  "vbs", "worship", "admin", "other",
] as const;

// ─── helpers ─────────────────────────────────────────────────────────────────

async function getApproverEmails(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase
    .from("user_profiles")
    .select("email")
    .in("role", ["admin", "campus-finance"])
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
      id, description, amount,
      campuses ( name ),
      submitter:user_profiles!submitter_id ( full_name, email ),
      approver:user_profiles!approver_id ( full_name, email )
    `)
    .eq("id", expenseId)
    .single();
  return data as {
    id: string;
    description: string;
    amount: number;
    campuses: { name: string } | null;
    submitter: { full_name: string | null; email: string | null } | null;
    approver: { full_name: string | null; email: string | null } | null;
  } | null;
}

// ─────────────────────────────────────────────────────────────────────────────

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
  const fundId = formData.get("fund_id") as string;
  const notes = (formData.get("notes") as string) || null;

  if (!description || !category || !expenseDate || !amount || !campusId || !fundId) {
    return { error: "Please fill in all required fields." };
  }
  if (amount <= 0) {
    return { error: "Amount must be greater than zero." };
  }
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
      description,
      category,
      expense_date: expenseDate,
      amount,
      campus_id: campusId,
      fund_id: fundId,
      notes,
      status,
    })
    .select("id")
    .single() as { data: { id: string } | null; error: { message: string } | null };

  if (error) return { error: error.message };
  if (!expense) return { error: "Failed to create expense." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("audit_log").insert({
    entity_type: "expense",
    entity_id: expense.id,
    action: "create",
    actor_id: user.id,
    after_snapshot: { description, amount, campus_id: campusId, fund_id: fundId, status },
    change_summary: `Expense of NT$${amount.toLocaleString()} ${status === "submitted" ? "submitted" : "saved as draft"}`,
  });

  // Notify approvers when directly submitted
  if (status === "submitted") {
    try {
      const [approverEmails, expData] = await Promise.all([
        getApproverEmails(supabase),
        getExpenseWithPeople(supabase, expense.id),
      ]);
      const profile = await supabase.from("user_profiles").select("full_name").eq("id", user.id).single();
      const submitterName = (profile.data as { full_name: string | null } | null)?.full_name ?? "A staff member";
      if (approverEmails.length && expData) {
        await sendExpenseSubmittedEmail({
          approverEmails,
          submitterName,
          description,
          amount,
          campus: expData.campuses?.name ?? "",
          expenseId: expense.id,
          locale,
        });
      }
    } catch (emailErr) {
      console.error("Email send failed (non-blocking):", emailErr);
    }
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
    entity_type: "expense",
    entity_id: expenseId,
    action: "update",
    actor_id: user.id,
    after_snapshot: { status: "submitted" },
    change_summary: "Draft expense submitted for approval",
  });

  // Notify approvers
  try {
    const [approverEmails, expData] = await Promise.all([
      getApproverEmails(supabase),
      getExpenseWithPeople(supabase, expenseId),
    ]);
    const profile = await supabase.from("user_profiles").select("full_name").eq("id", user.id).single();
    const submitterName = (profile.data as { full_name: string | null } | null)?.full_name ?? "A staff member";
    if (approverEmails.length && expData) {
      await sendExpenseSubmittedEmail({
        approverEmails,
        submitterName,
        description: expData.description,
        amount: expData.amount,
        campus: expData.campuses?.name ?? "",
        expenseId,
        locale,
      });
    }
  } catch (emailErr) {
    console.error("Email send failed (non-blocking):", emailErr);
  }

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
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (profile as { role: string } | null)?.role;
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
    entity_type: "expense",
    entity_id: expenseId,
    action: "update",
    actor_id: user.id,
    after_snapshot: { status: "approved" },
    change_summary: "Expense approved",
  });

  // Notify submitter
  try {
    const expData = await getExpenseWithPeople(supabase, expenseId);
    if (expData?.submitter?.email) {
      await sendExpenseApprovedEmail({
        submitterEmail: expData.submitter.email,
        submitterName: expData.submitter.full_name ?? "Staff",
        description: expData.description,
        amount: expData.amount,
        approverName: expData.approver?.full_name ?? "An approver",
        expenseId,
        locale,
      });
    }
  } catch (emailErr) {
    console.error("Email send failed (non-blocking):", emailErr);
  }

  revalidatePath(`/${locale}/expenses`);
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
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (profile as { role: string } | null)?.role;
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
    entity_type: "expense",
    entity_id: expenseId,
    action: "update",
    actor_id: user.id,
    after_snapshot: { status: "rejected" },
    change_summary: "Expense rejected",
  });

  // Notify submitter
  try {
    const expData = await getExpenseWithPeople(supabase, expenseId);
    if (expData?.submitter?.email) {
      await sendExpenseRejectedEmail({
        submitterEmail: expData.submitter.email,
        submitterName: expData.submitter.full_name ?? "Staff",
        description: expData.description,
        amount: expData.amount,
        approverName: expData.approver?.full_name ?? "An approver",
        rejectionNote: approvalNotes,
        expenseId,
        locale,
      });
    }
  } catch (emailErr) {
    console.error("Email send failed (non-blocking):", emailErr);
  }

  revalidatePath(`/${locale}/expenses`);
  return { success: true };
}

export async function markExpensePaid(
  locale: string,
  expenseId: string,
  checkNumber: string | null
): Promise<ExpenseFormState> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (profile as { role: string } | null)?.role;
  if (role !== "admin") {
    return { error: "Only admins can mark expenses as paid." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("expenses")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      paid_by_id: user.id,
      check_number: checkNumber,
    })
    .eq("id", expenseId)
    .eq("status", "approved") as { error: { message: string } | null };

  if (error) return { error: error.message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("audit_log").insert({
    entity_type: "expense",
    entity_id: expenseId,
    action: "update",
    actor_id: user.id,
    after_snapshot: { status: "paid" },
    change_summary: "Expense marked as paid",
  });

  revalidatePath(`/${locale}/expenses`);
  return { success: true };
}
