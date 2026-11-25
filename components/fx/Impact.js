"use client";
// Impact report: what the approved actions achieved, before vs after, the top actions and recoveries, and every action.
import { useMemo, useState } from "react";
import { AREAS, OWNER, UC, compute, impactOf, inr, seedMeta } from "@/lib/engine";
import { reportUrl } from "@/lib/companies";
import { Ic, Mono, areaLabel, areaOf, days, hueOfArea, tip } from "./ui";

const PERIODS = [["all", "Since you started"], ["today", "Today"], ["week", "Last 7 days"]];
const fromOf = (p) => { const d = new Date(); if (p === "today") { d.setHours(0, 0, 0, 0); return d; } if (p === "week") return new Date(Date.now() - 7 * 864e5); return null; };
const valOf = (f, inputs) => { const i = impactOf(f, inputs); return i.cash + i.saved + i.protect; };

export default function Impact({ state, now, base, proj, list, co, downloads, emails, onOpen }) {
  const [period, setPeriod] = useState("all");
  const [fa, setFa] = useState("");        // area filter
  const [fs, setFs] = useState("");        // status filter
  const [fmin, setFmin] = useState("");    // minimum amount
  const K = now.kpi, B = base.kpi, P = proj.kpi;
  const from = fromOf(period);
  const inP = (id) => !!state.approved[id] && (!from || new Date(state.approved[id]) >= from);
  const approvedP = Object.fromEntries(Object.entries(state.approved).filter(([id]) => inP(id)));
  const R = compute({ ...state, approved: approvedP });
  const achieved = R.tot.cash + R.tot.saved + R.tot.protect;
  const done = list.filter((f) => inP(f.id));
  const topActs = done.map((f) => ({ f, v: valOf(f, state.inputs) })).sort((a, b) => b.v - a.v).slice(0, 6);
  const rec = {}; for (const f of done) { const i = impactOf(f, state.inputs); if (i.collected) { rec[f.party] = rec[f.party] || { party: f.party, uc: f.uc, v: 0, n: 0 }; rec[f.party].v += i.collected; rec[f.party].n += 1; } }
  const recs = Object.values(rec).sort((a, b) => b.v - a.v).slice(0, 6);
  const impactFile = downloads.find((d) => d.period === "impact");

  const rows = [
    ["Cash & bank", B.cash, K.cash, P.cash, 1, "m"], ["Receivables", B.receivables, K.receivables, P.receivables, -1, "m"],
    ["Overdue from customers", B.overdue, K.overdue, P.overdue, -1, "m"], ["Overdue more than 60 days", B.over60, K.over60, P.over60, -1, "m"],
    ["Days sales outstanding", B.dso, K.dso, P.dso, -1, "d"], ["Still at stake", B.atStake, K.atStake, P.atStake, -1, "m"],
    ["Saved & risk stopped", B.value, K.value, P.value, 1, "m"], ["Actions approved", B.done, K.done, P.done, 1, "n"],
  ];
  const fmt = (v, k) => (k === "d" ? days(v) : k === "n" ? String(Math.round(v)) : inr(v));
  const byArea = (AREAS || []).map(([id, label, ucs]) => {
    const fsA = list.filter((f) => ucs.includes(f.uc)), dn = fsA.filter((f) => inP(f.id));
    return { id, label, n: fsA.length, found: fsA.reduce((t, f) => t + (Number(f.amount) || 0), 0), done: dn.length,
      open: fsA.filter((f) => !state.approved[f.id]).reduce((t, f) => t + (Number(f.amount) || 0), 0), ach: dn.reduce((t, f) => t + valOf(f, state.inputs), 0) };
  }).filter((a) => a.n);
  const amx = Math.max(1, ...byArea.map((a) => a.found));

  const all = useMemo(() => list.map((f) => ({ f, st: state.approved[f.id] ? "Approved" : "Open", v: valOf(f, state.inputs) })), [list, state]);
  const filt = all.filter((x) => (!fa || areaOf(x.f.uc) === fa) && (!fs || x.st === fs) && (!fmin || x.f.amount >= Number(fmin)))
    .sort((a, b) => (a.st === b.st ? b.f.amount - a.f.amount : a.st === "Approved" ? -1 : 1));
  function csv() {
    const q = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const head = ["Party", "Area", "Check", "Action", "Severity", "Amount (INR)", "Impact if approved (INR)", "Status", "Approved at"];
    const body = filt.map((x) => [x.f.party, areaLabel(areaOf(x.f.uc)), UC[x.f.uc]?.short, x.f.label || x.f.action, x.f.severity, Math.round(x.f.amount), Math.round(x.v), x.st, state.approved[x.f.id] || ""].map(q).join(","));
    const blob = new Blob(["﻿" + [head.map(q).join(","), ...body].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `${seedMeta.company.replace(/[^A-Za-z0-9]+/g, "_")}_actions_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const chg = (b, n, good, k) => {
    const d = n - b; if (Math.abs(d) < (k === "d" ? 0.05 : 0.5)) return <span className="fx-chg">no change</span>;
    return <span className={`fx-chg ${d * good > 0 ? "up" : "dn"}`}>{d > 0 ? "+" : "−"}{fmt(Math.abs(d), k)}</span>;
  };

  return (
    <div className="fx-imp">
      <div className="fx-imp-h">
        <div className="fx-seg">{PERIODS.map(([k, l]) => <button key={k} aria-pressed={period === k} onClick={() => setPeriod(k)}>{l}</button>)}</div>
        <span className="fx-qsum">{done.length} action{done.length === 1 ? "" : "s"} approved in this period</span>
        <span className="sp" />
        {impactFile && <a className="fx-btn pri sm" href={reportUrl(co, impactFile.filename)} download={impactFile.filename}><Ic n="download" s={15} />Download impact report</a>}
        <button className="fx-btn sm" onClick={csv}><Ic n="file" s={15} />Export actions (CSV)</button>
      </div>

      <div className="fx-ik">
        <div className="ach"><span className="l">Achieved</span><b className="num">{inr(achieved)}</b><span className="s">cash in, cost saved and risk stopped</span></div>
        <div><span className="l">Collected from customers</span><b className="num">{inr(R.tot.collected)}</b><span className="s">{recs.length ? `from ${Object.keys(rec).length} customer${Object.keys(rec).length === 1 ? "" : "s"}` : "no collection approved yet"}</span></div>
        <div><span className="l">Overdue receivables</span><b className="num">{inr(K.overdue)}</b>{chg(B.overdue, K.overdue, -1, "m")}</div>
        <div><span className="l">Days sales outstanding</span><b className="num">{days(K.dso)}</b>{chg(B.dso, K.dso, -1, "d")}</div>
        <div><span className="l">Still at stake</span><b className="num">{inr(K.atStake)}</b><span className="s">{K.total - K.done} open issue{K.total - K.done === 1 ? "" : "s"}</span></div>
      </div>

      <div className="fx-bento">
        <section className="fx-tile s6">
          <div className="th"><div><h3>Highest impact actions</h3><p>Approved actions, by what they achieved</p></div></div>
          {topActs.length ? <div className="fx-rank">{topActs.map(({ f, v }, k) => (
            <button key={f.id} onClick={() => onOpen(f)}><span className="i">{k + 1}</span><Mono name={f.party} uc={f.uc} /><span className="p"><b>{f.party}</b><small>{UC[f.uc]?.short} · {f.label || f.action}</small></span><em className="num">{inr(v)}</em></button>
          ))}</div> : <div className="fx-empty sm"><Ic n="bolt" s={20} /><b>No approvals in this period</b><span>Approve actions in the Action Hub and their impact shows here.</span></div>}
        </section>
        <section className="fx-tile s6">
          <div className="th"><div><h3>Highest recoveries from customers</h3><p>Overdue collected through approved reminders</p></div></div>
          {recs.length ? <div className="fx-rank">{recs.map((r, k) => (
            <div key={r.party} className="row"><span className="i">{k + 1}</span><Mono name={r.party} uc={r.uc} /><span className="p"><b>{r.party}</b><small>{r.n} action{r.n === 1 ? "" : "s"}</small></span><em className="num up">{inr(r.v)}</em></div>
          ))}</div> : <div className="fx-empty sm"><Ic n="wallet" s={20} /><b>No customer payments in this period</b><span>Approve a collection reminder to see the recovery here.</span></div>}
        </section>

        <section className="fx-tile s12">
          <div className="th"><div><h3>Before and after</h3><p>Position when you started, now, and if every open action were approved</p></div></div>
          <div className="fx-tw"><table className="fx-t">
            <thead><tr><th>Measure</th><th className="r">Before</th><th className="r">Now</th><th className="r">Change</th><th className="r">If all approved</th></tr></thead>
            <tbody>{rows.map(([l, b, n, p, g, k]) => (
              <tr key={l}><td><b>{l}</b></td><td className="r num mut">{fmt(b, k)}</td><td className="r num"><b>{fmt(n, k)}</b></td><td className="r num">{chg(b, n, g, k)}</td><td className="r num mut">{fmt(p, k)}</td></tr>
            ))}</tbody>
          </table></div>
        </section>

        <section className="fx-tile s12">
          <div className="th"><div><h3>By area</h3><p>What was found, approved and achieved in each business area</p></div></div>
          <div className="fx-tw"><table className="fx-t">
            <thead><tr><th>Area</th><th className="r">Issues</th><th>Found vs still open</th><th className="r">Found</th><th className="r">Approved</th><th className="r">Achieved</th></tr></thead>
            <tbody>{byArea.map((a) => (
              <tr key={a.id}><td><span className="fx-ck"><span className="sw" style={{ background: hueOfArea(a.id) }} />{a.label}</span></td><td className="r num">{a.n}</td>
                <td style={{ minWidth: 180 }} data-tip={tip(a.label, [["Found", inr(a.found, true)], ["Still open", inr(a.open, true), hueOfArea(a.id)]])}><span className="fx-dbar"><u style={{ width: `${(a.found / amx) * 100}%`, background: hueOfArea(a.id) }} /><i style={{ width: `${(a.open / amx) * 100}%`, background: hueOfArea(a.id) }} /></span></td>
                <td className="r num">{inr(a.found)}</td><td className="r num">{a.done}</td><td className="r num"><b>{inr(a.ach)}</b></td></tr>
            ))}</tbody>
          </table></div>
          <p className="fx-hint">{emails ? `${emails} test email${emails === 1 ? "" : "s"} sent to you. ` : ""}Achieved counts cash collected, costs saved and risk stopped by the actions you approved.</p>
        </section>

        <details className="fx-tile s12 fx-every">
          <summary><span><b>Every action, with filters and download</b><small>{all.length} actions · {all.filter((x) => x.st === "Approved").length} approved</small></span></summary>
          <div className="fx-filt">
            <label>Area<select value={fa} onChange={(e) => setFa(e.target.value)}><option value="">All areas</option>{(AREAS || []).filter(([id]) => byArea.some((a) => a.id === id)).map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select></label>
            <label>Status<select value={fs} onChange={(e) => setFs(e.target.value)}><option value="">All</option><option>Open</option><option>Approved</option></select></label>
            <label>Minimum amount (₹)<input inputMode="numeric" value={fmin} onChange={(e) => setFmin(e.target.value.replace(/\D/g, ""))} placeholder="0" /></label>
            <span className="sp" /><span className="fx-qsum"><b>{filt.length}</b> shown · <b>{inr(filt.reduce((t, x) => t + x.f.amount, 0))}</b></span>
            <button className="fx-btn sm" onClick={csv}><Ic n="download" s={15} />Download these (CSV)</button>
          </div>
          <div className="fx-tw"><table className="fx-t">
            <thead><tr><th>Party</th><th>Check</th><th>Action</th><th className="r">Amount</th><th className="r">Impact</th><th>Status</th></tr></thead>
            <tbody>{filt.slice(0, 300).map(({ f, st, v }) => (
              <tr key={f.id} className="click" onClick={() => onOpen(f)}><td><b>{f.party}</b></td><td className="mut">{UC[f.uc]?.short}</td><td>{f.label || f.action}</td>
                <td className="r num">{inr(f.amount, true)}</td><td className="r num">{inr(v)}</td><td><span className={`fx-sev ${st === "Approved" ? "clear" : f.severity}`}>{st === "Approved" ? "Approved" : f.severity}</span></td></tr>
            ))}</tbody>
          </table></div>
        </details>
      </div>
    </div>
  );
}
