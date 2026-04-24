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

  // Load profile — auto-create on first login if missing
  let { data: profileData } = await supabase
    .from("user_profiles")
    .select("role, assigned_campus_id")
    .eq("id", user.id)
    .single();

  if (!profileData) {
    // First login: check if admin pre-seeded a profile by this email
    const email = user.email?.toLowerCase() ?? "";
    const { data: seeded } = await supabase
      .from("user_profiles")
      .select("id, role, assigned_campus_id")
      .eq("email", email)
      .neq("id", user.id)   // placeholder UUID, not yet claimed
      .maybeSingle();

    if (seeded) {
      // Claim the pre-seeded profile: update its ID to the real auth UUID
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("user_profiles")
        .update({ id: user.id })
        .eq("id", seeded.id);
      profileData = { role: seeded.role, assigned_campus_id: seeded.assigned_campus_id };
    } else {
      // No pre-seed: create a viewer profile automatically
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("user_profiles").insert({
        id:        user.id,
        email:     user.email,
        full_name: user.user_metadata?.full_name ?? user.email,
        role:      "viewer",
      });
      profileData = { role: "viewer", assigned_campus_id: null };
    }
  }

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
