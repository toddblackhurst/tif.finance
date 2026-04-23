"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { approveExpense, rejectExpense, markExpensePaid, submitDraftExpense } from "@/app/actions/expenses";

interface ExpenseActionPanelProps {
  locale: string;
  expenseId: string;
  status: string;
  role: string;
  currentUserId: string;
  submitterId: string;
}

export function ExpenseActionPanel({
  locale,
  expenseId,
  status,
  role,
  currentUserId,
  submitterId,
}: ExpenseActionPanelProps) {
  const t = useTranslations("expenses");
  const [notes, setNotes] = useState("");
  const [checkNumber, setCheckNumber] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canApprove = (role === "admin" || role === "campus-finance") && status === "submitted";
  const canPay = role === "admin" && status === "approved";
  const canSubmit = status === "draft" && currentUserId === submitterId;

  if (!canApprove && !canPay && !canSubmit) return null;

  async function handleApprove() {
    setLoading("approve");
    setError(null);
    const result = await approveExpense(locale, expenseId, notes || null);
    setLoading(null);
    if (result.error) setError(result.error);
  }

  async function handleReject() {
    setLoading("reject");
    setError(null);
    const result = await rejectExpense(locale, expenseId, notes || null);
    setLoading(null);
    if (result.error) setError(result.error);
  }

  async function handlePay() {
    setLoading("pay");
    setError(null);
    const result = await markExpensePaid(locale, expenseId, checkNumber || null);
    setLoading(null);
    if (result.error) setError(result.error);
  }

  return (
    <div className="bg-white rounded-lg border p-6 space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {canApprove && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="approval-notes">{t("approvalNotes")}</Label>
            <Textarea
              id="approval-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes…"
            />
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleApprove}
              disabled={loading !== null}
            >
              {loading === "approve" ? "Approving…" : t("approve")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={loading !== null}
            >
              {loading === "reject" ? "Rejecting…" : t("reject")}
            </Button>
          </div>
        </>
      )}

      {canPay && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="check-number">Check / Reference Number</Label>
            <Input
              id="check-number"
              value={checkNumber}
              onChange={(e) => setCheckNumber(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <Button
            onClick={handlePay}
            disabled={loading !== null}
          >
            {loading === "pay" ? "Marking paid…" : t("markPaid")}
          </Button>
        </>
      )}

      {canSubmit && (
        <>
          <p className="text-sm text-gray-500">This expense is saved as a draft. Submit it for approval when ready.</p>
          <Button
            onClick={async () => {
              setLoading("submit");
              setError(null);
              const result = await submitDraftExpense(locale, expenseId);
              setLoading(null);
              if (result.error) setError(result.error);
            }}
            disabled={loading !== null}
          >
            {loading === "submit" ? "Submitting…" : t("submit")}
          </Button>
        </>
      )}
    </div>
  );
}
