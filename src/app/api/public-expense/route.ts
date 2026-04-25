import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ALLOWED_CATEGORIES = [
  "ministry", "facilities", "staffing", "missions",
  "vbs", "worship", "admin", "other",
] as const;

function sbUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`;
}

function sbHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return {
    apikey:          key,
    Authorization:   `Bearer ${key}`,
    "Content-Type":  "application/json",
    Prefer:          "return=minimal",
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
  if (!campus_name) return NextResponse.json({ error: "Campus is required" }, { status: 422 });
  if (!ALLOWED_CATEGORIES.includes(category as typeof ALLOWED_CATEGORIES[number]))
    return NextResponse.json({ error: "Invalid category" }, { status: 422 });
  if (!description?.toString().trim()) return NextResponse.json({ error: "Description is required" }, { status: 422 });
  const amountNum = Number(amount);
  if (!amountNum || amountNum <= 0) return NextResponse.json({ error: "Amount must be positive" }, { status: 422 });
  if (!expense_date) return NextResponse.json({ error: "Expense date is required" }, { status: 422 });

  // Look up campus_id
  const campus = await fetchOne<{ id: string }>(
    `campuses?name=eq.${encodeURIComponent(campus_name)}&select=id&limit=1`
  );
  if (!campus) return NextResponse.json({ error: "Campus not found" }, { status: 422 });

  // Look up General fund (default for public submissions)
  const fund = await fetchOne<{ id: string }>(
    `funds?name=eq.General&select=id&limit=1`
  );
  if (!fund) return NextResponse.json({ error: "Default fund not configured" }, { status: 500 });

  const record = {
    submitter_id:    null,
    submitter_name:  String(name).trim(),
    submitter_email: String(email).trim().toLowerCase(),
    campus_id:       campus.id,
    fund_id:         fund.id,
    category:        category,
    description:     String(description).trim(),
    amount:          amountNum,
    expense_date:    expense_date,
    notes:           notes ? String(notes).trim() : null,
    status:          "submitted",
  };

  const insertRes = await fetch(sbUrl("expenses"), {
    method:  "POST",
    headers: sbHeaders(),
    body:    JSON.stringify(record),
  });

  if (!insertRes.ok) {
    const err = await insertRes.text();
    console.error("Public expense insert failed:", err);
    return NextResponse.json({ error: "Failed to save submission" }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
