"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/",          key: "dashboard",  adminOnly: false },
  { href: "/donations", key: "donations",  adminOnly: false },
  { href: "/expenses",  key: "expenses",   adminOnly: false },
  { href: "/donors",    key: "donors",     adminOnly: false },
  { href: "/reports",   key: "reports",    adminOnly: false },
  { href: "/bank",      key: "bank",       adminOnly: true  },
  { href: "/admin",     key: "admin",      adminOnly: true  },
] as const;

export function Nav({ locale, role }: { locale: string; role: string }) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = `/${locale}/login`;
  }

  const visibleLinks = role === "admin"
    ? NAV_LINKS
    : NAV_LINKS.filter((l) => !l.adminOnly);

  return (
    <nav className="flex flex-col h-full" style={{ backgroundColor: "#1b2327" }}>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          {/* TIF monogram */}
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ backgroundColor: "#27b7d8" }}
          >
            TIF
          </div>
          <div>
            <p className="font-semibold text-sm text-white leading-tight">TIF Finance</p>
            <p className="text-[10px] text-white/50 leading-tight">
              {locale === "zh-TW" ? "台中國際教會" : "Taichung International Fellowship"}
            </p>
          </div>
        </div>
      </div>

      {/* Links */}
      <ul className="flex-1 py-3 px-2 space-y-0.5">
        {visibleLinks.map(({ href, key }) => {
          const fullHref = `/${locale}${href}`;
          const active = pathname === fullHref || (href !== "/" && pathname.startsWith(fullHref));
          return (
            <li key={key}>
              <Link
                href={fullHref}
                className={cn(
                  "flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "text-white"
                    : "text-white/60 hover:text-white hover:bg-white/8"
                )}
                style={active ? { backgroundColor: "#27b7d8" } : undefined}
              >
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Bottom actions */}
      <div className="p-3 border-t border-white/10 space-y-0.5">
        <Link
          href={`/${locale}/feedback`}
          className="flex w-full items-center px-3 py-2 rounded-md text-sm text-white/50 hover:text-white hover:bg-white/8 transition-colors"
        >
          Report a Bug
        </Link>
        <button
          onClick={handleSignOut}
          className="w-full text-left px-3 py-2 rounded-md text-sm text-white/50 hover:text-white hover:bg-white/8 transition-colors"
        >
          {t("signOut")}
        </button>
      </div>
    </nav>
  );
}
