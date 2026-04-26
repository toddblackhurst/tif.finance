"use client";

import { useFormState, useFormStatus } from "react-dom";
import { sendInvitation } from "@/app/actions/admin";
import { useState, useEffect } from "react";

interface Campus { id: string; name: string }

const ROLE_OPTIONS = [
  { value: "viewer",          label: "Viewer — read-only access" },
  { value: "campus-finance",  label: "Campus Finance — submit & approve expenses" },
  { value: "admin",           label: "Admin — full access" },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
    >
      {pending ? "Sending…" : "Send Invitation"}
    </button>
  );
}

export function InviteUserForm({ campuses }: { campuses: Campus[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(sendInvitation, null);

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state?.ok]);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold">Invite New Staff</h2>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            + Invite User
          </button>
        )}
      </div>

      {state?.ok && (
        <div className="mb-3 rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Invitation sent to <strong>{state.email}</strong>. They will receive an email with a sign-in link.
        </div>
      )}

      {open && (
        <form
          action={action}
          className="rounded-lg border bg-white p-5 space-y-4"
        >
          {state?.error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {state.error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700">
                Email address <span className="text-red-500">*</span>
              </label>
              <input
                id="invite-email"
                name="email"
                type="email"
                required
                placeholder="staff@example.com"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <label htmlFor="invite-role" className="block text-sm font-medium text-gray-700">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                id="invite-role"
                name="role"
                required
                defaultValue="viewer"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {/* Campus */}
            <div className="space-y-1.5">
              <label htmlFor="invite-campus" className="block text-sm font-medium text-gray-700">
                Campus
              </label>
              <select
                id="invite-campus"
                name="campus_id"
                defaultValue=""
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All campuses</option>
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <SubmitButton />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>

          <p className="text-xs text-gray-500">
            The invitee will receive an email with a secure sign-in link. Their account will be pre-configured with the role and campus you select.
          </p>
        </form>
      )}
    </section>
  );
}
