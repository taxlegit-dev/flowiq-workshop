import { verify } from "@/lib/session";
import { esc, send, shell } from "@/lib/brevo";

export const runtime = "nodejs";

const td = 'style="padding:6px 8px;border-bottom:1px solid #E6E9E4;font-size:13px"';
const tdr = 'style="padding:6px 8px;border-bottom:1px solid #E6E9E4;font-size:13px;text-align:right"';
const table = (head, rows) => `<table style="border-collapse:collapse;width:100%;margin:8px 0 16px">
<tr>${head.map((h, i) => `<th ${i ? tdr : td}>${esc(h)}</th>`).join("")}</tr>
${rows.map((r) => `<tr>${r.map((c, i) => `<td ${i ? tdr : td}>${esc(c)}</td>`).join("")}</tr>`).join("")}</table>`;

// Body: { token, kind: "mis" | "test", ... }. The recipient is always the signed-in user's own address.
export async function POST(req) {
  try {
    const b = await req.json();
    const u = verify(b.token);
    if (!u?.email) return Response.json({ error: "Session expired. Please register again." }, { status: 401 });

    let subject, html;
    if (b.kind === "mis") {
      const r = b.report || {};
      const kpis = (r.kpis || []).slice(0, 10).map((k) => [k.label, k.start, k.now]);
      const areas = (r.areas || []).slice(0, 8).map((a) => [a.name, a.open, a.resolved, a.items]);
      const acts = (r.approvals || []).slice(0, 70).map((a) => [a.party, a.action, a.impact]);
      subject = `MIS summary · ${String(r.company || "FlowIQ").slice(0, 60)} · ${String(r.asOf || "").slice(0, 20)}`;
      html = shell("MIS summary", `<p style="font-size:14px">Hi ${esc(u.name)},</p>
<p style="font-size:14px">${esc(String(r.headline || "").slice(0, 300))}</p>
<h3 style="font-size:15px;margin:16px 0 4px">Key numbers</h3>${table(["", "Start", "Now"], kpis)}
<h3 style="font-size:15px;margin:16px 0 4px">By area</h3>${table(["Area", "Open", "Resolved", "Items"], areas)}
${acts.length ? `<h3 style="font-size:15px;margin:16px 0 4px">Actions approved</h3>${table(["Party", "Action", "Impact"], acts)}` : ""}`);
    } else if (b.kind === "test") {
      const m = b.message || {};
      subject = "[FlowIQ test] " + String(m.subject || "Action message").slice(0, 120);
      html = shell(String(m.subject || "Action message").slice(0, 120),
        `<div style="background:#FBF3DA;color:#7a5a00;padding:8px 12px;border-radius:6px;font-size:13px;margin-bottom:14px">Test copy. In live use this goes to <b>${esc(String(m.party || "the party").slice(0, 80))}</b>.</div>
<pre style="font-family:Consolas,Menlo,monospace;font-size:12.5px;line-height:1.5;white-space:pre-wrap">${esc(String(m.body || "").slice(0, 4000))}</pre>`);
    } else {
      return Response.json({ error: "Unknown email type." }, { status: 400 });
    }

    await send({ to: u.email, name: u.name, subject, html });
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
