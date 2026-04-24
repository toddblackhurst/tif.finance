"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Role = "admin" | "campus-finance" | "viewer";

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

  const { error: dbErr } = await supabase
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

  const { error: dbErr } = await supabase
    .from("user_profiles")
    .update({ assigned_campus_id: campusId || null })
    .eq("id", userId);

  if (dbErr) return { error: dbErr.message };
  revalidatePath("/admin");
  return { ok: true };
}

