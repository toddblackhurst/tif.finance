import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM ?? "TIF Finance <onboarding@resend.dev>";

function esc(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Expense submitted → notify approvers ────────────────────────────────────

export async function sendExpenseSubmittedEmail({
  approverEmails,
  submitterName,
  description,
  amount,
  campus,
  expenseId,
  locale,
}: {
  approverEmails: string[];
  submitterName: string;
  description: string;
  amount: number;
  campus: string;
  expenseId: string;
  locale: string;
}) {
  if (!approverEmails.length) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const link = `${appUrl}/${locale}/expenses/${expenseId}`;
  const fmt = (n: number) => `NT$${Math.round(n).toLocaleString()}`;

  await resend.emails.send({
    from: FROM,
    to: approverEmails,
    subject: `[TIF Finance] Expense needs approval — ${fmt(amount)} · ${esc(campus)}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#222;">
        <h2 style="color:#1d4ed8;margin-bottom:4px;">Expense Submitted for Approval</h2>
        <p style="color:#555;margin-top:0;">An expense requires your review.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
          <tr><td style="padding:6px 0;color:#666;width:120px;">Submitted by</td><td><strong>${esc(submitterName)}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#666;">Description</td><td><strong>${esc(description)}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#666;">Amount</td><td><strong style="color:#b91c1c;">${fmt(amount)}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#666;">Campus</td><td>${esc(campus)}</td></tr>
        </table>
        <a href="${link}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;">
          Review Expense →
        </a>
        <p style="margin-top:24px;font-size:12px;color:#999;">TIF Finance · Internal use only</p>
      </div>
    `,
  });
}

// ─── Public submission → confirm receipt to submitter ─────────────────────────

export async function sendPublicSubmissionConfirmationEmail({
  submitterEmail,
  submitterName,
  description,
  amount,
  campus,
}: {
  submitterEmail: string;
  submitterName: string;
  description: string;
  amount: number;
  campus: string;
}) {
  const fmt = (n: number) => `NT$${Math.round(n).toLocaleString()}`;

  await resend.emails.send({
    from: FROM,
    to: submitterEmail,
    subject: `[TIF Finance] Expense request received — ${fmt(amount)}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#222;">
        <h2 style="color:#1d4ed8;margin-bottom:4px;">Request Received ✓</h2>
        <p style="color:#555;margin-top:0;">Hi ${esc(submitterName)}, we've received your expense request. The campus finance team will review it and follow up with you.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
          <tr><td style="padding:6px 0;color:#666;width:120px;">Description</td><td><strong>${esc(description)}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#666;">Amount</td><td><strong>${fmt(amount)}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#666;">Campus</td><td>${esc(campus)}</td></tr>
        </table>
        <p style="margin-top:24px;font-size:12px;color:#999;">Taichung International Fellowship · Finance System</p>
      </div>
    `,
  });
}

// ─── Expense approved → notify submitter ─────────────────────────────────────

export async function sendExpenseApprovedEmail({
  submitterEmail,
  submitterName,
  description,
  amount,
  approverName,
  expenseId,
  locale,
}: {
  submitterEmail: string;
  submitterName: string;
  description: string;
  amount: number;
  approverName: string;
  expenseId: string | null;
  locale: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const link = expenseId ? `${appUrl}/${locale}/expenses/${expenseId}` : null;
  const fmt = (n: number) => `NT$${Math.round(n).toLocaleString()}`;

  await resend.emails.send({
    from: FROM,
    to: submitterEmail,
    subject: `[TIF Finance] Expense approved — ${fmt(amount)}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#222;">
        <h2 style="color:#15803d;margin-bottom:4px;">Expense Approved ✓</h2>
        <p style="color:#555;margin-top:0;">Hi ${esc(submitterName)}, your expense has been approved and will be processed for payment soon.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
          <tr><td style="padding:6px 0;color:#666;width:120px;">Description</td><td><strong>${esc(description)}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#666;">Amount</td><td><strong>${fmt(amount)}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#666;">Approved by</td><td>${esc(approverName)}</td></tr>
        </table>
        ${link ? `<a href="${link}" style="display:inline-block;background:#15803d;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;">View Expense →</a>` : ""}
        <p style="margin-top:24px;font-size:12px;color:#999;">TIF Finance · Internal use only</p>
      </div>
    `,
  });
}

// ─── Expense approved → notify treasurer to pay ──────────────────────────────

export async function sendExpenseNeedsPaymentEmail({
  treasurerEmails,
  submitterName,
  description,
  amount,
  campus,
  approverName,
  expenseId,
  locale,
}: {
  treasurerEmails: string[];
  submitterName: string;
  description: string;
  amount: number;
  campus: string;
  approverName: string;
  expenseId: string;
  locale: string;
}) {
  if (!treasurerEmails.length) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const link = `${appUrl}/${locale}/expenses/${expenseId}`;
  const fmt = (n: number) => `NT$${Math.round(n).toLocaleString()}`;

  await resend.emails.send({
    from: FROM,
    to: treasurerEmails,
    subject: `[TIF Finance] Ready to pay — ${fmt(amount)} · ${esc(campus)}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#222;">
        <h2 style="color:#7c3aed;margin-bottom:4px;">Expense Approved — Payment Needed</h2>
        <p style="color:#555;margin-top:0;">An expense has been approved and is ready for payment.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
          <tr><td style="padding:6px 0;color:#666;width:120px;">Submitted by</td><td><strong>${esc(submitterName)}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#666;">Description</td><td><strong>${esc(description)}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#666;">Amount</td><td><strong style="color:#7c3aed;">${fmt(amount)}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#666;">Campus</td><td>${esc(campus)}</td></tr>
          <tr><td style="padding:6px 0;color:#666;">Approved by</td><td>${esc(approverName)}</td></tr>
        </table>
        <a href="${link}" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;">
          Mark as Paid →
        </a>
        <p style="margin-top:24px;font-size:12px;color:#999;">TIF Finance · Internal use only</p>
      </div>
    `,
  });
}

// ─── Expense rejected → notify submitter ─────────────────────────────────────

export async function sendExpenseRejectedEmail({
  submitterEmail,
  submitterName,
  description,
  amount,
  approverName,
  rejectionNote,
  expenseId,
  locale,
}: {
  submitterEmail: string;
  submitterName: string;
  description: string;
  amount: number;
  approverName: string;
  rejectionNote: string | null;
  expenseId: string | null;
  locale: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const link = expenseId ? `${appUrl}/${locale}/expenses/${expenseId}` : null;
  const fmt = (n: number) => `NT$${Math.round(n).toLocaleString()}`;

  await resend.emails.send({
    from: FROM,
    to: submitterEmail,
    subject: `[TIF Finance] Expense not approved — ${fmt(amount)}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#222;">
        <h2 style="color:#b91c1c;margin-bottom:4px;">Expense Not Approved</h2>
        <p style="color:#555;margin-top:0;">Hi ${esc(submitterName)}, your expense was not approved.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
          <tr><td style="padding:6px 0;color:#666;width:120px;">Description</td><td><strong>${esc(description)}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#666;">Amount</td><td><strong>${fmt(amount)}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#666;">Reviewed by</td><td>${esc(approverName)}</td></tr>
          ${rejectionNote ? `<tr><td style="padding:6px 0;color:#666;">Note</td><td>${esc(rejectionNote)}</td></tr>` : ""}
        </table>
        ${link ? `<a href="${link}" style="display:inline-block;background:#6b7280;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;">View Expense →</a>` : ""}
        <p style="margin-top:24px;font-size:12px;color:#999;">TIF Finance · Internal use only</p>
      </div>
    `,
  });
}

// ─── Expense paid → notify submitter ─────────────────────────────────────────

export async function sendExpensePaidEmail({
  submitterEmail,
  submitterName,
  description,
  amount,
  paymentReference,
  expenseId,
  locale,
}: {
  submitterEmail: string;
  submitterName: string;
  description: string;
  amount: number;
  paymentReference: string | null;
  expenseId: string | null;
  locale: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const link = expenseId ? `${appUrl}/${locale}/expenses/${expenseId}` : null;
  const fmt = (n: number) => `NT$${Math.round(n).toLocaleString()}`;

  await resend.emails.send({
    from: FROM,
    to: submitterEmail,
    subject: `[TIF Finance] Expense paid — ${fmt(amount)}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#222;">
        <h2 style="color:#7c3aed;margin-bottom:4px;">Expense Paid ✓</h2>
        <p style="color:#555;margin-top:0;">Hi ${esc(submitterName)}, your reimbursement has been processed.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
          <tr><td style="padding:6px 0;color:#666;width:120px;">Description</td><td><strong>${esc(description)}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#666;">Amount</td><td><strong>${fmt(amount)}</strong></td></tr>
          ${paymentReference ? `<tr><td style="padding:6px 0;color:#666;">Reference</td><td>${esc(paymentReference)}</td></tr>` : ""}
        </table>
        ${link ? `<a href="${link}" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;">View Expense →</a>` : ""}
        <p style="margin-top:24px;font-size:12px;color:#999;">TIF Finance · Internal use only</p>
      </div>
    `,
  });
}
