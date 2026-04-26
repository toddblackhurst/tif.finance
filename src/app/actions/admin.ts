"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

type Role = "admin" | "campus-finance" | "viewer";

function makeAuthAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", supabase: null, actorId: null };

  const { data } = await supabase.from("user_profiles").select("role").eq("id", user.id).single();
  const role = (data as { role: string } | null)?.role;
  if (role !== "admin") return { error: "Admin only", supabase: null, actorId: null };

  return { error: null, supabase, actorId: user.id };
}

// ─── Update a user's role ─────────────────────────────────────────────────────
export async function updateUserRole(userId: string, role: Role) {
  const { error, supabase } = await requireAdmin();
  if (error || !supabase) return { error };

  const VALID: Role[] = ["admin", "campus-finance", "viewer"];
  if (!VALID.includes(role)) return { error: "Invalid role" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dbErr } = await (supabase as any)
    .from("user_profiles")
    .update({ role })
    .eq("id", userId);

  if (dbErr) return { error: dbErr.message };
  revalidatePath("/admin");
  return { ok: true };
}

// ─── Update a user's campus assignment ───────────────────────────────────────
export async function updateUserCampus(userId: string, campusId: string | null) {
  const { error, supabase } = await requireAdmin();
  if (error || !supabase) return { error };

  // Keep the legacy FK in sync for display purposes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("user_profiles")
    .update({ assigned_campus_id: campusId || null })
    .eq("id", userId);

  // Replace all junction-table rows for this user (RLS uses this table)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: delErr } = await (supabase as any)
    .from("user_campus_assignments")
    .delete()
    .eq("user_id", userId);
  if (delErr) return { error: delErr.message };

  if (campusId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insErr } = await (supabase as any)
      .from("user_campus_assignments")
      .insert({ user_id: userId, campus_id: campusId });
    if (insErr) return { error: insErr.message };
  }

  revalidatePath("/admin");
  return { ok: true };
}

// ─── Invite a new user ────────────────────────────────────────────────────────
export async function sendInvitation(prevState: unknown, formData: FormData) {
  const { error } = await requireAdmin();
  if (error) return { error };

  const email    = (formData.get("email") as string | null)?.trim().toLowerCase() ?? "";
  const role     = (formData.get("role") as string | null) ?? "viewer";
  const campusId = (formData.get("campus_id") as string | null) || null;

  if (!email.includes("@")) return { error: "Enter a valid email address." };
  const VALID_ROLES: Role[] = ["admin", "campus-finance", "viewer"];
  if (!VALID_ROLES.includes(role as Role)) return { error: "Invalid role." };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Send the invitation email via Supabase Auth Admin API
  const authAdmin = makeAuthAdminClient();
  const { data: inviteData, error: inviteError } = await authAdmin.auth.admin.inviteUserByEmail(
    email,
    { redirectTo: `${appUrl}/auth/callback` }
  );
  if (inviteError) return { error: inviteError.message };

  const userId = inviteData.user.id;

  // Pre-create their profile with the assigned role so it's ready on first login
  const dbAdmin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: profileError } = await (dbAdmin as any)
    .from("user_profiles")
    .upsert({
      id:                 userId,
      email,
      full_name:          email.split("@")[0],
      role:               role as Role,
      assigned_campus_id: campusId,
    });
  if (profileError) return { error: (profileError as { message: string }).message };

  if (campusId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: campusErr } = await (dbAdmin as any)
      .from("user_campus_assignments")
      .upsert({ user_id: userId, campus_id: campusId });
    if (campusErr) return { error: (campusErr as { message: string }).message };
  }

  revalidatePath("/en/admin");
  revalidatePath("/zh-TW/admin");
  return { ok: true, email };
}
