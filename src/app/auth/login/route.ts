import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Supabase (new projects) redirects OAuth codes to /auth/login instead of /auth/callback
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/en`);
    }
  }

  return NextResponse.redirect(`${origin}/en/login?error=auth`);
}
