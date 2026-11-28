"use client";
// Financial Overview: where the money stands (revenue, margin, profit, cash, working capital, receivables) and what needs
// attention, then the exposure by area, approvals, priorities and the control scorecard. Every KPI opens its formula and source.
import { useEffect, useMemo, useState } from "react";
import { AREAS, UC, inr, scorecard, seedFull, seedMeta, sevLabel, topOpen, LB } from "@/lib/engine";
import { BIZ, FIN, LVL, d1, fmtDate, fmtK, num, p1, signals, x2 } from "@/lib/cfo";
import { exportReport } from "@/lib/cfoExport";
import { Row } from "./Hub";
import { AREA_ICON, Big, Ic, days, hueOfArea, tip } from "./ui";
import { Bar, BarsCombo, Bridge, CashChart, EbitdaChart, Kpi, rs } from "./CfoCharts";

const SEV = [["critical", "Critical", "#D6402B"], ["high", "High", "#D9731A"], ["medium", "Medium", "#A57A00"], ["low", "Low", "#3561C9"]];
const bcol = (b) => (/not due/i.test(b) ? "var(--ok)" : /^1-30/.test(b) ? "#C9A227" : /^31-60/.test(b) ? "var(--high)" : "var(--crit)");

// Export button shared by Financial Overview, Business Impact and Reports.
export function ExportBtn({ kind, fmt, args, onDone, className = "fx-btn sm", children }) {
  const [busy, setBusy] = useState(false);
  return (
    <button className={className} disabled={busy} onClick={async () => {
      setBusy(true);
      try { const f = await exportReport(kind, fmt, args()); onDone?.(`Saved: ${f}`); }
      catch (e) { onDone?.(e?.message === "load" ? "The PDF tools could not load. Check the connection and try again." : "Could not build the file."); }
      finally { setBusy(false); }
    }}><Ic n={fmt === "pdf" ? "report" : "file"} s={15} />{busy ? (fmt === "pdf" ? "Building the PDF…" : "Building…") : children}</button>
  );
}

