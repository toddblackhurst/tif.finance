"use client";

import { useFormState, useFormStatus } from "react-dom";
import { submitFeedback } from "@/app/actions/feedback";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useParams } from "next/navigation";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Sending…" : "Send"}
    </Button>
  );
}

export default function FeedbackPage() {
  const { locale } = useParams<{ locale: string }>();
  const [state, action] = useFormState(submitFeedback, { error: undefined, success: false });

  if (state.success) {
    return (
      <div className="max-w-lg space-y-4">
        <h1 className="text-2xl font-bold">Report a Bug</h1>
        <div className="rounded-lg border bg-white p-8 text-center space-y-3">
          <p className="text-2xl">✓</p>
          <p className="font-medium">Thanks — your report was sent.</p>
          <p className="text-sm text-gray-500">We&apos;ll review it and follow up if needed.</p>
          <Link href={`/${locale}`} className="inline-block text-sm text-blue-600 hover:underline mt-2">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Report a Bug / Request a Fix</h1>

      <div className="rounded-lg border bg-white p-6">
        <form action={action} className="space-y-5">
          {state.error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {state.error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Type</label>
            <select
              name="type"
              defaultValue="bug"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="bug">🐛 Bug — something is broken</option>
              <option value="feature">💡 Request — something to add or change</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Page or area affected
            </label>
            <input
              type="text"
              name="page"
              placeholder="e.g. Expenses list, Public form, Admin page…"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Describe the issue <span className="text-red-500">*</span>
            </label>
            <textarea
              name="description"
              rows={5}
              required
              placeholder="What happened? What did you expect to happen? Steps to reproduce…"
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <SubmitButton />
            <Link href={`/${locale}`} className="text-sm text-gray-500 hover:text-gray-700">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
