"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteExpense } from "@/app/actions/expenses";
import { deleteDonation } from "@/app/actions/donations";
import { deleteBankLine } from "@/app/actions/bank";

type SummerDeleteKind = "bank" | "donation" | "expense";

interface SummerDeleteButtonProps {
  locale: string;
  recordId: string;
  kind: SummerDeleteKind;
}

const LABELS: Record<SummerDeleteKind, string> = {
  bank: "bank transaction",
  donation: "donation",
  expense: "expense",
};

export function SummerDeleteButton({ locale, recordId, kind }: SummerDeleteButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(`Delete this ${LABELS[kind]}? This cannot be undone.`)) return;

    startTransition(async () => {
      const result = kind === "bank"
        ? await deleteBankLine(locale, recordId)
        : kind === "donation"
          ? await deleteDonation(locale, recordId)
          : await deleteExpense(locale, recordId);

      if (result?.error) {
        window.alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="destructive"
      onClick={handleDelete}
      disabled={isPending}
    >
      {isPending ? "Deleting…" : "Delete"}
    </Button>
  );
}
