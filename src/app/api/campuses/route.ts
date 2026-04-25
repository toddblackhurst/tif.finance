import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return NextResponse.json([]);

  const res = await fetch(`${base}/rest/v1/campuses?select=name&order=name`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!res.ok) return NextResponse.json([]);
  const rows = await res.json() as { name: string }[];
  return NextResponse.json(rows.map((r) => r.name));
}
