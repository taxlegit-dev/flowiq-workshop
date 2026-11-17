// Email through the Brevo transactional API (server only). The key lives in a Vercel env var.
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function shell(title, inner) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#1C2421">
<div style="background:#0E6B66;color:#fff;padding:14px 18px;border-radius:8px 8px 0 0;font-weight:bold;font-size:16px">FlowIQ Automation</div>
<div style="border:1px solid #D9DDD6;border-top:0;padding:18px;border-radius:0 0 8px 8px">
<h2 style="margin:0 0 12px;font-size:18px">${esc(title)}</h2>${inner}
<p style="color:#8A948E;font-size:12px;margin-top:20px">Sent from the FlowIQ workshop sandbox. All parties and amounts are sample data.</p></div></div>`;
}

export async function send({ to, name, subject, html }) {
  const key = process.env.BREVO_API_KEY;
  const from = process.env.BREVO_SENDER_EMAIL;
  if (!key || !from) throw new Error("Email is not configured (see README, step 2).");
  const body = {
    sender: { email: from, name: process.env.BREVO_SENDER_NAME || "FlowIQ Automation" },
    to: [{ email: to, name: name || undefined }],
    subject,
    htmlContent: `<html><body>${html}</body></html>`,
  };
  if (process.env.BREVO_REPLY_TO) body.replyTo = { email: process.env.BREVO_REPLY_TO };
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    console.error("Brevo", r.status, t.slice(0, 300));
    throw new Error("The email could not be sent. Please try again in a minute.");
  }
  return r.json();
}
