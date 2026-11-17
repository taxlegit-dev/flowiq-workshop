"use client";
import { useState } from "react";
import { OWNER, SOURCE, UC, compute, impactOf, inr } from "@/lib/engine";

// Side window, same layout as the FlowIQ Automation dashboard:
// Why → When you approve → Message (editable) → Checks and history → Approve and send / Not now.
export default function FindingPanel({ f, state, onClose, onApprove, demo, waOk, email }) {
  const [subject, setSubject] = useState(f.subject || f.label || f.action);
  const [body, setBody] = useState(f.body || "");
  const [mail, setMail] = useState(!demo && !!f.body);
  const [wa, setWa] = useState(false);
  const [open, setOpen] = useState(false);
  const done = !!state.approved[f.id];

  const b = compute(state).kpi, a = compute(state, f.id).kpi;
  const i = impactOf(f, state.inputs);
  const impact = [];
  if (i.cash) impact.push(`cash +${inr(i.cash)}`);
  if (a.dso < b.dso - 0.05) impact.push(`DSO ${b.dso.toFixed(1)} → ${a.dso.toFixed(1)} days`);
  if (a.overdue < b.overdue) impact.push(`overdue −${inr(b.overdue - a.overdue)}`);
  if (i.saved) impact.push(`${inr(i.saved)} saved`);
  if (i.protect) impact.push(`${inr(i.protect)} risk stopped`);

  const internal = /internal/i.test(f.label);
  const docs = Object.keys(f.evidence?.found || {});
  const checks = (f.checks || []).filter((c) => c.source !== "Missing");

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="fdrawer" role="dialog" aria-label={`${f.party} – review and approve`}>
        <div className="fd-body">
          <div className="fd-head">
            <div>
              <div className="fd-eyebrow">{UC[f.uc].short} · {done ? "Approved" : "Ready for you"}</div>
              <h2>{f.party}</h2>
              <div className="fd-amt num">{inr(f.amount, true)}</div>
            </div>
            <button className="btn ghost sm" onClick={onClose}>Close</button>
          </div>

          <h4>Why</h4>
          <p>{f.title}</p>
          <p className="muted">{f.root ? `${f.root}. ` : ""}{docs.length ? `Documents found: ${docs.join(", ")}.` : ""}</p>
          {f.review && <p className="muted"><b className="ink">Reviewed by Claude:</b> kept - {f.review}</p>}

          <h4>When you approve</h4>
          <ul className="fd-list">
            <li><b>{f.label || f.action}</b>{" "}
              {internal ? <>is recorded for the {OWNER[f.owner] || "finance team"} (internal note).</>
                : <>by email to the {f.party} accounts team. In this sandbox it comes to you{email ? <> at <code>{email}</code></> : null} as a test copy.</>}
            </li>
            {f.after && <li>{f.after}.</li>}
            {f.closure && <li>It closes by itself when {f.closure.charAt(0).toLowerCase() + f.closure.slice(1)}.</li>}
            {impact.length > 0 && <li>On this dashboard: {impact.join(" · ")}.</li>}
          </ul>

          {(f.body || f.subject) && (
            <>
              <h4>Message</h4>
              <div className="fd-msg">
                <input className="fd-subj" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" disabled={done} />
                <textarea className="fd-text" value={body} onChange={(e) => setBody(e.target.value)} rows={14} aria-label="Message" disabled={done} />
              </div>
              <p className="muted small">You can edit the text. What you see is what is sent.</p>
            </>
          )}

          <button className="fd-toggle" onClick={() => setOpen(!open)}>{open ? "▾" : "▸"} Checks and history</button>
          {open && (
            <div className="fd-checks">
              {checks.map((c, k) => (
                <div key={k}><span className={`fd-src ${SOURCE[c.source]?.tone || "doc"}`}>{SOURCE[c.source]?.label || c.source}</span> <b>{c.check}:</b> {c.result}</div>
              ))}
              {f.why && <div className="muted">{f.why}{f.refs ? ` · vouchers ${f.refs}` : ""}</div>}
              {f.table?.rows?.length > 0 && (
                <div className="tw"><table className="dt">
                  <thead><tr>{f.table.columns.map((c, k) => <th key={k}>{c || " "}</th>)}</tr></thead>
                  <tbody>{f.table.rows.map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j} className={/^[-\d,.\s₹]+$/.test(c) && c.trim() ? "r num" : ""}>{c}</td>)}</tr>)}</tbody>
                </table></div>
              )}
              {docs.length > 0 && <div><span className="fd-ok">✔ {f.evidence.label || "Evidence attached"}</span></div>}
              {Object.entries(f.evidence?.found || {}).map(([g, files]) => (
                <div key={g}><span className="fd-real">✔ Real document</span> <b>{g}:</b> {files.join(", ")}</div>
              ))}
              {f.rule && <div className="rule">Rule {f.rule}</div>}
            </div>
          )}
        </div>

        <div className="fd-foot">
          {done ? <span className="muted">Approved ✓</span> : (
            <>
              <button className="btn" onClick={() => onApprove({ ...f, subject, body }, mail && !!body, wa && waOk)}>Approve and send</button>
              <button className="btn ghost" onClick={onClose}>Not now</button>
              <span className="fd-to">
                {(f.body || f.subject) && <label><input type="checkbox" checked={mail} disabled={demo} onChange={(e) => setMail(e.target.checked)} />Email me</label>}
                {waOk && <label><input type="checkbox" checked={wa} onChange={(e) => setWa(e.target.checked)} />WhatsApp me</label>}
              </span>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
