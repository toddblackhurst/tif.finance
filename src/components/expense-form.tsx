"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createExpense, updateExpense, type ExpenseFormState } from "@/app/actions/expenses";

interface Campus { id: string; name: string }

type PaymentType = "reimbursement" | "petty_cash";

interface ExpenseFormProps {
  locale: string;
  campuses: Campus[];
  editId?: string;
  initialValues?: {
    description: string;
    category: string;
    expense_date: string;
    amount: number;
    campus_id: string;
    notes?: string | null;
    payment_type?: PaymentType | null;
    bank_code?: string | null;
    bank_account_number?: string | null;
  };
}

const INITIAL_STATE: ExpenseFormState = {};
const CATEGORIES = ["ministry", "facilities", "staffing", "missions", "vbs", "worship", "admin", "other"] as const;

function Buttons({ draftLabel, submitLabel, cancelHref, editMode }: {
  draftLabel: string; submitLabel: string; cancelHref: string; editMode?: boolean;
}) {
  const { pending } = useFormStatus();
  if (editMode) {
    return (
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <Button type="button" variant="outline" asChild>
          <a href={cancelHref}>Cancel</a>
        </Button>
      </div>
    );
  }
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

export function ExpenseForm({ locale, campuses, editId, initialValues }: ExpenseFormProps) {
  const t = useTranslations("expenses");
  const action = editId
    ? updateExpense.bind(null, locale, editId)
    : createExpense.bind(null, locale);
  const [state, formAction] = useFormState(action, INITIAL_STATE);

  const [paymentType, setPaymentType] = useState<PaymentType>(
    initialValues?.payment_type ?? "reimbursement"
  );

  return (
    <form action={formAction} className="space-y-6 max-w-2xl">
      {state.error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="description">{t("description")} *</Label>
        <Input
          id="description" name="description" required
          placeholder="e.g. Sunday sound system repair"
          defaultValue={initialValues?.description ?? ""}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="category">{t("category")} *</Label>
        <select
          id="category" name="category" required
          defaultValue={initialValues?.category ?? ""}
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
          id="expense_date" name="expense_date" type="date" required
          defaultValue={initialValues?.expense_date ?? new Date().toISOString().slice(0, 10)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="amount">{t("amount")} *</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">NT$</span>
          <Input
            id="amount" name="amount" type="number" min="1" step="1" required
            className="pl-10" placeholder="0"
            defaultValue={initialValues?.amount ?? ""}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="campus_id">{t("campus")} *</Label>
        <select
          id="campus_id" name="campus_id" required
          defaultValue={initialValues?.campus_id ?? ""}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">—</option>
          {campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* ── Payment type ───────────────────────────────────────────────── */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-700">
          {t("paymentType")} <span className="text-red-500">*</span>
        </legend>
        <input type="hidden" name="payment_type" value={paymentType} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(["reimbursement", "petty_cash"] as const).map((pt) => (
            <button
              key={pt}
              type="button"
              onClick={() => setPaymentType(pt)}
              className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                paymentType === pt
                  ? "border-blue-500 bg-blue-50 text-blue-900"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                paymentType === pt ? "border-blue-500 bg-blue-500" : "border-gray-300"
              }`}>
                {paymentType === pt && (
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                )}
              </span>
              <span>{t(`paymentTypes.${pt}`)}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {/* ── Bank details (reimbursement only) ─────────────────────────── */}
      {paymentType === "reimbursement" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-4">
          <p className="text-sm font-medium text-amber-800">{t("bankInfo")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="bank_code">{t("bankCode")} *</Label>
              <Input
                id="bank_code" name="bank_code"
                required={paymentType === "reimbursement"}
                placeholder={t("bankCodePlaceholder")}
                maxLength={10}
                defaultValue={initialValues?.bank_code ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bank_account_number">{t("bankAccountNumber")} *</Label>
              <Input
                id="bank_account_number" name="bank_account_number"
                required={paymentType === "reimbursement"}
                placeholder={t("bankAccountPlaceholder")}
                maxLength={20}
                defaultValue={initialValues?.bank_account_number ?? ""}
              />
            </div>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="notes">{t("notes")}</Label>
        <Textarea id="notes" name="notes" rows={3} placeholder="Vendor info, purpose, etc."
          defaultValue={initialValues?.notes ?? ""}
        />
      </div>

      <Buttons
        submitLabel={editId ? "Save Changes" : t("submit")}
        draftLabel={t("saveDraft")}
        cancelHref={editId ? `/${locale}/expenses/${editId}` : `/${locale}/expenses`}
        editMode={!!editId}
      />
    </form>
  );
}
