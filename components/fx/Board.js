"use client";
// Overview: the money position, cash pulse, dues by age, exposure by area, approvals, priorities, scorecard.
import { useEffect, useRef, useState } from "react";
import { AREAS, UC, inr, scorecard, seedFull, sevLabel, topOpen, LB } from "@/lib/engine";
import { Row } from "./Hub";
import { AREA_ICON, Ic, days, hueOfArea, tip } from "./ui";

const AGE_C = { "Not due": "#7FB8A6", "1-30": "#E0B84A", "31-60": "#E38B3C", "61-90": "#DA6A3A", "91-180": "#C94A33", "180+": "#9E2F22" };
const SEV = [["critical", "Critical", "#D6402B"], ["high", "High", "#D9731A"], ["medium", "Medium", "#A57A00"], ["low", "Low", "#3561C9"]];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const short = (v) => (v >= 1e7 ? `${(v / 1e7).toFixed(1)} Cr` : v >= 1e5 ? `${Math.round(v / 1e5)} L` : v ? `${Math.round(v / 1e3)}k` : "0");

function Pulse({ mode }) {
  const ref = useRef(null);
  const [W, setW] = useState(0);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth)); ro.observe(el); setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const m = (seedFull.monthly || []).slice(-12);
  const ka = mode === "sales" ? "sales" : "purchases", kb = mode === "sales" ? "receipts" : "payments";
  const cB = mode === "sales" ? "#C9A227" : "#3B5FC0";
  const H = 250, L = 52, R = 8, T = 12, B = 26;
  const mx = Math.max(1, ...m.flatMap((x) => [Number(x[ka]) || 0, Number(x[kb]) || 0]));
  const step = Math.pow(10, Math.floor(Math.log10(mx))), top = Math.ceil(mx / step) * step;
  const n = m.length || 1, bw = Math.max(1, (W - L - R) / n), x = (i) => L + bw * i + bw / 2, y = (v) => T + (H - T - B) * (1 - (Number(v) || 0) / top);
  const cw = Math.min(30, bw * 0.52);
  const d = m.map((r, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(r[kb]).toFixed(1)}`).join("");
  const lab = (p) => MON[Number(String(p).slice(5, 7)) - 1] || p;
  return (
    <div className="fx-pulse" ref={ref}>
      {W > 0 && m.length > 0 && (
        <svg width={W} height={H} role="img" aria-label={mode === "sales" ? "Sales and receipts by month" : "Purchases and payments by month"}>
          {[0, 1, 2, 3, 4].map((k) => { const v = (top * k) / 4; return <g key={k}><line className="gl" x1={L} x2={W - R} y1={y(v)} y2={y(v)} /><text x={L - 8} y={y(v) + 4} textAnchor="end">{short(v)}</text></g>; })}
          {m.map((r, i) => <rect key={"b" + i} x={x(i) - cw / 2} y={y(r[ka])} width={cw} height={Math.max(0, H - B - y(r[ka]))} rx="5" fill="#0F6B5B" opacity=".9" />)}
          <path d={d} fill="none" stroke={cB} strokeWidth="2.5" strokeLinejoin="round" />
          {m.map((r, i) => <circle key={"c" + i} cx={x(i)} cy={y(r[kb])} r="3.6" fill="#fff" stroke={cB} strokeWidth="2" />)}
          {m.map((r, i) => (W > 520 || i % 2 === 0 || i === n - 1) && <text key={"t" + i} x={x(i)} y={H - 7} textAnchor="middle">{lab(r.m)}</text>)}
          {m.map((r, i) => {
            const gap = (Number(r[ka]) || 0) - (Number(r[kb]) || 0);
            return <rect key={"h" + i} className="hit" x={L + bw * i} y={T} width={bw} height={H - T - B}
              data-tip={tip(`${lab(r.m)} ${String(r.m).slice(0, 4)}`, [[mode === "sales" ? LB("sales", "Sales billed") : LB("purchases", "Purchases"), inr(r[ka], true), "#0F6B5B"], [mode === "sales" ? "Collected" : "Paid", inr(r[kb], true), cB],
                [gap >= 0 ? (mode === "sales" ? "Billed, not collected" : "Bought, not paid") : (mode === "sales" ? "Collected beyond billing" : "Paid beyond purchases"), inr(Math.abs(gap), true)]])} />;
          })}
        </svg>
      )}
    </div>
  );
}

export default function Board({ state, now, base, proj, onOpen, onEdit, onUndo, onPickArea, onPickUc, onSeeAll }) {
  const K = now.kpi, B = base.kpi, P = proj.kpi;
  const pos = seedFull.position || {};
  const [mode, setMode] = useState("sales");
  const ag = now.ageing, agT = ag.reduce((t, b) => t + b.amount, 0) || 1, ag0 = base.ageing.reduce((t, b) => t + b.amount, 0);
  const areas = (AREAS || []).map(([id, label, ucs]) => {
    const xs = now.areas.filter((a) => ucs.includes(a.uc));
    return { id, label, start: xs.reduce((t, a) => t + a.open + a.resolved, 0), open: xs.reduce((t, a) => t + a.open, 0),
      count: xs.reduce((t, a) => t + a.count, 0), done: xs.reduce((t, a) => t + a.count - a.openCount, 0) };
  }).filter((a) => a.count).sort((a, b) => b.start - a.start);
  const amx = Math.max(1, ...areas.map((a) => a.start));
  const all = Object.values(state.approved).length;
  const sev = SEV.map(([k, l, c]) => { const fs = seedFull.findings.filter((f) => f.severity === k); return { k, l, c, total: fs.length, done: fs.filter((f) => state.approved[f.id]).length }; }).filter((s) => s.total);
  const top = topOpen(state, 4);
  const max = Math.max(0, ...top.map((f) => Number(f.amount) || 0));
  const sc = scorecard(state, now).filter((r) => r.total || r.open);
  const pct = K.total ? (K.done / K.total) * 100 : 0, r = 46, c = 2 * Math.PI * r;
  const dlt = (v, good, fmt) => Math.abs(v) < 0.05 ? <small>no change yet</small> : <small className={v * good > 0 ? "up" : "dn"}>{v > 0 ? "+" : "−"}{fmt ? fmt(Math.abs(v)) : inr(Math.abs(v))} since you started</small>;

  return (
    <div className="fx-board">
      <div className="fx-stmt">
        <div><span>Receivables</span><b className="num">{inr(K.receivables)}</b>{dlt(K.receivables - B.receivables, -1)}</div>
        <div className="risk"><span>{LB("overdue", "Overdue from customers")}</span><b className="num">{inr(K.overdue)}</b>{dlt(K.overdue - B.overdue, -1)}</div>
        <div><span>Payables</span><b className="num">{inr(pos.payables)}</b><small>DPO {days(pos.dpo)}</small></div>
        <div><span>Cash & bank</span><b className="num">{inr(K.cash)}</b>{dlt(K.cash - B.cash, 1)}</div>
      </div>

      <div className="fx-bento">
        <section className="fx-tile s7">
          <div className="th"><div><h3>Cash pulse</h3><p>{mode === "sales" ? "Billed vs collected" : "Bought vs paid"} each month, from Tally</p></div>
            <div className="fx-seg sm"><button aria-pressed={mode === "sales"} onClick={() => setMode("sales")}>{LB("sales", "Sales")}</button><button aria-pressed={mode === "buy"} onClick={() => setMode("buy")}>{LB("purchases", "Purchases")}</button></div></div>
          <Pulse mode={mode} />
          <div className="fx-lg"><span><i style={{ background: "#0F6B5B" }} />{mode === "sales" ? LB("sales", "Sales billed") : LB("purchases", "Purchases")}</span><span><i className="ln" style={{ background: mode === "sales" ? "#C9A227" : "#3B5FC0" }} />{mode === "sales" ? "Collected" : "Paid"}</span></div>
        </section>

        <section className="fx-tile s5">
          <div className="th"><div><h3>{LB("dues_by_age", "Customer dues by age").replace(/ days overdue$/, " age")}</h3><p>Open {LB("customers", "customer").replace(/s$/, "")} bills. Collections clear the oldest first.</p></div><b className="fx-tot num">{inr(agT)}</b></div>
          <div className="fx-agebar">{ag.map((b) => b.amount > 0 && (
            <i key={b.bucket} style={{ width: `${(b.amount / agT) * 100}%`, background: AGE_C[b.bucket] || "#999" }}
              data-tip={tip(b.bucket === "Not due" ? "Not yet due" : `${b.bucket} days overdue`, [["Now", inr(b.amount, true), AGE_C[b.bucket]], ["At the start", inr(base.ageing.find((x) => x.bucket === b.bucket)?.amount, true)], ["Share", Math.round((b.amount / agT) * 100) + "%"]])}>
              {b.amount / agT > 0.12 ? `${Math.round((b.amount / agT) * 100)}%` : ""}</i>))}</div>
          <div className="fx-agel">{ag.map((b) => <div key={b.bucket} style={{ borderColor: AGE_C[b.bucket] || "#999" }}><span>{b.bucket === "Not due" ? "Not yet due" : `${b.bucket} days`}</span><b className="num">{inr(b.amount)}</b></div>)}</div>
          <p className="fx-hint">{ag0 - agT > 1 ? `${inr(ag0 - agT)} collected from these bills so far. ` : ""}DSO {days(K.dso)} now, {days(P.dso)} if every action is approved.</p>
        </section>

        <section className="fx-tile s7">
          <div className="th"><div><h3>Money at stake by area</h3><p>Faded: at the start · solid: still open. Click an area to work on it.</p></div><span className="fx-pill num">{inr(K.atStake)} of {inr(B.atStake)}</span></div>
          <div className="fx-areas">{areas.map((a) => (
            <button key={a.id} className="fx-ar" onClick={() => onPickArea(a.id)}
              data-tip={tip(a.label, [["Open now", inr(a.open, true), hueOfArea(a.id)], ["At the start", inr(a.start, true)], ["Approved", `${a.done} of ${a.count}`]])}>
              <span className="n"><span className="sw" style={{ background: hueOfArea(a.id) }}><Ic n={AREA_ICON[a.id] || "grid"} s={12} /></span>{a.label}</span>
              <span className="t"><u style={{ width: `${(a.start / amx) * 100}%`, background: hueOfArea(a.id) }} /><i style={{ width: `${Math.max(a.open ? 1 : 0, (a.open / amx) * 100)}%`, background: hueOfArea(a.id) }} /></span>
              <b className="num">{inr(a.open)}</b><em>{a.done}/{a.count}</em>
            </button>))}</div>
        </section>

        <section className="fx-tile s5">
          <div className="th"><div><h3>Approvals</h3><p>Most severe first</p></div></div>
          <div className="fx-appr">
            <div className="fx-ring">
              <svg viewBox="0 0 110 110" width="128" height="128" role="img" aria-label={`${pct.toFixed(0)}% approved`}>
                <circle cx="55" cy="55" r={r} fill="none" stroke="#EEF1EC" strokeWidth="10" />
                {pct > 0.5 && <circle cx="55" cy="55" r={r} fill="none" stroke="#0F6B5B" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(c * pct) / 100} ${c}`} transform="rotate(-90 55 55)" className="arc" />}
              </svg>
              <div><b className="num">{K.done}<small>/{K.total}</small></b><span>approved</span></div>
            </div>
            <div className="fx-sevs">{sev.map((s) => (
              <div key={s.k}><span><i style={{ background: s.c }} />{s.l}</span><span className="t"><i style={{ width: `${s.total ? (s.done / s.total) * 100 : 0}%`, background: s.c }} /></span><b className="num">{s.done}/{s.total}</b></div>
            ))}</div>
          </div>
          <p className="fx-hint">{inr(B.atStake - K.atStake)} actioned · {inr(K.value)} saved or risk stopped{all ? "" : " · approve an action to see the numbers move"}</p>
        </section>

        <section className="fx-tile s7">
          <div className="th"><div><h3>Act on these first</h3><p>Highest severity, then amount</p></div><button className="fx-lnk" onClick={onSeeAll}>See all {K.total - K.done} <Ic n="right" s={13} /></button></div>
          {top.length ? <div className="fx-list">{top.map((f) => <Row key={f.id} f={f} state={state} max={max} onOpen={onOpen} onEdit={onEdit} onUndo={onUndo} />)}</div>
            : <div className="fx-empty"><Ic n="checkc" s={22} /><b>Everything is approved</b><span>Use Reset to Tally to start again.</span></div>}
        </section>

        <section className="fx-tile s5">
          <div className="th"><div><h3>Financial position</h3><p>From Tally · {pos.days} days from {pos.period_from}</p></div></div>
          <div className="fx-pos">{[
            ["Revenue (period)", inr(pos.revenue)], ["Receivables", inr(K.receivables)], ["Payables", inr(pos.payables)], ["Working capital", inr(pos.working_capital)],
            ["Duties & taxes (net)", inr(pos.duties_taxes_net)], ["DSO (period)", days(pos.dso)], ["DPO", days(pos.dpo)], ["Cash cycle", days(pos.ccc)],
          ].map(([l, v]) => <div key={l}><span>{l}</span><b className="num">{v}</b></div>)}</div>
        </section>

        <section className="fx-tile s12">
          <div className="th"><div><h3>Control scorecard</h3><p>Every check that found something. Updates as you approve; click a row to open it.</p></div></div>
          <div className="fx-tw"><table className="fx-t sc">
            <thead><tr><th>Check</th><th className="r">Open</th><th className="r">At stake</th><th>Severity</th><th>Decision needed</th><th>Owner</th></tr></thead>
            <tbody>
              {sc.map((r2) => (
                <tr key={r2.uc} className="click" onClick={() => onPickUc(r2.uc)}>
                  <td><span className="fx-ck"><span className="sw" style={{ background: hueOfArea(UC[r2.uc]?.area) }} />{r2.name}</span></td>
                  <td className="r num"><span className="fx-frac"><i style={{ width: `${r2.total ? ((r2.total - r2.open) / r2.total) * 100 : 0}%` }} /></span>{r2.open} / {r2.total}</td>
                  <td className="r num">{inr(r2.atStake)}</td>
                  <td><span className={`fx-sev ${r2.severity || "clear"}`}>{sevLabel(r2.severity)}</span></td>
                  <td className="dec">{r2.decision}</td>
                  <td className="mut">{r2.owner}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td>Total</td><td className="r num">{sc.reduce((s, x) => s + x.open, 0)}</td><td className="r num">{inr(sc.reduce((s, x) => s + x.atStake, 0))}</td><td colSpan={3} /></tr></tfoot>
          </table></div>
        </section>
      </div>
    </div>
  );
}
