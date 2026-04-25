import { NextRequest, NextResponse } from "next/server";
import { sendPublicSubmissionConfirmationEmail, sendExpenseSubmittedEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const ALLOWED_CATEGORIES = [
  "ministry", "facilities", "staffing", "missions",
  "vbs", "worship", "admin", "other",
] as const;

function sbUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`;
}

function sbHeaders(returnRepresentation = false) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return {
    apikey:        key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer:        returnRepresentation ? "return=representation" : "return=minimal",
  };
}

async function fetchOne<T>(path: string): Promise<T | null> {
  const res = await fetch(sbUrl(path), { headers: sbHeaders(), cache: "no-store" });
  if (!res.ok) return null;
  const rows = await res.json() as T[];
  return rows[0] ?? null;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, email, campus_name, category, description, amount, expense_date, notes } = body as {
    name: string; email: string; campus_name: string;
    category: string; description: string;
    amount: string | number; expense_date: string; notes?: string;
  };

  // Basic validation
  if (!name?.toString().trim()) return NextResponse.json({ error: "Name is required" }, { status: 422 });
  if (!email?.toString().trim()) return NextResponse.json({ error: "Email is required" }, { status: 422 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim()))
    return NextResponse.json({ error: "Valid email is required" }, { status: 422 });
  if (!campus_name) return NextResponse.json({ error: "Campus is required" }, { status: 422 });
  if (!ALLOWED_CATEGORIES.includes(category as typeof ALLOWED_CATEGORIES[number]))
    return NextResponse.json({ error: "Invalid category" }, { status: 422 });
  if (!description?.toString().trim()) return NextResponse.json({ error: "Description is required" }, { status: 422 });
  const amountNum = Number(amount);
  if (!amountNum || amountNum <= 0 || !isFinite(amountNum))
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 422 });
  if (!expense_date) return NextResponse.json({ error: "Expense date is required" }, { status: 422 });

  // Look up campus_id
  const campus = await fetchOne<{ id: string; name: string }>(
    `campuses?name=eq.${encodeURIComponent(campus_name)}&select=id,name&limit=1`
  );
  if (!campus) return NextResponse.json({ error: "Campus not found" }, { status: 422 });

  const submitterName  = String(name).trim();
  const submitterEmail = String(email).trim().toLowerCase();
  const descriptionStr = String(description).trim();

  const record = {
    submitter_id:    null,
    submitter_name:  submitterName,
    submitter_email: submitterEmail,
    campus_id:       campus.id,
    category,
    description:     descriptionStr,
    amount:          amountNum,
    expense_date,
    notes:           notes ? String(notes).trim() : null,
    status:          "submitted",
  };

  const insertRes = await fetch(sbUrl("expenses"), {
    method:  "POST",
    headers: sbHeaders(true),
    body:    JSON.stringify(record),
  });

  if (!insertRes.ok) {
    const err = await insertRes.text();
    console.error("Public expense insert failed:", err);
    return NextResponse.json({ error: "Failed to save submission" }, { status: 500 });
  }

  const [inserted] = await insertRes.json() as { id: string }[];
  const expenseId = inserted?.id ?? null;

  // Fire-and-forget emails — don't fail the request if email fails
  void (async () => {
    try {
      // Confirmation to submitter
      await sendPublicSubmissionConfirmationEmail({
        submitterEmail, submitterName,
        description: descriptionStr, amount: amountNum,
        campus: campus.name,
      });
    } catch (e) { console.error("Confirmation email failed:", e); }

    try {
      // Notify approvers
      if (expenseId) {
        const locale = "en";
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        const approversRes = await fetch(
          `${appUrl}/api/approvers-for-campus?campus_id=${campus.id}`,
          { headers: { "x-internal-secret": process.env.INTERNAL_SECRET ?? "" } }
        );
        // Approver lookup via the service role directly
        const assignmentsRes = await fetch(
          sbUrl(`user_campus_assignments?campus_id=eq.${campus.id}&select=user_profiles(email)&user_profiles.role=neq.viewer`),
          { headers: sbHeaders(), cache: "no-store" }
        );
        const adminsRes = await fetch(
          sbUrl(`user_profiles?role=eq.admin&select=email`),
          { headers: sbHeaders(), cache: "no-store" }
        );

        const emailSet = new Set<string>();
        if (adminsRes.ok) {
          const admins = await adminsRes.json() as { email: string }[];
          for (const a of admins) if (a.email) emailSet.add(a.email);
        }
        if (assignmentsRes.ok) {
          const rows = await assignmentsRes.json() as { user_profiles: { email: string | null } | null }[];
          for (const r of rows) if (r.user_profiles?.email) emailSet.add(r.user_profiles.email);
        }

        const approverEmails = Array.from(emailSet);
        if (approverEmails.length) {
          await sendExpenseSubmittedEmail({
            approverEmails, submitterName,
            description: descriptionStr, amount: amountNum,
            campus: campus.name, expenseId, locale,
          });
        }
      }
    } catch (e) { console.error("Approver notification email failed:", e); }
  })();

  return NextResponse.json({ success: true }, { status: 201 });
}
