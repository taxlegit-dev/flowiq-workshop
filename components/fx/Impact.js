"use client";
// Business Impact: the value the approved actions delivered, by outcome (cash released, cost saved, margin protected,
// risk prevented), before and after, by use case and area, and every item behind the figures with its evidence.
import { useMemo, useState } from "react";
import { AREAS, UC, impactOf, inr, seedMeta, LB } from "@/lib/engine";
import { reportUrl } from "@/lib/companies";
import { BIZ, BIZ_PERIODS, FIN, OUTCOMES, OUTCOME_KEYS, d1, p1 } from "@/lib/cfo";
import { ExportBtn } from "./Board";
import { Bar, StepLine, rs } from "./CfoCharts";
import { Big, Ic, Mono, areaLabel, areaOf, hueOfArea, tip } from "./ui";

const valOf = (f, inputs) => { const i = impactOf(f, inputs); return i.cash + i.saved + i.protect; };
const ST = { Open: ["Not yet approved", "info"], Approved: ["Approved", "closed"] };

export default function Impact({ state, now, base, proj, list, co, downloads, emails, onOpen, say, metric0 }) {
  const [period, setPeriod] = useState("all");
  const [fm, setFm] = useState(metric0 || "");   // outcome filter
  const [fu, setFu] = useState("");              // use case filter
  const [fa, setFa] = useState("");              // area filter
  const [fs, setFs] = useState("");              // status filter
  const [fmin, setFmin] = useState("");          // minimum amount
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("ach");
  const [showAll, setShowAll] = useState(false);
  const B = useMemo(() => BIZ(state, list, period), [state, list, period]);
  const T = B.tot, company = seedMeta.company;
  const args = () => ({ F: FIN(co, state, now, base), Bz: B, company, co });
  const impactFile = downloads.find((d) => d.period === "impact");
  const done = list.filter((f) => !!state.approved[f.id] && (!B.from || new Date(state.approved[f.id]) >= B.from));
  const topActs = done.map((f) => ({ f, v: valOf(f, state.inputs) })).sort((a, b) => b.v - a.v).slice(0, 6);
  const rec = {}; for (const f of done) { const i = impactOf(f, state.inputs); if (i.collected) { rec[f.party] = rec[f.party] || { party: f.party, uc: f.uc, v: 0, n: 0 }; rec[f.party].v += i.collected; rec[f.party].n += 1; } }
  const recs = Object.values(rec).sort((a, b) => b.v - a.v).slice(0, 6);
  const mxF = Math.max(T.stake, 1);
  const byArea = (AREAS || []).map(([id, label, ucs]) => {
    const rs2 = B.rows.filter((r) => ucs.includes(r.uc));
    return { id, label, n: rs2.length, found: rs2.reduce((t, r) => t + r.stake, 0), done: rs2.filter((r) => r.achP || (period === "all" && r.ach)).length,
      open: rs2.filter((r) => r.stage === "Open").reduce((t, r) => t + r.stake, 0), ach: rs2.reduce((t, r) => t + r.achP, 0) };
  }).filter((a) => a.n);
  const amx = Math.max(1, ...byArea.map((a) => a.found));

  const match = (r) => (!fm || r.metric === fm) && (!fu || r.uc === fu) && (!fa || areaOf(r.uc) === fa) && (!fs || r.stage === fs) && (!fmin || r.stake >= Number(fmin))
    && (!q || `${r.party} ${r.title} ${r.refs} ${r.ucn}`.toLowerCase().includes(q.toLowerCase()));
  const sk = { ach: (r) => -(r.achP || 0) * 1e3 - r.stake / 1e9, stake: (r) => -r.stake, pot: (r) => -r.exp, open: (r) => (r.stage === "Open" ? 0 : 1) - r.stake / 1e12 }[sort];
  const L = B.rows.filter(match).sort((a, b) => sk(a) - sk(b)), shown = L.slice(0, showAll ? 500 : 40);
  const flt = [fm && OUTCOMES[fm][0], fu && (UC[fu]?.name || fu), fa && areaLabel(fa), fs && ST[fs][0], fmin && `≥ ${inr(Number(fmin))}`, q && `“${q}”`].filter(Boolean);
  const clear = () => { setFm(""); setFu(""); setFa(""); setFs(""); setFmin(""); setQ(""); };
  const toLedger = () => setTimeout(() => document.getElementById("cfLedger")?.scrollIntoView({ block: "start", behavior: "smooth" }), 30);

  function csv() {
    const qq = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const head = ["Party", "Area", "Check", "Outcome", "Action", "Severity", "Amount (INR)", "Impact if approved (INR)", "Status", "Approved at", "Voucher references"];
    const body = L.map((r) => [r.party, areaLabel(areaOf(r.uc)), UC[r.uc]?.short, OUTCOMES[r.metric][0], r.f.label || r.f.action, r.severity, Math.round(r.stake), Math.round(r.exp), r.stage, r.at, r.refs].map(qq).join(","));
    const blob = new Blob(["﻿" + [head.map(qq).join(","), ...body].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `${company.replace(/[^A-Za-z0-9]+/g, "_")}_actions_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const fmt = (v, k) => (k === "m" ? inr(v) : k === "d" ? d1(v) : String(Math.round(v || 0)));
  const trend = B.trend.map((t) => ({ v: t.v, add: t.add, party: t.party, when: t.at.replace("T", " ").slice(0, 16), tick: t.at.slice(11, 16) }));
  if (trend.length && new Set(B.trend.map((t) => t.at.slice(0, 10))).size > 1) trend.forEach((t, i) => (t.tick = B.trend[i].at.slice(5, 10)));

  return (
    <div className="fx-imp cf">
      <section className="fx-hero cf-hero" aria-label="Value delivered">
        <div className="cf-hl">
          <div className="fx-hx-k"><span className="fx-live"><i />Updated by your approvals</span><span>{B.label}</span></div>
          <div className="fx-big" role="group"><span className="v num"><Big v={T.ach} /></span>
            <span className="t">{period === "all" ? "value delivered by the actions you approved" : "delivered in this period"} · <b>{T.closed}</b> of {T.n} issues approved</span></div>
          <div className="cf-per">{BIZ_PERIODS.map(([k, l]) => <button key={k} className="cf-chip" aria-pressed={period === k} onClick={() => setPeriod(k)}>{l}</button>)}</div>
          <div className="cf-act">
            <ExportBtn kind="biz" fmt="pdf" args={args} onDone={say} className="fx-btn sm cf-onG">PDF report</ExportBtn>
            <ExportBtn kind="biz" fmt="xlsx" args={args} onDone={say} className="fx-btn sm cf-onG">Excel workbook</ExportBtn>
            {impactFile && <a className="fx-btn sm cf-onG" href={reportUrl(co, impactFile.filename)} download={impactFile.filename}><Ic n="download" s={15} />Daily-run impact workbook</a>}
          </div>
        </div>
        <div className="fx-rib"><h3>From finding to value <span>{period === "all" ? "all items" : "achieved in period; others to date"}</span></h3>
          {[["Identified", T.stake, ""], ["Potential", T.pot, ""], ["Actioned", T.actioned, "act"], ["Achieved", T.ach, "rel"]].map(([l, v, k]) => (
            <div key={l} className={`fx-rb ${k}`} data-tip={tip(l, [[l, rs(v)], ["Share of identified", p1((v / mxF) * 100)]])}>
              <span>{l}</span><span className="fx-rbt"><i style={{ width: `${Math.max(v ? 1.5 : 0, (v / mxF) * 100).toFixed(1)}%` }} /></span><b className="num">{inr(v)}</b>
            </div>))}
          <div className="fx-rbf"><span><b>{T.pot ? Math.round((T.achAll / T.pot) * 100) : 0}%</b> of potential achieved</span><span><b>{inr(T.open)}</b> still open</span>{emails ? <span><b>{emails}</b> test email{emails === 1 ? "" : "s"} sent to you</span> : null}</div>
        </div>
      </section>

      <section className="cf-ms" aria-label="Value by outcome">{OUTCOME_KEYS.map((k) => {
        const m = B.byM[k], [l, col] = OUTCOMES[k], pct = m.pot ? Math.min(100, (m.achAll / m.pot) * 100) : null, risk = k === "risk_prevented";
        if (!m.n) return <div key={k} className="cf-m empty-m" style={{ "--mc": col }}><span className="l"><i />{l}</span><span className="v">—</span><span className="s">No {l.toLowerCase()} items for this company's checks</span></div>;
        return (
          <button key={k} className={`cf-m ${fm === k ? "on" : ""}`} style={{ "--mc": col }} aria-pressed={fm === k} onClick={() => { setFm(fm === k ? "" : k); toLedger(); }}>
            <span className="l"><i />{l}</span><span className="v num">{inr(m.ach)}</span>
            <span className="s">{risk ? `exposure closed on ${m.closed} item${m.closed === 1 ? "" : "s"}` : period === "all" ? "from approved actions" : "approved in this period"}</span>
            <Bar v={m.ach} mx={m.pot || m.stake} col={col} />
            <span className="g"><span>Potential <b>{inr(m.pot)}</b></span><span>{m.closed}/{m.n} approved{pct != null ? " · " + Math.round(pct) + "%" : ""}</span></span>
          </button>);
      })}</section>

      <div className="cf-2 even">
        <section className="fx-tile"><div className="cf-h"><h3>Before and after</h3><span className="sub">When you started → now · if all approved</span></div>
          <div className="cf-ba">{B.BA.map((x) => {
            const better = x.d !== 0 && Math.abs(x.d) > 0.04 && x.d * x.good > 0, worse = Math.abs(x.d) > 0.04 && x.d * x.good < 0;
            const mx = Math.max(Math.abs(x.a || 0), Math.abs(x.b || 0), Math.abs(x.p || 0), 1);
            return (
              <div key={x.l} className="cf-br" data-tip={tip(x.l, [["When you started", fmt(x.a, x.k)], ["Now", fmt(x.b, x.k)], ["If all approved", fmt(x.p, x.k)]])}>
                <span className="l">{x.l}</span>
                <span className="tr"><i className="p" style={{ left: `${((Math.abs(x.p || 0) / mx) * 96).toFixed(1)}%` }} /><i className="a" style={{ left: `${((Math.abs(x.a || 0) / mx) * 96).toFixed(1)}%` }} /><i className={`b ${better ? "up" : worse ? "dn" : ""}`} style={{ left: `${((Math.abs(x.b || 0) / mx) * 96).toFixed(1)}%` }} /></span>
                <span className="n num">{fmt(x.a, x.k)} → <b>{fmt(x.b, x.k)}</b></span>
                <span className={`d num ${better ? "up" : worse ? "dn" : ""}`}>{Math.abs(x.d) > 0.04 ? (x.d > 0 ? "+" : "−") + fmt(Math.abs(x.d), x.k) : "no change"}</span>
              </div>);
          })}</div>
          <p className="fx-hint">Hollow dot: when you started · solid: now · ring: if every open action were approved.</p></section>
        <section className="fx-tile"><div className="cf-h"><h3>Value over time</h3><span className="sub">{B.label} · cumulative, one point per approval</span></div>
          <StepLine pts={trend} label="Value delivered over time" /></section>
      </div>

      <div className="cf-2 even">
        <section className="fx-tile">
          <div className="th"><div><h3>Highest impact actions</h3><p>Approved actions, by what they achieved</p></div></div>
          {topActs.length ? <div className="fx-rank">{topActs.map(({ f, v }, k) => (
            <button key={f.id} onClick={() => onOpen(f)}><span className="i">{k + 1}</span><Mono name={f.party} uc={f.uc} /><span className="p"><b>{f.party}</b><small>{UC[f.uc]?.short} · {f.label || f.action}</small></span><em className="num">{inr(v)}</em></button>
          ))}</div> : <div className="fx-empty sm"><Ic n="bolt" s={20} /><b>No approvals in this period</b><span>Approve actions in the Action Hub and their impact shows here.</span></div>}
        </section>
        <section className="fx-tile">
          <div className="th"><div><h3>{LB("recoveries", "Highest recoveries from customers")}</h3><p>Overdue collected through approved reminders</p></div></div>
          {recs.length ? <div className="fx-rank">{recs.map((r, k) => (
            <div key={r.party} className="row"><span className="i">{k + 1}</span><Mono name={r.party} uc={r.uc} /><span className="p"><b>{r.party}</b><small>{r.n} action{r.n === 1 ? "" : "s"}</small></span><em className="num up">{inr(r.v)}</em></div>
          ))}</div> : <div className="fx-empty sm"><Ic n="wallet" s={20} /><b>No {LB("customers", "customer").replace(/s$/, "")} payments in this period</b><span>Approve a collection reminder to see the recovery here.</span></div>}
        </section>
      </div>

      <section className="fx-tile"><div className="cf-h"><h3>Impact by use case</h3><span className="sub">Click a row to see its items</span></div>
        <div className="fx-tw"><table className="fx-t cf-t"><thead><tr><th>Use case</th><th>Outcome</th><th className="r">Identified</th><th className="r">Potential</th><th className="r">Achieved</th><th style={{ width: "22%" }}>Achieved vs potential</th><th className="r">Approved</th><th className="r">Still open</th></tr></thead>
          <tbody>{B.byU.map((u) => { const col = OUTCOMES[u.metric][1], p = u.pot ? Math.min(100, (u.achAll / u.pot) * 100) : null;
            return (
              <tr key={u.uc} className={`click ${fu === u.uc ? "on" : ""}`} onClick={() => { setFu(fu === u.uc ? "" : u.uc); toLedger(); }}>
                <td><b>{u.name}</b><span className="sub">{UC[u.uc]?.short || u.uc}</span></td><td><span className="cf-ochip" style={{ "--mc": col }}>{OUTCOMES[u.metric][0]}</span></td>
                <td className="r num">{inr(u.stake)}</td><td className="r num">{inr(u.pot)}</td><td className="r num" style={{ color: "var(--ok)" }}>{u.achAll ? inr(u.achAll) : "—"}</td>
                <td>{p != null ? <><Bar v={u.achAll} mx={u.pot} col={col} /><span className="sub">{Math.round(p)}% of potential</span></> : <span className="sub">no money target</span>}</td>
                <td className="r num">{u.closed}/{u.n}</td><td className="r num">{u.open ? inr(u.open) : "—"}</td>
              </tr>); })}</tbody></table></div></section>

      <section className="fx-tile">
        <div className="th"><div><h3>By area</h3><p>What was found, approved and achieved in each business area</p></div></div>
        <div className="fx-tw"><table className="fx-t">
          <thead><tr><th>Area</th><th className="r">Issues</th><th>Found vs still open</th><th className="r">Found</th><th className="r">Approved</th><th className="r">Achieved</th></tr></thead>
          <tbody>{byArea.map((a) => (
            <tr key={a.id} className="click" onClick={() => { setFa(fa === a.id ? "" : a.id); toLedger(); }}><td><span className="fx-ck"><span className="sw" style={{ background: hueOfArea(a.id) }} />{a.label}</span></td><td className="r num">{a.n}</td>
              <td style={{ minWidth: 180 }} data-tip={tip(a.label, [["Found", inr(a.found, true)], ["Still open", inr(a.open, true), hueOfArea(a.id)]])}><span className="fx-dbar"><u style={{ width: `${(a.found / amx) * 100}%`, background: hueOfArea(a.id) }} /><i style={{ width: `${(a.open / amx) * 100}%`, background: hueOfArea(a.id) }} /></span></td>
              <td className="r num">{inr(a.found)}</td><td className="r num">{a.done}</td><td className="r num"><b>{inr(a.ach)}</b></td></tr>
          ))}</tbody>
        </table></div>
        <p className="fx-hint">Achieved counts cash collected, costs saved and risk stopped by the actions you approved.</p>
      </section>

      <section className="fx-tile" id="cfLedger">
        <div className="cf-h"><h3>Evidence ledger</h3><span className="sub">{L.length} of {B.rows.length} items{flt.length ? " · " + flt.join(" · ") : ""}</span>{flt.length > 0 && <button className="fx-lnk" onClick={clear}>Clear filters</button>}
          <span className="sp" /><button className="fx-btn sm" onClick={csv}><Ic n="download" s={15} />Download these (CSV)</button></div>
        <div className="cf-f">
          <input type="search" placeholder="Party, voucher or issue" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the ledger" />
          <select value={fm} onChange={(e) => setFm(e.target.value)} aria-label="Outcome"><option value="">All outcomes</option>{OUTCOME_KEYS.map((k) => <option key={k} value={k}>{OUTCOMES[k][0]}</option>)}</select>
          <select value={fu} onChange={(e) => setFu(e.target.value)} aria-label="Use case"><option value="">All use cases</option>{B.byU.map((u) => <option key={u.uc} value={u.uc}>{u.name}</option>)}</select>
          <select value={fa} onChange={(e) => setFa(e.target.value)} aria-label="Area"><option value="">All areas</option>{(AREAS || []).filter(([id]) => byArea.some((a) => a.id === id)).map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select>
          <select value={fs} onChange={(e) => setFs(e.target.value)} aria-label="Status"><option value="">All statuses</option>{Object.keys(ST).map((k) => <option key={k} value={k}>{ST[k][0]}</option>)}</select>
          <input className="min" inputMode="numeric" value={fmin} onChange={(e) => setFmin(e.target.value.replace(/\D/g, ""))} placeholder="Minimum ₹" aria-label="Minimum amount" />
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort"><option value="ach">Most value achieved</option><option value="stake">Largest at stake</option><option value="pot">Largest potential</option><option value="open">Open first</option></select>
        </div>
        {shown.length ? <>
          <div className="fx-tw"><table className="fx-t cf-t cf-led"><thead><tr><th>Party and issue</th><th>Use case</th><th className="r">At stake</th><th className="r">Potential</th><th className="r">Achieved</th><th>Evidence</th><th>Status</th></tr></thead>
            <tbody>{shown.map((r) => (
              <tr key={r.id} className="click" onClick={() => onOpen(r.f)}>
                <td><b>{r.party}</b><span className="sub cl">{r.title}</span></td>
                <td>{UC[r.uc]?.short || r.ucn}<span className="cf-ochip sm" style={{ "--mc": OUTCOMES[r.metric][1] }}>{OUTCOMES[r.metric][0]}</span></td>
                <td className="r num">{inr(r.stake)}</td><td className="r num">{r.estd ? inr(r.exp) : <span className="sub">{r.nocash ? "no money target" : "not estimated"}</span>}</td>
                <td className="r num" style={r.achP ? { color: "var(--ok)", fontWeight: 600 } : undefined}>{r.achP ? inr(r.achP) : "—"}</td>
                <td><span className="cf-ref">{r.refs.split(",").slice(0, 2).join(", ")}{r.refs.split(",").length > 2 ? " …" : ""}</span><span className="sub cl">{r.evid}</span></td>
                <td><span className={`fx-sev ${r.stage === "Approved" ? "clear" : r.severity}`}>{r.stage === "Approved" ? "Approved" : r.severity}</span>{r.at && <span className="sub">{r.at.replace("T", " ").slice(0, 16)}</span>}</td>
              </tr>))}</tbody></table></div>
          {L.length > shown.length && <button className="fx-btn sm" style={{ marginTop: 10 }} onClick={() => setShowAll(true)}>Show all {L.length}</button>}
        </> : <div className="fx-empty sm"><b>Nothing matches these filters</b><button className="fx-lnk" onClick={clear}>Clear filters</button></div>}
        <p className="fx-hint">Each use case feeds one outcome, so the same rupee is never counted twice. Click any item for its finding, checks, evidence and the message.</p>
      </section>
    </div>
  );
}
