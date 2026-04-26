"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateDonor } from "@/app/actions/donations";

interface DonorEditFormProps {
  locale: string;
  donorId: string;
  campuses: { id: string; name: string }[];
  initialValues: {
    display_name: string;
    email: string | null;
    phone: string | null;
    notes: string | null;
    preferred_campus_id: string | null;
  };
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save Donor"}
    </Button>
  );
}

export function DonorEditForm({ locale, donorId, campuses, initialValues }: DonorEditFormProps) {
  const action = updateDonor.bind(null, locale, donorId);
  const [state, formAction] = useFormState(action, {});

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="display_name">Name *</Label>
        <Input
          id="display_name" name="display_name" required
          defaultValue={initialValues.display_name}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email" name="email" type="email"
          defaultValue={initialValues.email ?? ""}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone" name="phone"
          defaultValue={initialValues.phone ?? ""}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="preferred_campus_id">Preferred Campus</Label>
        <select
          id="preferred_campus_id" name="preferred_campus_id"
          defaultValue={initialValues.preferred_campus_id ?? ""}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">—</option>
          {campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes" name="notes" rows={3}
          defaultValue={initialValues.notes ?? ""}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <SubmitButton />
        <Button type="button" variant="outline" asChild>
          <a href={`/${locale}/donors/${donorId}`}>Cancel</a>
        </Button>
      </div>
    </form>
  );
}
