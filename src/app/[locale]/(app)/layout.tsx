import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: profileData } = await supabase
    .from("user_profiles")
    .select("role, assigned_campus_id")
    .eq("id", user.id)
    .single();

  const profile = profileData as { role: string; assigned_campus_id: string | null } | null;
  const role = profile?.role ?? "viewer";

  return (
    <div className="flex h-screen">
      <aside className="w-56 flex-shrink-0">
        <Nav locale={locale} role={role} />
      </aside>
      <main className="flex-1 overflow-auto bg-gray-50 p-6">
        {children}
      </main>
    </div>
  );
}
