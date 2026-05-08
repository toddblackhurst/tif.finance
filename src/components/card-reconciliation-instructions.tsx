"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "card-reconciliation-instructions-v1";

function InstructionList() {
  return (
    <ol className="space-y-2 text-sm text-gray-700 list-decimal pl-5">
      <li>Set the month you are reconciling before you start editing rows.</li>
      <li>Work the page in this order: `Donor Review`, `Classification Mismatch`, then `Extra Card Donations`.</li>
      <li>Open each row with `Edit` and verify donor, campus, fund, amount, deposit reference, and notes.</li>
      <li>Use the ECPay source details in the notes as the source of truth for that card gift.</li>
      <li>If a row is clearly the same gift, correct the existing donation instead of creating a second one.</li>
      <li>If a row looks like a duplicate or something is unclear, stop and flag it for review instead of guessing.</li>
      <li>Before finishing, confirm the imported ECPay total matches the ECPay export for the month.</li>
    </ol>
  );
}

export function CardReconciliationInstructions({
  month,
  children,
}: {
  month: string;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const hasSeen = saved === "true";
    setAcknowledged(hasSeen);
    setShowOverlay(!hasSeen);
    setReady(true);
  }, []);

  function continueToWorkspace() {
    window.localStorage.setItem(STORAGE_KEY, "true");
    setAcknowledged(true);
    setShowOverlay(false);
    setConfirmed(false);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-base font-semibold text-sky-950">Finance Manager Instructions</h2>
            <p className="mt-1 text-sm text-sky-900">
              Read these steps before reconciling <span className="font-medium">{month}</span>, then keep this panel nearby as you work.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowOverlay(true)}>
            Open Full Instructions
          </Button>
        </div>
        <div className="mt-4">
          <InstructionList />
        </div>
      </section>

      {children}

      {ready && showOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-2xl rounded-xl border bg-white shadow-xl">
            <div className="border-b px-6 py-5">
              <h2 className="text-lg font-semibold text-slate-900">Read Before Reconciling</h2>
              <p className="mt-1 text-sm text-slate-600">
                These are the working instructions for the finance manager on the card reconciliation page.
              </p>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
              <InstructionList />

              <label className="mt-5 flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                <span>
                  I have read these instructions and I will use the ECPay source details as the source of truth while I work.
                </span>
              </label>
            </div>

            <div className="flex items-center justify-between gap-3 border-t bg-slate-50 px-6 py-4">
              <p className="text-xs text-slate-500">
                The work area stays available below, and these instructions can be reopened at any time.
              </p>
              <div className="flex items-center gap-2">
                {acknowledged && (
                  <Button type="button" variant="outline" onClick={() => setShowOverlay(false)}>
                    Close
                  </Button>
                )}
                <Button type="button" disabled={!confirmed} onClick={continueToWorkspace}>
                  Continue to Reconciliation
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
