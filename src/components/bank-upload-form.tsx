"use client";

import { useFormState, useFormStatus } from "react-dom";
import { uploadBankCSV } from "@/app/actions/bank";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Uploading…" : "Upload & Stage"}
    </Button>
  );
}

export function BankUploadForm({ locale }: { locale: string }) {
  const action = uploadBankCSV.bind(null, locale);
  const [state, formAction] = useFormState(action, null);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {state.error}
        </div>
      )}

      <div>
        <Label htmlFor="csv_file">CSV File</Label>
        <Input
          id="csv_file"
          name="csv_file"
          type="file"
          accept=".csv,text/csv"
          required
          className="mt-1"
        />
      </div>

      <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
        Column Mapping — enter the column headers from your bank CSV
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="col_date">
            Date column <span className="text-red-500">*</span>
          </Label>
          <Input
            id="col_date"
            name="col_date"
            placeholder="e.g. 日期 or Date or Transaction Date"
            defaultValue="Date"
            required
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="col_amount">
            Amount column <span className="text-red-500">*</span>
          </Label>
          <Input
            id="col_amount"
            name="col_amount"
            placeholder="e.g. 金額 or Amount or Credit"
            defaultValue="Amount"
            required
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="col_description">Description column (optional)</Label>
          <Input
            id="col_description"
            name="col_description"
            placeholder="e.g. Description or 說明 or Memo"
            defaultValue="Description"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="col_reference">Reference column (optional)</Label>
          <Input
            id="col_reference"
            name="col_reference"
            placeholder="e.g. Reference or Ref or 參考號碼"
            defaultValue="Reference"
            className="mt-1"
          />
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Supported date formats: YYYY-MM-DD, YYYYMMDD, MM/DD/YYYY, YYYY/MM/DD
      </p>

      <SubmitButton />
    </form>
  );
}
