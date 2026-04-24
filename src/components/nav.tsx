"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/",         key: "dashboard",  adminOnly: false },
  { href: "/donations",key: "donations",  adminOnly: false },
  { href: "/expenses", key: "expenses",   adminOnly: false },
  { href: "/donors",   key: "donors",     adminOnly: false },
  { href: "/reports",  key: "reports",    adminOnly: false },
  { href: "/bank",     key: "bank",       adminOnly: true  },
  { href: "/admin",    key: "admin",      adminOnly: true  },
] as const;

export function Nav({ locale, role }: { locale: string; role: string }) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = `/${locale}/login`;
  }

  const adminLinks = role === "admin"
    ? NAV_LINKS
    : NAV_LINKS.filter((l) => !l.adminOnly);

  return (
    <nav className="flex flex-col h-full bg-white border-r">
      <div className="px-4 py-5 border-b">
        <h1 className="font-bold text-lg">TIF Finance</h1>
        <p className="text-xs text-gray-500">
          {locale === "zh-TW" ? "台中國際教會" : "Taichung International Fellowship"}
        </p>
      </div>
      <ul className="flex-1 py-4 px-2 space-y-1">
        {adminLinks.map(({ href, key }) => {
          const fullHref = `/${locale}${href}`;
          const active = pathname === fullHref || (href !== "/" && pathname.startsWith(fullHref));
          return (
            <li key={key}>
              <Link
                href={fullHref}
                className={cn(
                  "block px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="p-4 border-t">
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleSignOut}>
          {t("signOut")}
        </Button>
      </div>
    </nav>
  );
}
