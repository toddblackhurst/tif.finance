"use client";

import { useFormState, useFormStatus } from "react-dom";
import { uploadEcpayCSV } from "@/app/actions/ecpay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Importing..." : "Upload & Import"}
    </Button>
  );
}

export function EcpayUploadForm({ locale }: { locale: string }) {
  const action = uploadEcpayCSV.bind(null, locale);
  const [state, formAction] = useFormState(action, null);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.error}
        </div>
      )}

      <div>
        <Label htmlFor="ecpay_csv_file">ECPay CSV File</Label>
        <Input
          id="ecpay_csv_file"
          name="csv_file"
          type="file"
          accept=".csv,text/csv"
          required
          className="mt-1"
        />
      </div>

      <p className="text-xs text-gray-500">
        Imports ECPay credit-card giving rows into Donations. Existing merchant order numbers are skipped,
        and uncertain donor matches stay in the Donor Review queue.
      </p>

      <SubmitButton />
    </form>
  );
}
