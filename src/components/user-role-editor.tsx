"use client";

import { useState, useTransition } from "react";
import { updateUserRole, updateUserCampuses } from "@/app/actions/admin";

type Role = "admin" | "campus-finance" | "viewer";

interface UserRow {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  assigned_campus_id: string | null;
}

interface Campus { id: string; name: string }

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  "campus-finance": "Campus Finance",
  viewer: "Viewer",
};

const ROLE_COLORS: Record<string, string> = {
  admin:            "bg-red-100 text-red-700",
  "campus-finance": "bg-blue-100 text-blue-700",
  viewer:           "bg-gray-100 text-gray-600",
};

export function UserRoleEditor({
  user,
  campuses,
  assignedCampusNames,
  assignedCampusIds,
  currentUserId,
}: {
  user: UserRow;
  campuses: Campus[];
  assignedCampusNames: string[];
  assignedCampusIds: string[];
  currentUserId: string;
}) {
  const [editing, setEditing]         = useState(false);
  const [role, setRole]               = useState(user.role as Role);
  const [campusIds, setCampusIds]     = useState<string[]>(assignedCampusIds);
  const [error, setError]             = useState<string | null>(null);
  const [isPending, startTransition]  = useTransition();

  const isSelf = user.id === currentUserId;

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const r1 = await updateUserRole(user.id, role);
      if (r1?.error) { setError(r1.error); return; }
      const r2 = await updateUserCampuses(user.id, campusIds);
      if (r2?.error) { setError(r2.error); return; }
      setEditing(false);
    });
  };

  const toggleCampus = (campusId: string) => {
    setCampusIds((current) =>
      current.includes(campusId)
        ? current.filter((id) => id !== campusId)
        : [...current, campusId]
    );
  };

  const campusDisplay = assignedCampusNames.length
    ? assignedCampusNames.join(", ")
    : user.role === "admin" ? "All" : "None";

  return (
    <tr className={`hover:bg-gray-50 ${editing ? "bg-blue-50" : ""}`}>
      <td className="px-4 py-3 font-medium">
        {user.full_name ?? "—"}
        {isSelf && <span className="ml-1 text-xs text-gray-400">(you)</span>}
      </td>
      <td className="px-4 py-3 text-gray-600 text-xs">{user.email ?? "—"}</td>

      {/* Role */}
      <td className="px-4 py-3">
        {editing ? (
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSelf}
          >
            <option value="admin">Admin</option>
            <option value="campus-finance">Campus Finance</option>
            <option value="viewer">Viewer</option>
          </select>
        ) : (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user.role] ?? ""}`}>
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
        )}
      </td>

      {/* Campus */}
      <td className="px-4 py-3">
        {editing ? (
          <div className="grid gap-1 text-xs">
            {campuses.map((c) => (
              <label key={c.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={campusIds.includes(c.id)}
                  onChange={() => toggleCampus(c.id)}
                  className="h-3.5 w-3.5 rounded border-gray-300"
                />
                <span>{c.name}</span>
              </label>
            ))}
            {role === "admin" && (
              <p className="text-[11px] text-gray-400">Admins can see all campuses even with no boxes checked.</p>
            )}
          </div>
        ) : (
          <span className="text-gray-600">{campusDisplay}</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        {editing ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={isPending || isSelf}
              className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1 rounded"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => { setEditing(false); setRole(user.role as Role); setCampusIds(assignedCampusIds); setError(null); }}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
            {error && <span className="text-xs text-red-600">{error}</span>}
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-blue-600 hover:underline"
          >
            Edit
          </button>
        )}
      </td>
    </tr>
  );
}