export default function Board({ co, state, list, now, base, proj, onOpen, onEdit, onUndo, onPickArea, onPickUc, onSeeAll, onBiz, say }) {
  const K0 = now.kpi, B = base.kpi, P0 = proj.kpi;
  const F = useMemo(() => FIN(co, state, now, base), [co, state, now, base]);
  const Bz = useMemo(() => BIZ(state, list), [state, list]);
  const SG = useMemo(() => signals(F, Bz), [F, Bz]);
  const [dk, setDk] = useState(null);       // metric detail drawer
  const K = F.K, M = F.M, company = seedMeta.company;
  const args = () => ({ F, Bz, company, co });
  const openK = (k) => { if (/^biz:/.test(k)) return onBiz?.(k.slice(4)); setDk(k); };
  const hl = SG.filter((s) => s.lvl !== "good").slice(0, 2);
  const verdict = [K.revenue.avail ? <>Revenue of <b>{inr(K.revenue.value)}</b> in {F.days} days, running at <b>{inr(K.run_rate.value)}</b> a year</> : null,
    K.gross_margin.avail ? <>a <b>{p1(K.gross_margin.value)}</b> gross margin on a purchase basis</> : null,
    K.ebitda.avail ? <>EBITDA of <b>{inr(K.ebitda.value)}</b>{K.pbt.avail && K.pbt.value < 0 ? <> and a <b>pre-tax loss of {inr(-K.pbt.value)}</b></> : K.pbt.avail ? <> and <b>{inr(K.pbt.value)}</b> before tax</> : null}</> : null,
    K.cash_cover.avail ? <>cash covers <b>{K.cash_cover.value.toFixed(1)} months</b> of payments</> : null].filter(Boolean);
  const ro = (key, sub, flash) => { const k = K[key]; return (
    <button key={key} className={`fx-r cf-r ${flash ? "flash" : ""}`} onClick={() => openK(key)}><span className="l">{k.label}</span><span className="v num">{k.avail ? fmtK(k.fmt, k.value) : "Not available"}</span><span className="p">{k.avail ? sub : k.why}</span></button>); };
  const fy = F.from ? `${fmtDate(F.from)} – ${fmtDate(F.asOn)}` : fmtDate(F.asOn);
  // working capital composition (what is listed; the remainder is shown as its own line, never hidden)
  const P = F.P, comp = [["Cash and bank", K.cash.value, 1], ["Receivables", K.receivables.value, 1], ["Advances to suppliers", num(P.advances_to_vendors), 1], ["Payables", num(P.payables), -1]].filter((x) => x[1]);
  const listed = comp.reduce((t, x) => t + x[1] * x[2], 0), other = K.wc.avail ? K.wc.value - listed : null, cmx = Math.max(1, ...comp.map((x) => Math.abs(x[1])), Math.abs(other || 0));
  const ageMx = Math.max(1, F.sums.tot), topMx = Math.max(1, ...F.top.map((t) => t.overdue));

  // ---- existing Overview tiles: exposure by area, approvals, priorities, scorecard
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
  const pct = K0.total ? (K0.done / K0.total) * 100 : 0, r = 46, c = 2 * Math.PI * r;

  if (!seedFull.position && !M.length) return <div className="fx-empty"><b>No financial position yet</b><span>It appears after the next processing run.</span></div>;
  return (
    <div className="fx-board cf">
      <section className="fx-hero cf-hero" aria-label="Financial position">
        <div className="cf-hl">
          <div className="fx-hx-k"><span className="fx-live"><i />From Tally</span><span>{fy}</span><span>{F.days || "?"} days</span></div>
          <button className="fx-big" onClick={() => openK("revenue")}><span className="v num">{K.revenue.avail ? <Big v={K.revenue.value} /> : "—"}</span><span className="t">revenue, year to date{F.otherIn ? `, including ${inr(F.otherIn)} other income` : ""}</span></button>
          <p className="cf-verdict">{verdict.map((v, i) => <span key={i}>{i ? ", " : ""}{v}</span>)}.{hl.length ? <span className="cf-flag">{hl.length} point{hl.length === 1 ? "" : "s"} need{hl.length === 1 ? "s" : ""} attention</span> : null}</p>
          <div className="cf-act">
            <ExportBtn kind="fin" fmt="pdf" args={args} onDone={say} className="fx-btn sm cf-onG">PDF report</ExportBtn>
            <ExportBtn kind="fin" fmt="xlsx" args={args} onDone={say} className="fx-btn sm cf-onG">Excel workbook</ExportBtn>
          </div>
        </div>
        <div className="cf-hr">
          {ro("gross_margin", K.gross_profit.avail ? inr(K.gross_profit.value) + " gross profit" : "")}
          {ro("cash", K.cash_cover.avail ? K.cash_cover.value.toFixed(1) + " months of payments" : "", K0.cash !== B.cash)}
          {ro("wc", K.ccc.avail ? "cycle " + d1(K.ccc.value) : "")}
          {ro("net_cash", K.collection.avail ? p1(K.collection.value) + " of billing collected" : "")}
          {ro("dso", K.dpo.avail ? "DPO " + d1(K.dpo.value) : "")}
          {K.ebitda.avail ? ro("ebitda", (K.ebitda_margin.avail ? p1(K.ebitda_margin.value) + " margin · " : "") + (K.pbt.avail ? (K.pbt.value < 0 ? "pre-tax loss " + inr(-K.pbt.value) : "pre-tax " + inr(K.pbt.value)) : ""))
            : ro("overdue", K.overdue_share.avail ? p1(K.overdue_share.value) + " of receivables" : "")}
        </div>
      </section>

      {SG.length > 0 && <section className="cf-sig" aria-label="What needs attention">{SG.slice(0, 6).map((s, i) => (
        <button key={i} className={`cf-s ${s.lvl}`} onClick={() => openK(s.k)}><span className="k" style={{ color: LVL[s.lvl][1] }}>{LVL[s.lvl][0]}</span><b>{s.t}</b><span>{s.d}</span></button>))}</section>}

      {F.LG && <>
        <div className="cf-2">
          <section className="fx-tile"><div className="cf-h"><h3>From revenue to profit</h3><span className="sub">Year to date, from the Tally ledgers · before stock adjustment and tax</span></div><Bridge F={F} /></section>
          <section className="fx-tile cf-stack"><h3>Profitability and funding</h3>
            <Kpi k={K.ebitda_margin} onOpen={openK} extra={K.opex_ratio.avail ? p1(K.opex_ratio.value) + " of revenue spent on overheads" : ""} />
            <Kpi k={K.interest_cover} onOpen={openK} extra={K.interest.avail ? inr(K.interest.value) + " interest" : ""} />
            <Kpi k={K.loans} onOpen={openK} extra={K.loans_change.avail && K.loans_change.value ? (K.loans_change.value > 0 ? "up " : "down ") + inr(Math.abs(K.loans_change.value)) + " this year" : "unchanged this year"} />
            <Kpi k={K.net_debt} onOpen={openK} extra={(K.net_debt.label === "Net cash" ? "cash exceeds borrowings" : "") + (K.debt_ebitda.avail ? (K.net_debt.label === "Net cash" ? " · " : "") + "borrowings " + x2(K.debt_ebitda.value) + " annualised EBITDA" : "")} />
          </section>
        </div>
        <div className="cf-2">
          <section className="fx-tile"><div className="cf-h"><h3>EBITDA by month</h3><span className="sub">Bars: EBITDA · dot: pre-tax · before stock movement</span></div><EbitdaChart LM={F.LM} />
            <div className="cf-leg"><span><i style={{ background: "var(--cf-in)" }} />EBITDA</span><span><i style={{ background: "var(--cf-out)" }} />Negative EBITDA</span><span><i style={{ background: "var(--cf-line)", borderRadius: "50%" }} />Pre-tax</span></div></section>
          <section className="fx-tile"><div className="cf-h"><h3>Where the money goes</h3><button className="fx-lnk" onClick={() => openK("opex")}>All expenses <Ic n="right" s={13} /></button></div>
            <div className="cf-top">{(() => { const X = F.LG.expenses.filter((x) => x.amount > 0).slice(0, 8), mx = Math.max(1, ...X.map((x) => x.amount));
              return X.map((x) => <div key={x.ledger} data-tip={tip(x.ledger, [["Amount", rs(x.amount)], ["Group", x.group], ["Share of revenue", p1((x.amount / (F.LG.pl.revenue || 1)) * 100)]])}><span>{x.ledger}</span><Bar v={x.amount} mx={mx} col={x.class === "direct_exp" ? "var(--cf-buy)" : x.class === "opex" ? "var(--cf-line)" : "var(--faint)"} /><b className="num">{inr(x.amount)}</b></div>); })()}</div>
            <div className="cf-leg"><span><i style={{ background: "var(--cf-buy)" }} />Direct</span><span><i style={{ background: "var(--cf-line)" }} />Operating</span><span><i style={{ background: "var(--faint)" }} />Depreciation and interest</span></div></section>
        </div>
      </>}

      <div className="cf-2">
        <section className="fx-tile"><div className="cf-h"><h3>{LB("sales", "Billing")} and {LB("purchases", "purchases").toLowerCase()} by month</h3><span className="sub">Voucher values incl. GST{M.some((m) => m.partial) ? " · * month still running" : ""}</span></div>
          <BarsCombo M={M} /><div className="cf-leg"><span><i style={{ background: "var(--cf-bill)" }} />{LB("sales", "Billing")}</span><span><i style={{ background: "var(--cf-buy)" }} />{LB("purchases", "Purchases")}</span><span><i className="ln" style={{ background: "var(--cf-line)" }} />{LB("purchases", "Purchases")} ÷ {LB("sales", "billing").toLowerCase()} (right)</span></div></section>
        <section className="fx-tile cf-stack"><h3>Revenue and margin</h3>
          <Kpi k={K.revenue} onOpen={openK} extra={K.run_rate.avail ? inr(K.run_rate.value) + " a year at this pace" : ""} />
          <Kpi k={K.gross_profit} onOpen={openK} extra={K.direct.avail ? inr(K.direct.value) + " purchases and direct costs" : ""} />
          <Kpi k={K.gross_margin} onOpen={openK} extra="before stock movement" />
          <Kpi k={K.credit_note_ratio} onOpen={openK} extra={inr(F.sums.cn) + " of credit notes"} />
        </section>
      </div>

      <div className="cf-2">
        <section className="fx-tile"><div className="cf-h"><h3>Cash in and cash out</h3><span className="sub">Receipt and payment vouchers · dot = net for the month</span></div><CashChart M={M} />
          <div className="cf-leg"><span><i style={{ background: "var(--cf-in)" }} />Received</span><span><i style={{ background: "var(--cf-out)" }} />Paid out</span><span>Year to date: <b className={(K.net_cash.value || 0) < 0 ? "neg" : "pos"}>{(K.net_cash.value < 0 ? "−" : "+") + inr(Math.abs(K.net_cash.value || 0))}</b></span></div></section>
        <section className="fx-tile cf-stack"><h3>Liquidity</h3>
          <Kpi k={K.cash} onOpen={openK} extra={K0.cash !== B.cash ? `+${inr(K0.cash - B.cash)} from approved collections` : "closing balance"} />
          <Kpi k={K.cash_cover} onOpen={openK} extra="at the average monthly payment run" />
          <Kpi k={K.trade_liq} onOpen={openK} extra="trade assets over payables" />
          <Kpi k={K.collection} onOpen={openK} extra={inr(F.sums.rc) + " received"} />
        </section>
      </div>

      <div className="cf-2 even">
        <section className="fx-tile"><div className="cf-h"><h3>Working capital</h3><button className="fx-lnk" onClick={() => openK("wc")}>{K.wc.avail ? inr(K.wc.value) : "Not available"} <Ic n="right" s={13} /></button></div>
          <div className="cf-wc">{comp.map(([l, v, sg2]) => <div key={l} className="cf-wr" data-tip={tip(l, [[sg2 > 0 ? "Adds" : "Uses", rs(v)]])}><span>{l}</span><Bar v={Math.abs(v)} mx={cmx} col={sg2 > 0 ? "var(--cf-in)" : "var(--cf-out)"} /><b className="num">{sg2 < 0 ? "−" : ""}{inr(v)}</b></div>)}
            {other != null && Math.abs(other) >= 1 && <div className="cf-wr o" data-tip={tip("Statutory and other current items", [["Net effect", (other < 0 ? "−" : "+") + rs(Math.abs(other))], ["What it is", "Duties, taxes and other current balances in the trial balance"]])}><span>Statutory and other items (net)</span><Bar v={Math.abs(other)} mx={cmx} col="var(--faint)" /><b className="num">{other < 0 ? "−" : ""}{inr(Math.abs(other))}</b></div>}
            {K.wc.avail && <div className="cf-wr t"><span>Working capital</span><span /><b className="num">{inr(K.wc.value)}</b></div>}</div>
          <div className="cf-cyc">{[["dso", "Customers take"], ["dio", "Stock is held"], ["dpo", "Suppliers give"], ["ccc", "Net cycle"]].map(([k, l]) => <button key={k} onClick={() => openK(k)} className={K[k].avail ? "" : "na"}><span>{l}</span><b className="num">{K[k].avail ? d1(K[k].value) : "n/a"}</b></button>)}</div></section>
        <section className="fx-tile"><div className="cf-h"><h3>Receivables health</h3><button className="fx-lnk" onClick={() => openK("overdue")}>{K.overdue.avail ? inr(K.overdue.value) + " overdue" : ""} <Ic n="right" s={13} /></button></div>
          {F.B.length ? <>
            <div className="cf-age" role="img" aria-label="Receivables by age">{F.B.filter((b) => b.amount > 0).map((b) => <i key={b.bucket} style={{ width: `${((b.amount / ageMx) * 100).toFixed(2)}%`, background: bcol(b.bucket) }} data-tip={tip(b.bucket === "Not due" ? "Not yet due" : b.bucket + " days overdue", [["Amount", rs(b.amount), bcol(b.bucket)], ["At the start", rs(base.ageing.find((x) => x.bucket === b.bucket)?.amount)], ["Share", p1((b.amount / ageMx) * 100)]])} />)}</div>
            <div className="cf-leg">{F.B.filter((b) => b.amount > 0).map((b) => <span key={b.bucket}><i style={{ background: bcol(b.bucket) }} />{b.bucket === "Not due" ? "Not due" : b.bucket + " d"} {inr(b.amount)}</span>)}</div></> : <div className="fx-empty sm">No bill-wise receivables.</div>}
          {F.top.length > 0 && <><h4 className="cf-h4">{LB("top_overdue", "Largest overdue customers")}</h4><div className="cf-top">{F.top.slice(0, 6).map((t) => <div key={t.party} data-tip={tip(t.party, [["Overdue (open)", rs(t.overdue)], ["Share of all overdue", p1((t.overdue / (F.sums.od || 1)) * 100)]])}><span>{t.party}</span><Bar v={t.overdue} mx={topMx} col="var(--crit)" /><b className="num">{inr(t.overdue)}</b></div>)}</div></>}
          <div className="cf-mini"><Kpi k={K.over60} onOpen={openK} /><Kpi k={K.dso} onOpen={openK} extra={`${days(P0.dso)} if every action is approved`} /></div></section>
      </div>

      <h2 className="cf-sec">Actions and exposure <span>What FlowIQ found in the books, and what you have approved</span></h2>
      <div className="fx-bento">
        <section className="fx-tile s7">
          <div className="th"><div><h3>Money at stake by area</h3><p>Faded: at the start · solid: still open. Click an area to work on it.</p></div><span className="fx-pill num">{inr(K0.atStake)} of {inr(B.atStake)}</span></div>
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
              <div><b className="num">{K0.done}<small>/{K0.total}</small></b><span>approved</span></div>
            </div>
            <div className="fx-sevs">{sev.map((s) => (
              <div key={s.k}><span><i style={{ background: s.c }} />{s.l}</span><span className="t"><i style={{ width: `${s.total ? (s.done / s.total) * 100 : 0}%`, background: s.c }} /></span><b className="num">{s.done}/{s.total}</b></div>
            ))}</div>
          </div>
          <p className="fx-hint">{inr(B.atStake - K0.atStake)} actioned · {inr(K0.value)} saved or risk stopped{all ? "" : " · approve an action to see the numbers move"}</p>
        </section>

        <section className="fx-tile s12">
          <div className="th"><div><h3>Act on these first</h3><p>Highest severity, then amount</p></div><button className="fx-lnk" onClick={onSeeAll}>See all {K0.total - K0.done} <Ic n="right" s={13} /></button></div>
          {top.length ? <div className="fx-list">{top.map((f) => <Row key={f.id} f={f} state={state} max={max} onOpen={onOpen} onEdit={onEdit} onUndo={onUndo} />)}</div>
            : <div className="fx-empty"><Ic n="checkc" s={22} /><b>Everything is approved</b><span>Use Reset to Tally to start again.</span></div>}
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

      <details className="fx-tile cf-na"><summary><b>What this data cannot show yet</b> <span className="sub">{F.NA.length} item{F.NA.length === 1 ? "" : "s"}, listed so a blank is never read as zero</span></summary>
        <div className="cf-nal">{F.NA.map((n) => <div key={n.key}><b>{n.label}</b><span>{n.why}</span></div>)}</div></details>

      {dk && <MetricDrawer F={F} k={dk} onClose={() => setDk(null)} />}
    </div>
  );
}

