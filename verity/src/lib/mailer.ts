type MailInput = { to: string | string[]; subject: string; html?: string; text?: string; from?: string };

async function sendWithResend({ to, subject, html, text, from }: MailInput) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set");
  const sender = from || process.env.INTEGRITY_REFERRAL_SENDER || "no-reply@verity.run";
  const body = {
    from: sender,
    to: Array.isArray(to) ? to : [to],
    subject,
    ...(html ? { html } : {}),
    ...(text ? { text } : {}),
  };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => String(res.status));
    throw new Error(`Resend error: ${res.status} ${msg}`);
  }
  return res.json().catch(() => ({}));
}

/** Public API used by routes: import { sendMail } from "@/lib/mailer" */
export async function sendMail(input: MailInput) {
  try {
    if (process.env.RESEND_API_KEY) return await sendWithResend(input);
    // Fallback: no-op log so dev build doesn’t crash when key is missing.
    if (process.env.NODE_ENV !== "production") {
      console.log("[mailer] (dev noop)", { to: input.to, subject: input.subject });
    }
    return { ok: true, noop: true };
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.error("[mailer] failed", e);
    throw e;
  }
}
