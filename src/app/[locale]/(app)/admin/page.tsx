import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { UserRoleEditor } from "@/components/user-role-editor";
import { InviteUserForm } from "@/components/invite-user-form";

interface UserRow {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  assigned_campus_id: string | null;
}

interface Campus {
  id: string;
  name: string;
}

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: profileData } = await supabase
    .from("user_profiles").select("role").eq("id", user.id).single();
  if ((profileData as { role: string } | null)?.role !== "admin") redirect(`/${locale}`);

  const [usersResult, campusesResult, assignmentsResult] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("id, full_name, email, role, assigned_campus_id")
      .order("full_name"),
    supabase.from("campuses").select("id, name").order("name"),
    supabase
      .from("user_campus_assignments")
      .select("user_id, campuses(name)"),
  ]);

  const users    = (usersResult.data    ?? []) as unknown as UserRow[];
  const campuses = (campusesResult.data ?? []) as Campus[];

  // Build userId → campus name list from junction table
  const campusMap = new Map<string, string[]>();
  for (const row of (assignmentsResult.data ?? []) as unknown as { user_id: string; campuses: { name: string } | null }[]) {
    if (!row.campuses?.name) continue;
    const list = campusMap.get(row.user_id) ?? [];
    list.push(row.campuses.name);
    campusMap.set(row.user_id, list);
  }

  const roleCounts = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1; return acc;
  }, {});

  return (
    <div className="space-y-8 max-w-4xl">
      <h1 className="text-2xl font-bold">Admin</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Admins",         key: "admin",          color: "text-red-700 bg-red-50 border-red-200" },
          { label: "Campus Finance", key: "campus-finance",  color: "text-blue-700 bg-blue-50 border-blue-200" },
          { label: "Viewers",        key: "viewer",          color: "text-gray-700 bg-gray-50 border-gray-200" },
        ].map(({ label, key, color }) => (
          <div key={key} className={`rounded-lg border p-4 ${color}`}>
            <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
            <p className="text-3xl font-bold mt-1">{roleCounts[key] ?? 0}</p>
          </div>
        ))}
      </div>

      {/* User table */}
      <section>
        <h2 className="text-base font-semibold mb-3">Staff Users</h2>
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Campus</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <UserRoleEditor
                  key={u.id}
                  user={u}
                  campuses={campuses}
                  assignedCampusNames={campusMap.get(u.id) ?? []}
                  currentUserId={user.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Invite new staff */}
      <InviteUserForm campuses={campuses} />
    </div>
  );
}
