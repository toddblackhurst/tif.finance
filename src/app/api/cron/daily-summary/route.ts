import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM ?? "TIF Finance <onboarding@resend.dev>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://tif-finance.vercel.app";

function esc(s: string | null | undefined) {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function fmt(n: number) {
  return `NT$${Math.round(n).toLocaleString()}`;
}

export async function GET(req: NextRequest) {
  // Verify this is called by Vercel Cron (or manually with the secret)
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Yesterday's date range in UTC (Taiwan is UTC+8, so midnight UTC = 8am Taiwan)
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const yesterdayUtc = new Date(todayUtc.getTime() - 86400 * 1000);

  const rangeStart = yesterdayUtc.toISOString(); // e.g. 2026-04-27T00:00:00.000Z
  const rangeEnd   = todayUtc.toISOString();     // e.g. 2026-04-28T00:00:00.000Z

  // Display date for the email subject (Taiwan date = UTC date since we run at midnight UTC)
  const displayDate = yesterdayUtc.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    timeZone: "Asia/Taipei",
  });

  const db = createAdminClient();

  // ── Fetch yesterday's donations ───────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: donations } = await (db as any)
    .from("donations")
    .select("id, amount, gift_date, campuses(name), funds(name), donor:donors(display_name)")
    .gte("created_at", rangeStart)
    .lt("created_at", rangeEnd)
    .is("deleted_at", null)
    .order("created_at", { ascending: false }) as {
      data: {
        id: string; amount: number; gift_date: string;
        campuses: { name: string } | null;
        funds: { name: string } | null;
        donor: { display_name: string } | null;
      }[] | null
    };

  // ── Fetch yesterday's expenses ────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: expenses } = await (db as any)
    .from("expenses")
    .select("id, amount, description, status, campuses(name), submitter:user_profiles!expenses_submitter_id_fkey(full_name)")
    .gte("created_at", rangeStart)
    .lt("created_at", rangeEnd)
    .is("deleted_at", null)
    .order("created_at", { ascending: false }) as {
      data: {
        id: string; amount: number; description: string; status: string;
        campuses: { name: string } | null;
        submitter: { full_name: string | null } | null;
      }[] | null
    };

  // ── Fetch currently pending expenses (all time, not just yesterday) ───────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pendingExpenses } = await (db as any)
    .from("expenses")
    .select("id, amount, description, campuses(name)")
    .eq("status", "submitted")
    .is("deleted_at", null)
    .order("created_at", { ascending: true }) as {
      data: {
        id: string; amount: number; description: string;
        campuses: { name: string } | null;
      }[] | null
    };

  // ── Get all admin emails ──────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: admins } = await (db as any)
    .from("user_profiles")
    .select("email")
    .eq("role", "admin")
    .not("email", "is", null) as { data: { email: string }[] | null };

  const adminEmails = (admins ?? []).map((a) => a.email).filter(Boolean);
  if (!adminEmails.length) {
    return NextResponse.json({ skipped: "No admin emails found" });
  }

  const donationList  = donations  ?? [];
  const expenseList   = expenses   ?? [];
  const pendingList   = pendingExpenses ?? [];

  const totalDonations = donationList.reduce((s, d) => s + d.amount, 0);
  const totalExpenses  = expenseList.reduce((s, e) => s + e.amount, 0);
  const totalPending   = pendingList.reduce((s, e) => s + e.amount, 0);

  // ── Build email HTML ──────────────────────────────────────────────────────
  const hasActivity = donationList.length > 0 || expenseList.length > 0;

  const donationRows = donationList.map((d) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;">${esc(d.donor?.display_name ?? "Anonymous")}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;">${esc(d.campuses?.name ?? "—")}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;">${esc(d.funds?.name ?? "—")}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;color:#15803d;">${fmt(d.amount)}</td>
    </tr>
  `).join("");

  const expenseRows = expenseList.map((e) => {
    const statusColor = e.status === "submitted" ? "#b45309" : e.status === "approved" ? "#15803d" : "#6b7280";
    const statusLabel = e.status.charAt(0).toUpperCase() + e.status.slice(1);
    return `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;">${esc(e.submitter?.full_name ?? "—")}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;">${esc(e.description)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;">${esc(e.campuses?.name ?? "—")}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;"><span style="color:${statusColor};font-weight:600;">${statusLabel}</span></td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;color:#b91c1c;">${fmt(e.amount)}</td>
      </tr>
    `;
  }).join("");

  const pendingRows = pendingList.slice(0, 10).map((e) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;">${esc(e.description)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;">${esc(e.campuses?.name ?? "—")}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;">${fmt(e.amount)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;">
        <a href="${APP_URL}/en/expenses/${e.id}" style="color:#1d4ed8;font-size:12px;">Review →</a>
      </td>
    </tr>
  `).join("");

  const noActivityNote = !hasActivity ? `
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;text-align:center;color:#6b7280;margin:24px 0;">
      No donations or expenses were recorded yesterday.
    </div>
  ` : "";

  const html = `
    <div style="font-family:sans-serif;max-width:640px;margin:0 auto;color:#222;">
      <div style="background:#1d4ed8;padding:24px 32px;border-radius:8px 8px 0 0;">
        <h1 style="color:#fff;margin:0;font-size:20px;">TIF Finance — Daily Summary</h1>
        <p style="color:#bfdbfe;margin:4px 0 0;">${esc(displayDate)}</p>
      </div>

      <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px 32px;border-radius:0 0 8px 8px;">

        <!-- KPI strip -->
        <div style="display:flex;gap:16px;margin-bottom:24px;">
          <div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#15803d;">${fmt(totalDonations)}</div>
            <div style="font-size:12px;color:#166534;">${donationList.length} donation${donationList.length !== 1 ? "s" : ""} yesterday</div>
          </div>
          <div style="flex:1;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#b91c1c;">${fmt(totalExpenses)}</div>
            <div style="font-size:12px;color:#991b1b;">${expenseList.length} expense${expenseList.length !== 1 ? "s" : ""} yesterday</div>
          </div>
          <div style="flex:1;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#b45309;">${fmt(totalPending)}</div>
            <div style="font-size:12px;color:#92400e;">${pendingList.length} awaiting approval</div>
          </div>
        </div>

        ${noActivityNote}

        <!-- Donations -->
        ${donationList.length > 0 ? `
        <h2 style="font-size:16px;border-bottom:2px solid #15803d;padding-bottom:6px;color:#15803d;">
          Donations (${donationList.length})
        </h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;">
          <thead>
            <tr style="background:#f0fdf4;">
              <th style="padding:8px;text-align:left;font-weight:600;color:#166534;">Donor</th>
              <th style="padding:8px;text-align:left;font-weight:600;color:#166534;">Campus</th>
              <th style="padding:8px;text-align:left;font-weight:600;color:#166534;">Fund</th>
              <th style="padding:8px;text-align:right;font-weight:600;color:#166534;">Amount</th>
            </tr>
          </thead>
          <tbody>${donationRows}</tbody>
          <tfoot>
            <tr style="background:#f0fdf4;">
              <td colspan="3" style="padding:8px;font-weight:700;">Total</td>
              <td style="padding:8px;text-align:right;font-weight:700;color:#15803d;">${fmt(totalDonations)}</td>
            </tr>
          </tfoot>
        </table>
        ` : ""}

        <!-- Expenses entered yesterday -->
        ${expenseList.length > 0 ? `
        <h2 style="font-size:16px;border-bottom:2px solid #b91c1c;padding-bottom:6px;color:#b91c1c;">
          Expenses Entered (${expenseList.length})
        </h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;">
          <thead>
            <tr style="background:#fef2f2;">
              <th style="padding:8px;text-align:left;font-weight:600;color:#991b1b;">Submitted by</th>
              <th style="padding:8px;text-align:left;font-weight:600;color:#991b1b;">Description</th>
              <th style="padding:8px;text-align:left;font-weight:600;color:#991b1b;">Campus</th>
              <th style="padding:8px;text-align:left;font-weight:600;color:#991b1b;">Status</th>
              <th style="padding:8px;text-align:right;font-weight:600;color:#991b1b;">Amount</th>
            </tr>
          </thead>
          <tbody>${expenseRows}</tbody>
          <tfoot>
            <tr style="background:#fef2f2;">
              <td colspan="4" style="padding:8px;font-weight:700;">Total</td>
              <td style="padding:8px;text-align:right;font-weight:700;color:#b91c1c;">${fmt(totalExpenses)}</td>
            </tr>
          </tfoot>
        </table>
        ` : ""}

        <!-- Pending approvals -->
        ${pendingList.length > 0 ? `
        <h2 style="font-size:16px;border-bottom:2px solid #b45309;padding-bottom:6px;color:#b45309;">
          Pending Approval (${pendingList.length}${pendingList.length > 10 ? ", showing 10" : ""})
        </h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;">
          <thead>
            <tr style="background:#fffbeb;">
              <th style="padding:8px;text-align:left;font-weight:600;color:#92400e;">Description</th>
              <th style="padding:8px;text-align:left;font-weight:600;color:#92400e;">Campus</th>
              <th style="padding:8px;text-align:right;font-weight:600;color:#92400e;">Amount</th>
              <th style="padding:8px;"></th>
            </tr>
          </thead>
          <tbody>${pendingRows}</tbody>
          <tfoot>
            <tr style="background:#fffbeb;">
              <td colspan="2" style="padding:8px;font-weight:700;">Total outstanding</td>
              <td style="padding:8px;text-align:right;font-weight:700;color:#b45309;">${fmt(totalPending)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        ` : `
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px 16px;font-size:13px;color:#166534;margin-bottom:24px;">
          ✓ No expenses pending approval
        </div>
        `}

        <div style="text-align:center;margin-top:8px;">
          <a href="${APP_URL}/en/dashboard"
             style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;">
            Open Dashboard →
          </a>
        </div>

        <p style="margin-top:24px;font-size:11px;color:#9ca3af;text-align:center;">
          Taichung International Fellowship · Finance System · Daily digest sent at 8am Taiwan time
        </p>
      </div>
    </div>
  `;

  await resend.emails.send({
    from: FROM,
    to: adminEmails,
    subject: `[TIF Finance] Daily Summary — ${displayDate}`,
    html,
  });

  return NextResponse.json({
    ok: true,
    date: displayDate,
    donations: donationList.length,
    expenses: expenseList.length,
    pendingApprovals: pendingList.length,
    sentTo: adminEmails,
  });
}
