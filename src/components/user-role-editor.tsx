"use client";

import { useState, useTransition } from "react";
import { updateUserRole, updateUserCampus } from "@/app/actions/admin";

type Role = "admin" | "campus-finance" | "viewer";

interface UserRow {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  assigned_campus_id: string | null;
  campuses: { name: string } | null;
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
  currentUserId,
}: {
  user: UserRow;
  campuses: Campus[];
  currentUserId: string;
}) {
  const [editing, setEditing]         = useState(false);
  const [role, setRole]               = useState(user.role as Role);
  const [campusId, setCampusId]       = useState(user.assigned_campus_id ?? "");
  const [error, setError]             = useState<string | null>(null);
  const [isPending, startTransition]  = useTransition();

  const isSelf = user.id === currentUserId;

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const r1 = await updateUserRole(user.id, role);
      if (r1?.error) { setError(r1.error); return; }
      const r2 = await updateUserCampus(user.id, campusId || null);
      if (r2?.error) { setError(r2.error); return; }
      setEditing(false);
    });
  };

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
          <select
            value={campusId}
            onChange={(e) => setCampusId(e.target.value)}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All campuses</option>
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        ) : (
          <span className="text-gray-600">{user.campuses?.name ?? "All"}</span>
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
              onClick={() => { setEditing(false); setRole(user.role as Role); setCampusId(user.assigned_campus_id ?? ""); setError(null); }}
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
