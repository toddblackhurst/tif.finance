"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DonorSearch } from "@/components/donor-search";
import { createDonation, type DonationFormState } from "@/app/actions/donations";

interface Campus {
  id: string;
  name: string;
}

interface Fund {
  id: string;
  name: string;
}

interface DonationFormProps {
  locale: string;
  campuses: Campus[];
  funds: Fund[];
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

const INITIAL_STATE: DonationFormState = {};

export function DonationForm({ locale, campuses, funds }: DonationFormProps) {
  const t = useTranslations("donations");
  const action = createDonation.bind(null, locale);
  const [state, formAction] = useFormState(action, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-6 max-w-2xl">
      {state.error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {/* Donor */}
      <div className="space-y-1.5">
        <Label>{t("donor")}</Label>
        <DonorSearch value={null} onChange={() => {}} />
        <p className="text-xs text-gray-400">{t("anonymous")}</p>
      </div>

      {/* Gift Date */}
      <div className="space-y-1.5">
        <Label htmlFor="gift_date">{t("giftDate")} *</Label>
        <Input
          id="gift_date"
          name="gift_date"
          type="date"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
        />
      </div>

      {/* Amount */}
      <div className="space-y-1.5">
        <Label htmlFor="amount">{t("amount")} *</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
            NT$
          </span>
          <Input
            id="amount"
            name="amount"
            type="number"
            min="1"
            step="1"
            required
            className="pl-10"
            placeholder="0"
          />
        </div>
      </div>

      {/* Campus */}
      <div className="space-y-1.5">
        <Label htmlFor="campus_id">{t("campus")} *</Label>
        <select
          id="campus_id"
          name="campus_id"
          required
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">—</option>
          {campuses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Fund */}
      <div className="space-y-1.5">
        <Label htmlFor="fund_id">{t("fund")} *</Label>
        <select
          id="fund_id"
          name="fund_id"
          required
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">—</option>
          {funds.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      {/* Payment Method */}
      <div className="space-y-1.5">
        <Label htmlFor="payment_method">{t("paymentMethod")} *</Label>
        <select
          id="payment_method"
          name="payment_method"
          required
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">—</option>
          {(["cash", "card", "bank_transfer", "check", "other"] as const).map((m) => (
            <option key={m} value={m}>
              {t(`paymentMethods.${m}`)}
            </option>
          ))}
        </select>
      </div>

      {/* Deposit Reference */}
      <div className="space-y-1.5">
        <Label htmlFor="deposit_reference">{t("depositReference")}</Label>
        <Input
          id="deposit_reference"
          name="deposit_reference"
          placeholder="e.g. deposit slip #, cheque #"
        />
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">{t("notes")}</Label>
        <Textarea id="notes" name="notes" rows={3} />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <SubmitButton label={t("save")} />
        <Button type="button" variant="outline" asChild>
          <a href={`/${locale}/donations`}>{t("cancel")}</a>
        </Button>
      </div>
    </form>
  );
}
