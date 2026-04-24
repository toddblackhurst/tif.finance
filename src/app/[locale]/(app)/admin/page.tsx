import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { UserRoleEditor } from "@/components/user-role-editor";

interface UserRow {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  assigned_campus_id: string | null;
  campuses: { name: string } | null;
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

  const [usersResult, campusesResult] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("id, full_name, email, role, assigned_campus_id, campuses(name)")
      .order("full_name"),
    supabase.from("campuses").select("id, name").order("name"),
  ]);

  const users    = (usersResult.data    ?? []) as unknown as UserRow[];
  const campuses = (campusesResult.data ?? []) as Campus[];

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
                  currentUserId={user.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Onboarding instructions */}
      <section className="bg-blue-50 border border-blue-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-blue-800 mb-1">Adding New Staff</h2>
        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>Send them the app URL and ask them to sign in with their Google account</li>
          <li>They&apos;ll appear in this list automatically as <strong>Viewer</strong></li>
          <li>Click <strong>Edit</strong> next to their name to assign the correct role and campus</li>
        </ol>
      </section>
    </div>
  );
}
