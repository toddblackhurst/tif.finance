import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const sp = req.nextUrl.searchParams;
  const year   = sp.get("year");
  const status = sp.get("status");

  let query = supabase
    .from("expenses")
    .select(`
      expense_date, description, category, amount, payment_method, status,
      notes, approval_notes,
      campuses ( name ),
      funds ( name ),
      submitter:user_profiles!submitter_id ( full_name ),
      approver:user_profiles!approver_id ( full_name )
    `)
    .is("deleted_at", null)
    .order("expense_date", { ascending: false });

  if (year)   query = query.gte("expense_date", `${year}-01-01`).lte("expense_date", `${year}-12-31`);
  if (status) query = query.eq("status", status);

  const { data, error } = await query.limit(10000);
  if (error) return new NextResponse(error.message, { status: 500 });

  type Row = {
    expense_date: string; description: string; category: string;
    amount: number; payment_method: string; status: string;
    notes: string | null; approval_notes: string | null;
    campuses: { name: string } | null;
    funds: { name: string } | null;
    submitter: { full_name: string | null } | null;
    approver: { full_name: string | null } | null;
  };

  const rows = ((data ?? []) as unknown as Row[]).map((r) => ({
    "Date":            r.expense_date,
    "Description":     r.description,
    "Category":        r.category,
    "Amount (NT$)":    r.amount,
    "Campus":          r.campuses?.name ?? "",
    "Fund":            r.funds?.name ?? "",
    "Payment Method":  r.payment_method,
    "Status":          r.status,
    "Submitted By":    r.submitter?.full_name ?? "",
    "Approved By":     r.approver?.full_name ?? "",
    "Notes":           r.notes ?? "",
    "Approval Notes":  r.approval_notes ?? "",
  }));

  const filename = `expenses${year ? `-${year}` : ""}${status ? `-${status}` : ""}.csv`;
  return new NextResponse(toCSV(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
