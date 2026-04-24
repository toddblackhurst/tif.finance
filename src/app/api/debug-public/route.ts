import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

export async function GET() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "MISSING";
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "MISSING";

  const result: Record<string, unknown> = {
    base_url:     base,
    key_length:   key.length,
    key_prefix:   key.slice(0, 12),
  };

  if (base === "MISSING" || key === "MISSING") {
    return NextResponse.json({ ...result, error: "env vars missing" });
  }

  try {
    const url = `${base}/rest/v1/monthly_campus_rollup?select=campus,year,month,total_donations&limit=3`;
    const res = await fetch(url, {
      headers: {
        apikey:        key,
        Authorization: `Bearer ${key}`,
      },
      cache: "no-store",
    });
    const body = await res.text();
    result.http_status = res.status;
    result.response_preview = body.slice(0, 300);
  } catch (e: unknown) {
    result.fetch_error = String(e);
  }

  return NextResponse.json(result);
}