// Every KPI opens its formula, source and the rows behind it.
function MetricDrawer({ F, k: key, onClose }) {
  useEffect(() => { const h = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [onClose]);
  const k = F.K[key]; if (!k) return null;
  const T = (h, rows) => (
    <div className="fx-tw"><table className="fx-t"><thead><tr>{h.map((x, i) => <th key={i} className={i ? "r" : ""}>{x}</th>)}</tr></thead>
      <tbody>{rows.map((r, j) => <tr key={j}>{r.map((x, i) => <td key={i} className={i ? "r num" : ""}>{x}</td>)}</tr>)}</tbody></table></div>);
  const sg = (v) => (v < 0 ? "−" : "") + inr(Math.abs(v));
  const MON_K = ["revenue", "run_rate", "direct", "gross_profit", "gross_margin", "billing", "receipts", "payments", "net_cash", "collection", "credit_note_ratio", "cash_cover"];
  const PLK = ["ebitda", "ebitda_margin", "opex", "opex_ratio", "depreciation", "interest", "pbt", "pbt_margin", "interest_cover"], FUK = ["loans", "loans_change", "net_debt", "debt_ebitda", "fixed_assets"];
  const body = [];
  if (MON_K.includes(key)) body.push(T(["Month", "Billing", "Purchases", "Received", "Paid out", "Net", "Credit notes"], F.M.map((m) => [m.label + (m.partial ? " *" : ""), inr(m.sales), inr(m.purchase), inr(m.receipts), inr(m.payments), sg((m.receipts || 0) - (m.payments || 0)), m.credit_notes == null ? "—" : inr(m.credit_notes)])
    .concat([["Total", inr(F.sums.sb), inr(F.sums.pu), inr(F.sums.rc), inr(F.sums.py), sg(F.sums.rc - F.sums.py), inr(F.sums.cn)]])));
  else if (["overdue", "overdue_share", "over60", "concentration", "receivables"].includes(key)) {
    body.push(T(["Age", "Amount", "Share"], F.B.map((b) => [b.bucket, inr(b.amount), p1((b.amount / (F.sums.tot || 1)) * 100)])));
    if (F.top.length) body.push(T(["Customer", "Overdue (open)"], F.top.slice(0, 15).map((t) => [t.party, inr(t.overdue)])));
  } else if (["wc", "trade_liq", "cash", "payables", "duties", "inventory", "dso", "dpo", "dio", "ccc"].includes(key))
    body.push(T(["Component", "Balance"], [["Cash and bank", F.K.cash.value], ["Receivables", F.K.receivables.value], ["Advances to suppliers", num(F.P.advances_to_vendors)], ["Payables", num(F.P.payables)], ["Duties and taxes (net, as in Tally)", num(F.P.duties_taxes_net)], ["Working capital", num(F.P.working_capital)]].filter((x) => x[1] != null).map(([l, v]) => [l, inr(v)])));
  if (F.LG && PLK.includes(key)) {
    const Q = F.LG.pl;
    body.push(T(["Profit and loss", "Year to date", "% of revenue"], [["Revenue", Q.revenue], ["Purchases", -Q.purchases], ["Direct expenses", -Q.direct_expenses], ["Gross profit (before stock)", Q.gross_profit_before_stock], ["Other income", Q.other_income], ["Operating expenses", -Q.operating_expenses], ["EBITDA", Q.ebitda], ["Depreciation", -Q.depreciation], ["Interest and finance costs", -Q.interest], ["Profit before tax (before stock)", Q.pbt_before_stock]].map(([l, v]) => [l, sg(v), p1((Math.abs(v) / (Q.revenue || 1)) * 100)])));
    body.push(T(["Month", "Revenue", "Gross profit", "Operating exp.", "EBITDA", "Pre-tax"], F.LM.map((m) => [m.label, inr(m.revenue), inr(m.gross_profit_before_stock), inr(m.operating_expenses), sg(m.ebitda), sg(m.pbt_before_stock)])));
    body.push(T(["Expense ledger", "Group", "Year to date"], F.LG.expenses.map((x) => [x.ledger, x.group, inr(x.amount)])));
  }
  if (F.LG && FUK.includes(key)) {
    const b = F.LG.bs;
    body.push(T(["Funding and assets", "Start of year", "Now"], [["Borrowings (all)", b.loans_total_open, b.loans_total], ["Cash and bank", b.cash_bank_open, b.cash_bank], ["Net debt (negative = net cash)", (b.loans_total_open || 0) - (b.cash_bank_open || 0), (b.loans_total || 0) - (b.cash_bank || 0)], ["Fixed assets (net)", b.fixed_assets_net_open, b.fixed_assets_net]].map(([l, a, z]) => [l, a == null ? "—" : sg(a), z == null ? "—" : sg(z)])));
    body.push(T(["Borrowing", "Balance now"], [["Secured loans", b.secured_loans], ["Bank overdraft / cash credit", b.bank_od], ["Unsecured loans", b.unsecured_loans]].filter((x) => x[1]).map(([l, v]) => [l, inr(v)])));
  }
  return (
    <>
      <div className="fx-scrim" onClick={onClose} />
      <aside className="fx-drawer cf-dw" role="dialog" aria-label={k.label}>
        <div className="fx-cf-top"><div className="cf-dh"><span className="sub">{seedMeta.company}</span><h2>{k.label}</h2><div className="cf-dv num">{k.avail ? fmtK(k.fmt, k.value) : "Not available"}</div></div>
          <button className="fx-x" onClick={onClose} aria-label="Close"><Ic n="x" s={16} /></button></div>
        <div className="fx-cf-body">
          <div className="cf-def"><div><span>How it is calculated</span><b>{k.formula || ""}</b></div><div><span>Source</span><b>{k.src || ""}</b></div>{!k.avail && <div><span>Why it is not shown</span><b>{k.why}</b></div>}</div>
          {body.map((x, i) => <div key={i}>{x}</div>)}
        </div>
      </aside>
    </>
  );
}
