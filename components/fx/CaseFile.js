"use client";
// The case file for one finding: why it was raised, what approving does (and does to the numbers), the message, the checks.
import { useEffect, useState } from "react";
import { OWNER, SOURCE, UC, compute, impactOf, inr, LB } from "@/lib/engine";
import { Ic, Mono, areaLabel, areaOf, days } from "./ui";

export default function CaseFile({ f, state, onClose, onApprove, onUndo, demo, waOk, email }) {
  const [subject, setSubject] = useState(f.subject || f.label || f.action);
  const [body, setBody] = useState(f.body || "");
  const [mail, setMail] = useState(!demo && !!f.body);
  const [wa, setWa] = useState(false);
  const done = !!state.approved[f.id];
  useEffect(() => { const k = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);

  const b = compute(state).kpi;
  const a = done ? compute({ ...state, approved: Object.fromEntries(Object.entries(state.approved).filter(([k]) => k !== f.id)) }).kpi : compute(state, f.id).kpi;
  const before = done ? a : b, after = done ? b : a;
  const i = impactOf(f, state.inputs);
  const eff = [];
  if (Math.abs(after.cash - before.cash) > 0.5) eff.push(["Cash & bank", inr(before.cash), inr(after.cash), "up"]);
  if (Math.abs(after.dso - before.dso) > 0.05) eff.push(["DSO", days(before.dso), days(after.dso), "up"]);
  if (Math.abs(after.overdue - before.overdue) > 0.5) eff.push([LB("overdue", "Overdue from customers"), inr(before.overdue), inr(after.overdue), "up"]);
  if (i.saved || i.protect) eff.push(["Saved & risk stopped", inr(before.value), inr(after.value), "up"]);
  eff.push(["Still at stake", inr(before.atStake), inr(after.atStake), "up"]);

  const internal = /internal/i.test(f.label || "");
  const docs = Object.keys(f.evidence?.found || {});
  const checks = (f.checks || []).filter((c) => c.source !== "Missing");
  const refs = String(f.refs || "").split(",").map((x) => x.trim()).filter(Boolean);
  const facts = [["Severity", f.severity], ["Check", UC[f.uc]?.short], ["Owner", OWNER[f.owner] || "Finance"], refs.length ? ["Vouchers", refs.length] : null, f.sla ? ["Act within", `${f.sla} days`] : null, f.days ? ["Days", f.days] : null].filter(Boolean);
  const step = done ? 3 : 1;
  const what = f.title.startsWith(f.party + ":") ? f.title.slice(f.party.length + 1).trim() : f.title;

  return (
    <>
      <div className="fx-scrim" onClick={onClose} />
      <aside className="fx-drawer" role="dialog" aria-label={`${f.party} – review and approve`}>
        <div className="fx-cf-top">
          <div className="fx-cf-band">
            <Mono name={f.party} uc={f.uc} sev={f.severity} size="lg" />
            <div><span className="area">{areaLabel(areaOf(f.uc))} · {UC[f.uc]?.short} · {done ? "Approved" : "Ready for you"}</span><h2>{f.party}</h2></div>
            <div className="fx-cf-amt"><b className="num">{inr(f.amount, true)}</b><span>at stake</span></div>
          </div>
          <button className="fx-x" onClick={onClose} aria-label="Close"><Ic n="x" s={16} /></button>
          <div className="fx-step">{["Found", "Your decision", "Message sent", "Numbers updated"].map((l, k) => <div key={l} className={k < step ? "on" : k === step ? "cur" : ""}>{l}</div>)}</div>
        </div>

        <div className="fx-cf-body">
          <section className="fx-sec"><h3>Why this was raised</h3>
            <div className="fx-why"><div className="ttl">{what}</div>
              {(f.root || docs.length > 0) && <p>{f.root ? `${f.root}. ` : ""}{docs.length ? `Documents found: ${docs.join(", ")}.` : ""}</p>}
              <div className="fx-facts">{facts.map(([k, v]) => <span key={k}>{k} <b>{String(v)}</b></span>)}</div>
              {f.review && <p className="rev"><b>Reviewed by Claude:</b> kept - {f.review}</p>}
            </div>
          </section>

          <section className="fx-sec"><h3>{done ? "What approving did to the numbers" : "What approving does to the numbers"}</h3>
            <div className="fx-eff">{eff.map(([l, x, y]) => (
              <div key={l}><span>{l}</span><s className="num">{x}</s><b className="num">{y}</b></div>
            ))}</div>
          </section>

          <section className="fx-sec"><h3>{done ? "What was done" : "When you approve"}</h3>
            <div className="fx-plan">
              <div><span>Action</span><b>{f.label || f.action}</b></div>
              <div><span>Goes to</span>{internal ? <>The {OWNER[f.owner] || "finance team"} (internal note)</> : <>The {f.party} accounts team, by email. Here it comes to you{email ? <> at <code>{email}</code></> : null} as a test copy.</>}</div>
              {f.after && <div><span>Then</span>{f.after}</div>}
              {f.closure && <div><span>Closes by itself when</span>{f.closure}</div>}
            </div>
          </section>

          {(f.body || f.subject) && (
            <section className="fx-sec"><h3>Message</h3>
              <div className="fx-mail">
                <input value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" disabled={done} />
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={13} aria-label="Message" disabled={done} />
              </div>
              {!done && <p className="fx-hint">You can edit the text. What you see is what is sent.</p>}
            </section>
          )}

          <details className="fx-more">
            <summary>Checks, evidence and vouchers</summary>
            <div className="fx-checks">
              {checks.map((c, k) => (
                <div key={k}><span className={`fx-src ${SOURCE[c.source]?.tone || "doc"}`}>{SOURCE[c.source]?.label || c.source}</span><b>{c.check}:</b> {c.result}</div>
              ))}
              {f.why && <p className="fx-hint">{f.why}{f.refs ? ` · vouchers ${f.refs}` : ""}</p>}
              {f.table?.rows?.length > 0 && (
                <div className="fx-tw"><table className="fx-t">
                  <thead><tr>{f.table.columns.map((c, k) => <th key={k}>{c || " "}</th>)}</tr></thead>
                  <tbody>{f.table.rows.map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j} className={/^[-\d,.\s₹]+$/.test(c) && String(c).trim() ? "r num" : ""}>{c}</td>)}</tr>)}</tbody>
                </table></div>
              )}
              {Object.entries(f.evidence?.found || {}).map(([g, files]) => (
                <div key={g}><span className="fx-src doc">Document</span><b>{g}:</b> {files.join(", ")}</div>
              ))}
              {f.rule && <p className="fx-hint">Rule {f.rule}</p>}
            </div>
          </details>
        </div>

        <div className="fx-dact">
          {done ? (
            <><span className="fx-ok big"><Ic n="checkc" s={18} />Approved</span><button className="fx-btn ghost" onClick={() => onUndo(f)}><Ic n="undo" s={15} />Undo</button><button className="fx-btn ghost" onClick={onClose}>Close</button></>
          ) : (
            <>
              <button className="fx-btn pri" onClick={() => onApprove({ ...f, subject, body }, mail && !!body, wa && waOk)}>Approve and send</button>
              <button className="fx-btn ghost" onClick={onClose}>Not now</button>
              <span className="fx-to">
                {(f.body || f.subject) && <label className={demo ? "off" : ""}><input type="checkbox" checked={mail} disabled={demo} onChange={(e) => setMail(e.target.checked)} /><Ic n="mail" s={14} />Email me</label>}
                {waOk && <label><input type="checkbox" checked={wa} onChange={(e) => setWa(e.target.checked)} /><Ic n="chat" s={14} />WhatsApp me</label>}
              </span>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
