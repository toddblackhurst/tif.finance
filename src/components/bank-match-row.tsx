"use client";

import { useState, useTransition } from "react";
import { matchBankLine, ignoreBankLine, unmatchBankLine } from "@/app/actions/bank";
import { Button } from "@/components/ui/button";

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

interface Props {
  line: BankLine;
  donations: Donation[];
  matchedDonation: Donation | null;
  locale: string;
}

const STATUS_STYLE = {
  unmatched: "bg-amber-50 border-l-4 border-amber-400",
  matched:   "bg-green-50 border-l-4 border-green-400",
  ignored:   "bg-gray-50 border-l-4 border-gray-300 opacity-60",
};

export function BankMatchRow({ line, donations, matchedDonation, locale }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selectedDonationId, setSelectedDonationId] = useState(
    line.matched_donation_id ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fmt = (n: number) => `NT$${Math.round(Math.abs(n)).toLocaleString()}`;

  // Sort candidate donations: closest amount first
  const candidates = donations
    .slice()
    .sort((a, b) => {
      const da = Math.abs(Math.abs(a.amount) - Math.abs(line.amount));
      const db = Math.abs(Math.abs(b.amount) - Math.abs(line.amount));
      return da - db;
    })
    .slice(0, 50);

  const handleMatch = () => {
    if (!selectedDonationId) return;
    setError(null);
    startTransition(async () => {
      const res = await matchBankLine(locale, line.id, selectedDonationId);
      if (res?.error) setError(res.error);
      else setExpanded(false);
    });
  };

  const handleIgnore = () => {
    setError(null);
    startTransition(async () => {
      const res = await ignoreBankLine(locale, line.id);
      if (res?.error) setError(res.error);
      else setExpanded(false);
    });
  };

  const handleUnmatch = () => {
    setError(null);
    startTransition(async () => {
      const res = await unmatchBankLine(locale, line.id);
      if (res?.error) setError(res.error);
    });
  };

  return (
    <div className={`${STATUS_STYLE[line.match_status]} transition-colors`}>
      {/* Row summary */}
      <button
        type="button"
        className="w-full px-4 py-3 flex items-start justify-between gap-4 text-left hover:bg-black/5 transition-colors"
        onClick={() => line.match_status !== "ignored" && setExpanded((e) => !e)}
        disabled={line.match_status === "ignored"}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold">{fmt(line.amount)}</span>
            <span className="text-sm text-gray-600">{line.transaction_date}</span>
            {line.description && (
              <span className="text-sm text-gray-500 truncate">{line.description}</span>
            )}
          </div>
          {matchedDonation && (
            <p className="mt-0.5 text-xs text-green-700">
              ✓ Matched to {matchedDonation.donors?.display_name ?? "Anonymous"} — {matchedDonation.gift_date} — {fmt(matchedDonation.amount)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {line.match_status === "matched" && (
            <button
              type="button"
              className="text-xs text-red-500 hover:text-red-700 underline"
              onClick={(e) => { e.stopPropagation(); handleUnmatch(); }}
              disabled={isPending}
            >
              Unmatch
            </button>
          )}
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            line.match_status === "matched" ? "bg-green-200 text-green-800" :
            line.match_status === "ignored" ? "bg-gray-200 text-gray-600" :
            "bg-amber-200 text-amber-800"
          }`}>
            {line.match_status}
          </span>
          {line.match_status === "unmatched" && (
            <span className="text-gray-400 text-xs">{expanded ? "▲" : "▼"}</span>
          )}
        </div>
      </button>

      {/* Expanded matching panel */}
      {expanded && line.match_status === "unmatched" && (
        <div className="px-4 pb-4 space-y-3">
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Match to donation (sorted by closest amount)
              </label>
              <select
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedDonationId}
                onChange={(e) => setSelectedDonationId(e.target.value)}
              >
                <option value="">— Select donation —</option>
                {candidates.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.gift_date} · {d.donors?.display_name ?? "Anonymous"} · {fmt(d.amount)} · {d.campuses?.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              size="sm"
              onClick={handleMatch}
              disabled={!selectedDonationId || isPending}
            >
              {isPending ? "Saving…" : "Match"}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleIgnore}
              disabled={isPending}
              className="text-gray-600"
            >
              Ignore (not a donation)
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setExpanded(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
