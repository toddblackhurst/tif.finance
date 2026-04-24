"use client";

import { useFormState, useFormStatus } from "react-dom";
import { inviteUser } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Campus { id: string; name: string }

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Adding…" : "Add Staff Member"}
    </Button>
  );
}

export function InviteUserForm({ campuses }: { campuses: Campus[] }) {
  const [state, formAction] = useFormState(inviteUser, null);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {state.error}
        </div>
      )}
      {state?.ok && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          ✓ Staff member added. They&apos;ll get the assigned role when they first sign in with Google.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="inv_email">Google email <span className="text-red-500">*</span></Label>
          <Input id="inv_email" name="email" type="email" required placeholder="name@example.com" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="inv_name">Full name</Label>
          <Input id="inv_name" name="full_name" placeholder="Display name" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="inv_role">Role <span className="text-red-500">*</span></Label>
          <select
            id="inv_role"
            name="role"
            required
            defaultValue="viewer"
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="viewer">Viewer</option>
            <option value="campus-finance">Campus Finance</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div>
          <Label htmlFor="inv_campus">Campus (leave blank for all)</Label>
          <select
            id="inv_campus"
            name="campus_id"
            defaultValue=""
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All campuses</option>
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <SubmitBtn />
    </form>
  );
}
