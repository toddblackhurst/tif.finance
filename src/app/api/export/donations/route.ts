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
  const year  = sp.get("year");
  const month = sp.get("month");
  const campus = sp.get("campus");

  let query = supabase
    .from("donations")
    .select(`
      gift_date, amount, payment_method, deposit_reference, notes,
      donors ( display_name, email ),
      campuses ( name ),
      funds ( name )
    `)
    .is("deleted_at", null)
    .order("gift_date", { ascending: false });

  if (year)  query = query.gte("gift_date", `${year}-01-01`).lte("gift_date", `${year}-12-31`);
  if (month && year) query = query.gte("gift_date", `${year}-${month.padStart(2,"0")}-01`);
  if (campus) query = query.eq("campuses.name", campus);

  const { data, error } = await query.limit(10000);
  if (error) return new NextResponse(error.message, { status: 500 });

  type Row = {
    gift_date: string; amount: number; payment_method: string;
    deposit_reference: string | null; notes: string | null;
    donors: { display_name: string; email: string } | null;
    campuses: { name: string } | null;
    funds: { name: string } | null;
  };

  const rows = ((data ?? []) as unknown as Row[]).map((r) => ({
    "Date":             r.gift_date,
    "Donor":            r.donors?.display_name ?? "Anonymous",
    "Email":            r.donors?.email ?? "",
    "Amount (NT$)":     r.amount,
    "Campus":           r.campuses?.name ?? "",
    "Fund":             r.funds?.name ?? "",
    "Payment Method":   r.payment_method,
    "Deposit Ref":      r.deposit_reference ?? "",
    "Notes":            r.notes ?? "",
  }));

  const filename = `donations${year ? `-${year}` : ""}.csv`;
  return new NextResponse(toCSV(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
