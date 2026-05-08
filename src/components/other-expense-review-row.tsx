"use client";

import type { ReactNode } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  keepOtherExpense,
  reclassifyOtherExpense,
  type ExpenseCategoryReviewState,
} from "@/app/actions/expenses";

const CATEGORIES = [
  "ministry",
  "facilities",
  "staffing",
  "missions",
  "vbs",
  "worship",
  "admin",
] as const;

interface OtherExpenseReviewRowProps {
  locale: string;
  expense: {
    id: string;
    expense_date: string;
    description: string;
    amount: number;
    notes: string | null;
    status: string;
    campuses: { name: string } | null;
  };
  categoryLabels: Record<(typeof CATEGORIES)[number], string>;
}

function SubmitButton({ children, variant = "default" }: { children: ReactNode; variant?: "default" | "outline" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} disabled={pending}>
      {pending ? "Saving..." : children}
    </Button>
  );
}

function ReclassifyForm({
  locale,
  expenseId,
  categoryLabels,
}: {
  locale: string;
  expenseId: string;
  categoryLabels: OtherExpenseReviewRowProps["categoryLabels"];
}) {
  const action = reclassifyOtherExpense.bind(null, locale, expenseId);
  const [state, formAction] = useFormState<ExpenseCategoryReviewState, FormData>(action, {});

  if (state.success) {
    return <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">Reclassified.</p>;
  }

  return (
    <form action={formAction} className="space-y-2">
      <div className="flex items-center gap-2">
        <select
          name="category"
          required
          defaultValue=""
          className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="" disabled>
            Reclassify as...
          </option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {categoryLabels[category]}
            </option>
          ))}
        </select>
        <SubmitButton>Apply</SubmitButton>
      </div>
      <input
        name="review_note"
        placeholder="Optional note"
        className="h-8 w-full rounded-md border border-gray-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

function KeepOtherForm({ locale, expenseId }: { locale: string; expenseId: string }) {
  const action = keepOtherExpense.bind(null, locale, expenseId);
  const [state, formAction] = useFormState<ExpenseCategoryReviewState, FormData>(action, {});

  if (state.success) {
    return <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">Kept as Other.</p>;
  }

  return (
    <form action={formAction} className="space-y-2">
      <input
        name="review_note"
        placeholder="Why keep it as Other? Optional"
        className="h-8 w-full rounded-md border border-gray-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="flex items-center gap-2">
        <SubmitButton variant="outline">Leave as Other</SubmitButton>
        {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}

export function OtherExpenseReviewRow({ locale, expense, categoryLabels }: OtherExpenseReviewRowProps) {
  return (
    <tr className="align-top hover:bg-gray-50">
      <td className="px-4 py-3 whitespace-nowrap text-sm">{expense.expense_date}</td>
      <td className="px-4 py-3">
        <p className="font-medium text-gray-900">{expense.description}</p>
        <p className="text-xs text-gray-500">{expense.notes || "No notes"}</p>
      </td>
      <td className="px-4 py-3 text-sm">{expense.campuses?.name ?? "-"}</td>
      <td className="px-4 py-3 text-right font-mono text-sm">NT${expense.amount.toLocaleString()}</td>
      <td className="px-4 py-3 text-xs uppercase tracking-wide text-gray-500">{expense.status}</td>
      <td className="px-4 py-3 min-w-80">
        <div className="grid gap-3">
          <ReclassifyForm locale={locale} expenseId={expense.id} categoryLabels={categoryLabels} />
          <KeepOtherForm locale={locale} expenseId={expense.id} />
        </div>
      </td>
    </tr>
  );
}
