import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BankMatchRow } from "@/components/bank-match-row";

interface BankLine {
  id: string;
  transaction_date: string;
  amount: number;
  description: string | null;
  account_identifier: string | null;
  match_status: "unmatched" | "matched" | "ignored";
  matched_donation_id: string | null;
}

interface Donation {
  id: string;
  gift_date: string;
  amount: number;
  donors: { display_name: string } | null;
  campuses: { name: string } | null;
}

export default async function BankBatchPage({
  params,
}: {
  params: Promise<{ locale: string; batchId: string }>;
}) {
  const { locale, batchId } = await params;
  const supabase = await createClient();

  // Fetch batch lines
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawLines, error } = await (supabase as any)
    .from("bank_import_lines")
    .select("id, transaction_date, amount, description, account_identifier, match_status, matched_donation_id")
    .eq("import_batch_id", batchId)
    .order("transaction_date", { ascending: true });

  if (error || !rawLines || rawLines.length === 0) notFound();

  const typedLines = rawLines as BankLine[];

  // Fetch candidate donations — within ±30 days of any line for quick matching
  const dates = typedLines.map((l) => l.transaction_date).sort();
  const minDate = new Date(dates[0]);
  const maxDate = new Date(dates[dates.length - 1]);
  minDate.setDate(minDate.getDate() - 30);
  maxDate.setDate(maxDate.getDate() + 30);

  const { data: donations } = await supabase
    .from("donations")
    .select("id, gift_date, amount, donors ( display_name ), campuses ( name )")
    .gte("gift_date", minDate.toISOString().slice(0, 10))
    .lte("gift_date", maxDate.toISOString().slice(0, 10))
    .is("deleted_at", null)
    .order("gift_date", { ascending: false })
    .limit(200);

  const typedDonations = (donations ?? []) as unknown as Donation[];

  // Summary
  const total    = typedLines.length;
  const matched  = typedLines.filter((l) => l.match_status === "matched").length;
  const ignored  = typedLines.filter((l) => l.match_status === "ignored").length;
  const unmatched = typedLines.filter((l) => l.match_status === "unmatched").length;

  const fmt = (n: number) => `NT$${Math.round(n).toLocaleString()}`;
  const totalAmount = typedLines.reduce((s, l) => s + Math.abs(l.amount), 0);
  const matchedAmount = typedLines
    .filter((l) => l.match_status === "matched")
    .reduce((s, l) => s + Math.abs(l.amount), 0);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href={`/${locale}/bank`} className="text-sm text-gray-500 hover:text-gray-800">
          ← Bank Reconciliation
        </Link>
      </div>

      <h1 className="text-2xl font-bold">Bank Import — Match Transactions</h1>

      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Rows</p>
          <p className="text-xl font-bold mt-1">{total}</p>
          <p className="text-xs text-gray-400">{fmt(totalAmount)}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-green-600 font-medium uppercase tracking-wide">Matched</p>
          <p className="text-xl font-bold text-green-700 mt-1">{matched}</p>
          <p className="text-xs text-gray-400">{fmt(matchedAmount)}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Ignored</p>
          <p className="text-xl font-bold text-gray-600 mt-1">{ignored}</p>
        </div>
        <div className={`rounded-lg border p-4 ${unmatched > 0 ? "bg-amber-50 border-amber-200" : "bg-white"}`}>
          <p className={`text-xs font-medium uppercase tracking-wide ${unmatched > 0 ? "text-amber-600" : "text-gray-500"}`}>
            Unmatched
          </p>
          <p className={`text-xl font-bold mt-1 ${unmatched > 0 ? "text-amber-700" : "text-gray-600"}`}>
            {unmatched}
          </p>
          {unmatched === 0 && (
            <p className="text-xs text-green-600 font-medium">✓ All reconciled</p>
          )}
        </div>
      </div>

      {/* Lines table */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <p className="text-sm font-medium text-gray-700">
            Transaction Lines — click a row to match it to a donation
          </p>
        </div>
        <div className="divide-y">
          {typedLines.map((line) => {
            const matchedDonation = typedDonations.find(
              (d) => d.id === line.matched_donation_id
            );
            return (
              <BankMatchRow
                key={line.id}
                line={line}
                donations={typedDonations}
                matchedDonation={matchedDonation ?? null}
                locale={locale}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
