"use server";

import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = process.env.RESEND_FROM ?? "TIF Finance <onboarding@resend.dev>";
const TO     = "todd.blackhurst@gmail.com";

export async function submitFeedback(
  _prev: { error?: string; success?: boolean },
  formData: FormData
) {
  const type        = formData.get("type") as string;
  const description = (formData.get("description") as string)?.trim();
  const page        = (formData.get("page") as string)?.trim() || "Not specified";

  if (!description) return { error: "Please describe the issue." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const reporter = user?.email ?? "Unknown";

  const subject = type === "bug"
    ? `[TIF Finance] Bug report from ${reporter}`
    : `[TIF Finance] Feature request from ${reporter}`;

  await resend.emails.send({
    from: FROM,
    to:   TO,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#222;">
        <h2 style="color:#1b2327;margin-bottom:4px;">${type === "bug" ? "🐛 Bug Report" : "💡 Feature Request"}</h2>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
          <tr><td style="padding:6px 0;color:#666;width:100px;">From</td><td><strong>${reporter}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#666;">Page/Area</td><td>${page}</td></tr>
          <tr><td style="padding:6px 0;color:#666;">Description</td><td style="white-space:pre-wrap;">${description}</td></tr>
        </table>
        <p style="font-size:12px;color:#999;">TIF Finance · Internal feedback</p>
      </div>
    `,
  });

  return { success: true };
}
