import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

const PUBLIC_PATHS = [
  "/en/login", "/zh-TW/login", "/login", "/auth/",
  "/en/public", "/zh-TW/public",
  "/en/submit", "/zh-TW/submit",
  "/api/public-expense",
];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Auth callback routes must bypass i18n routing entirely
  if (pathname.startsWith("/auth/")) {
    return NextResponse.next();
  }

  // Handle i18n routing first
  const intlResponse = intlMiddleware(request);

  const supabaseResponse = intlResponse ?? NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    const locale = url.pathname.split("/")[1] ?? "en";
    url.pathname = `/${locale}/login`;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
