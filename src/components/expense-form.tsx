"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createExpense, type ExpenseFormState } from "@/app/actions/expenses";

interface Campus { id: string; name: string }

interface ExpenseFormProps {
  locale: string;
  campuses: Campus[];
}

const INITIAL_STATE: ExpenseFormState = {};
const CATEGORIES = ["ministry", "facilities", "staffing", "missions", "vbs", "worship", "admin", "other"] as const;

function Buttons({ draftLabel, submitLabel, cancelHref }: { draftLabel: string; submitLabel: string; cancelHref: string }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex gap-3 pt-2">
      <Button type="submit" name="_action" value="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
      <Button type="submit" name="_action" value="draft" variant="outline" disabled={pending}>
        {pending ? "Saving…" : draftLabel}
      </Button>
      <Button type="button" variant="ghost" asChild>
        <a href={cancelHref}>Cancel</a>
      </Button>
    </div>
  );
}

export function ExpenseForm({ locale, campuses }: ExpenseFormProps) {
  const t = useTranslations("expenses");
  const action = createExpense.bind(null, locale);
  const [state, formAction] = useFormState(action, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-6 max-w-2xl">
      {state.error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="description">{t("description")} *</Label>
        <Input id="description" name="description" required placeholder="e.g. Sunday sound system repair" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="category">{t("category")} *</Label>
        <select
          id="category"
          name="category"
          required
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">—</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{t(`categories.${c}`)}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="expense_date">{t("expenseDate")} *</Label>
        <Input
          id="expense_date"
          name="expense_date"
          type="date"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="amount">{t("amount")} *</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">NT$</span>
          <Input id="amount" name="amount" type="number" min="1" step="1" required className="pl-10" placeholder="0" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="campus_id">{t("campus")} *</Label>
        <select
          id="campus_id"
          name="campus_id"
          required
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">—</option>
          {campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">{t("notes")}</Label>
        <Textarea id="notes" name="notes" rows={3} placeholder="Vendor info, purpose, etc." />
      </div>

      <Buttons
        submitLabel={t("submit")}
        draftLabel={t("saveDraft")}
        cancelHref={`/${locale}/expenses`}
      />
    </form>
  );
}
