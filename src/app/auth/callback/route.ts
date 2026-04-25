import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/en";

  if (code) {
    const response = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return response;
    // Temporary debug: show exact error instead of silently redirecting
    return new Response(
      `<pre>Auth error: ${JSON.stringify(error, null, 2)}\norigin: ${origin}\ncode present: ${!!code}</pre>`,
      { status: 400, headers: { "content-type": "text/html" } }
    );
  }

  return new Response(`<pre>No code in URL\norigin: ${origin}\nurl: ${request.url}</pre>`, {
    status: 400, headers: { "content-type": "text/html" },
  });
}
