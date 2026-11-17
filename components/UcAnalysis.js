"use client";
import { useState } from "react";
import { METHOD, UC, dropped, findingsOf, inr, playbooks } from "@/lib/engine";

// The analysis for one use case: how it was checked, what it found, and what the review set aside.
export default function UcAnalysis({ uc, state }) {
  const [showDropped, setShowDropped] = useState(false);
  const fs = findingsOf(state).filter((f) => f.uc === uc);
  const open = fs.filter((f) => !state.approved[f.id]);
  const total = fs.reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const bySev = ["critical", "high", "medium", "low"].map((s) => [s, fs.filter((f) => f.severity === s).length]).filter(([, n]) => n);
  const pb = playbooks[uc];
  const drop = dropped.filter((d) => d.uc === uc);

  // GST reconciliation: month-by-month view of what did not match GSTR-2B.
  let months = null;
  if (uc === "UC6") {
    const m = {};
    for (const f of fs) {
      const mm = (f.title.match(/(\d{4}-\d{2})\)/) || [])[1] || "Any month";
      const status = (f.title.split(": ")[1] || "").split(" - ₹")[0];
      const k = mm;
      m[k] = m[k] || { month: mm, items: 0, gst: 0, kinds: {} };
      m[k].items += 1; m[k].gst += Number(f.amount) || 0; m[k].kinds[status] = (m[k].kinds[status] || 0) + 1;
    }
    months = Object.values(m).sort((a, b) => (a.month === "Any month") - (b.month === "Any month") || a.month.localeCompare(b.month));
  }

  return (
    <div className="uca">
      <div className="uca-main">
        <h4>How this check works</h4>
        <p>{METHOD[uc]}</p>
        {pb?.steps?.length > 0 && (
          <ul className="pb">{pb.steps.map((s, k) => <li key={k}>{s}</li>)}</ul>
        )}
        {pb?.verify && <p className="muted"><b>Closed when:</b> {pb.verify}</p>}
      </div>
      <div className="uca-side">
        <div className="stat"><span>Found</span><b className="num">{fs.length}</b><em>{inr(total)}</em></div>
        <div className="stat"><span>Still open</span><b className="num">{open.length}</b><em>{inr(open.reduce((s, f) => s + (Number(f.amount) || 0), 0))}</em></div>
        <div className="sevs">{bySev.map(([s, n]) => <span key={s} className={`sevtag ${s}`}>{n} {s}</span>)}</div>
        {drop.length > 0 && <button className="link" onClick={() => setShowDropped(!showDropped)}>{drop.length} set aside by review {showDropped ? "▴" : "▾"}</button>}
      </div>
      {months && (
        <div className="uca-wide">
          <h4>GSTR-2B vs purchase register, by month</h4>
          <table className="dt">
            <thead><tr><th>Month</th><th>What didn't match</th><th className="r">Items</th><th className="r">GST at stake</th></tr></thead>
            <tbody>{months.map((r) => (
              <tr key={r.month}><td>{r.month}</td><td>{Object.entries(r.kinds).map(([k, n]) => `${k} (${n})`).join(" · ")}</td>
                <td className="r num">{r.items}</td><td className="r num">{inr(r.gst, true)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {showDropped && (
        <div className="uca-wide">
          <h4>Set aside by review (not actioned)</h4>
          <ul className="dropped">{drop.map((d, k) => <li key={k}><b>{d.title}</b><span className="muted">{d.reason}</span></li>)}</ul>
        </div>
      )}
    </div>
  );
}
