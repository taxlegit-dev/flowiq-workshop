"use client";
// Business area page: one cockpit per check (use case), as in the FlowIQ Automation dashboard.
// Header with Before/After pills, Results so far / Forecast, four KPIs, check tabs with include switches,
// Before vs after side by side, and the Actions workflow for the check.
import { useState } from "react";
import { AREAS, UC, compute, impactOf, inr, playbooks, seedMeta } from "@/lib/engine";
import { Ic, areaLabel, days, hueOfArea, tip } from "./ui";

const BEF = "#D1242F", AFT = "#178548";
// The names the Automation dashboard uses for the first eight checks; the rest use the catalogue name.
const NAME8 = { UC1: "Late-paying customers", UC2: "Over credit limit", UC3: "Selling to late payers", UC4: "Duplicate entries",
  UC5: "Supplier payment timing", UC6: "GST credit at risk", UC7: "Bills not matching orders", UC8: "Sales invoice errors" };
export const ucTitle = (k) => NAME8[k] || UC[k]?.name || k;
const UCI = { UC1: "receipt", UC2: "alert", UC3: "x", UC4: "layers", UC5: "wallet", UC6: "scale", UC7: "checkc", UC8: "file" };
const PARTY_TYPES = new Set(["reminder", "refund_request", "debit_note_request", "gst_vendor_followup"]);
const CUSTOMER_UC = new Set(["UC1", "UC2", "UC3", "UC8", "UC9"]);
const PERIODS = [["all", "Since you started"], ["today", "Today"], ["week", "Last 7 days"]];
const fromOf = (p) => { const d = new Date(); if (p === "today") { d.setHours(0, 0, 0, 0); return d; } if (p === "week") return new Date(Date.now() - 7 * 864e5); return null; };
const valOf = (f, inputs) => { const i = impactOf(f, inputs); return i.cash + i.saved + i.protect; };
const fmtDay = (d) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const pct = (x) => (Number.isFinite(x) ? `${(Math.round(x * 10) / 10).toFixed(1)}%` : "—");
const sg = (x) => `${x < 0 ? "−" : "+"}${inr(Math.abs(x), true)}`;

function Kpi({ tag, label, now, after, chg, cls, t }) {
  return (
    <div className={`fx-kpi2 ${cls || ""}`} data-tip={t}>
      <div className="ktag"><b>{tag}</b>{label}</div>
      <div className="now num">{now ?? <span className="na">Data not available</span>}</div>
      <div className="aft num">{after != null ? `→ ${after}` : ""}{chg ? <i>{chg}</i> : null}</div>
    </div>
  );
}

function HBars({ rows, color, max, title }) {
  const mx = max || Math.max(1, ...rows.map((r) => r.v));
  if (!rows.length) return <span className="fx-na">Nothing to show</span>;
  return (
    <div className="fx-hb">{rows.map((r) => (
      <div key={r.k} className="r" data-tip={tip(r.k, r.tt || [[title, inr(r.v, true), color]])}>
        <span className="nm">{r.k}</span>
        <span className="tr"><span className="fl" style={{ width: `${((r.v / mx) * 100).toFixed(1)}%`, background: color }} /></span>
        <span className="v num">{r.t || inr(r.v, true)}</span>
      </div>
    ))}</div>
  );
}

// The workflow for this check, built from the prepared actions (type, automation, follow-up days, closure) and its playbook.
function Flow({ uc, fs }) {
  const groups = {};
  for (const f of fs) (groups[f.type || "other"] = groups[f.type || "other"] || []).push(f);
  const pb = playbooks[uc];
  if (!fs.length) return <div className="fx-hint">No actions have been prepared for this area yet. The steps appear once the first finding is raised.</div>;
  return (
    <div className="fx-flow2">
      {Object.entries(groups).map(([t, xs]) => {
        const f = xs[0], party = PARTY_TYPES.has(t) && !/internal/i.test(f.label || ""), who = CUSTOMER_UC.has(uc) ? "customer" : "supplier";
        const fu = Number(f.followup) || 0, info = /\(internal\)|note \(internal\)/i.test(f.label || "") && !fu;
        return (
          <div key={t} className="grp">
            <div className="gh"><b>{f.label || f.action}</b>
              <span>{party ? `Messages to the ${who}` : `Internal - to the ${String(f.owner || "finance team").replace(/_/g, " ")}`} · {xs.length} {xs.length === 1 ? "party" : "parties"}{fu ? ` · follow-up after ${fu} days` : ""}</span></div>
            <ol>
              <li><div className="t">FlowIQ prepares the {party ? "message" : "note"} - you approve it</div>
                <div className="m">{f.action}. Nothing is sent until you approve it in the Action Hub. <b>{f.automation}</b>.</div></li>
              {uc && pb?.steps?.length > 0 && t === Object.keys(groups)[0] && (
                <li><div className="t">Checked before it is sent</div>
                  <div className="tones">{pb.steps.map((s, i) => <span key={i}>{s}</span>)}</div></li>
              )}
              <li><div className="t">After approval</div><div className="m">{f.after}.</div></li>
              {fu > 0 && (
                <li><div className="t">Follow-up - day {fu}</div>
                  <div className="m">If there is no reply and nothing in Tally <b>{fu} day{fu === 1 ? "" : "s"}</b> after the {party ? "message" : "note"}, a reminder is drafted for your approval.</div></li>
              )}
              <li className="end"><div className="t">Closed automatically</div>
                <div className="m">{f.closure || pb?.verify || "When the correction or decision shows in Tally"}. Closed items leave the follow-up list and count in the Impact report.</div></li>
            </ol>
            {!info && (
              <>
                <div className="m" style={{ marginTop: 4, fontWeight: 700 }}>At every step FlowIQ checks replies and Tally:</div>
                {party ? (
                  <div className="out">
                    <div><b>No reply</b>The next reminder is drafted on schedule; after the last one, the escalation.</div>
                    <div><b>{who === "customer" ? "Pays in full" : "Sends the credit note"}</b>Seen in Tally at the next sync - closed, no more reminders.</div>
                    <div><b>{who === "customer" ? "Pays part" : "Corrects part"}</b>Reminders continue for the balance only, with the new amount.</div>
                    <div><b>Promises a date</b>Reminders pause until that date + 1 day; if nothing arrives, a "promise not kept" message is drafted.</div>
                    <div><b>Says already done</b>FlowIQ waits 3 days for the entry in Tally, then reminds.</div>
                    <div><b>Disputes or asks a question</b>Reminders stop; the reply comes to you to decide the next step.</div>
                  </div>
                ) : (
                  <div className="out">
                    <div><b>No response</b>The next reminder is drafted on schedule; after the last one, the escalation.</div>
                    <div><b>Decision recorded</b>No more reminders; FlowIQ waits for the correction to show in Tally and then closes it.</div>
                    <div><b>Commits to a date</b>Reminders pause until that date + 1 day.</div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
      <p className="fx-hint">Set in the Rulesheet (Settings → Follow-up rules). Changing a gap, tone or escalation there changes these steps.</p>
    </div>
  );
}

export default function Area({ state, list, now, base, area, uc, setUc, onHub }) {
  const [mode, setMode] = useState("actual");
  const [period, setPeriod] = useState("all");
  const [off, setOff] = useState({});        // checks switched off from the totals (forecast)
  const ucs = ((AREAS || []).find((a) => a[0] === area)?.[2]) || [];
  const withItems = ucs.filter((k) => list.some((f) => f.uc === k));
  const cur = ucs.includes(uc) ? uc : (withItems[0] || ucs[0]);
  const on = (k) => !off[k];
  const fs = list.filter((f) => f.uc === cur);
  const isDone = (f) => !!state.approved[f.id];
  const amt = (xs) => xs.reduce((t, f) => t + (Number(f.amount) || 0), 0);
  const today = new Date();
  const dec = cur === "UC5";
  const K = now.kpi;

  // ----- results so far: position at the start of the period vs now
  const from = fromOf(period);
  const before = (f) => !!state.approved[f.id] && from && new Date(state.approved[f.id]) < from;   // approved before the period
  const openB = fs.filter((f) => !before(f)), openA = fs.filter((f) => !isDone(f));
  const inP = fs.filter((f) => isDone(f) && !before(f));
  const ach = inP.reduce((t, f) => t + valOf(f, state.inputs), 0);
  const risk = fs.length > 0 && fs.every((f) => f.kind === "protect");
  const apprB = Object.fromEntries(Object.entries(state.approved).filter(([id]) => !from || new Date(state.approved[id]) < from));
  const KB = compute({ ...state, approved: apprB }).kpi;
  const fromLbl = from ? fmtDay(from) : "when you started", toLbl = fmtDay(today);

  // ----- forecast: now vs every open action in this check approved
  const projApproved = { ...state.approved };
  if (on(cur)) for (const f of fs) if (!projApproved[f.id]) projApproved[f.id] = "projected";
  const P = compute({ ...state, approved: projApproved });
  const KP = P.kpi;

  const kpis = [], rowsB = [], rowsA = [];
  let btitle = "", atitle = "", btot = "", atot = "", bmax = 1;
  if (mode === "actual") {
    const ttf = (t, a, b, f) => tip(t, [[`At ${fromLbl}`, f(a), BEF], [`On ${toLbl}`, f(b), AFT]]);
    const chg = (a, b, good, f) => { const d = b - a; if (!d) return "no change"; return `${d < 0 ? "−" : "+"}${f(Math.abs(d))}${good ? (d * good > 0 ? " better" : " worse") : ""}`; };
    kpis.push(<Kpi key="o" tag="Open" label="issues" now={String(openB.length)} after={String(openA.length)} chg={chg(openB.length, openA.length, -1, String)} t={ttf("Open issues", openB.length, openA.length, String)} />);
    kpis.push(<Kpi key="s" tag="At stake" label="money" now={inr(amt(openB), true)} after={inr(amt(openA), true)} chg={chg(amt(openB), amt(openA), -1, (v) => inr(v, true))} t={ttf("Money at stake", amt(openB), amt(openA), (v) => inr(v, true))} />);
    kpis.push(risk ? <Kpi key="a" tag="Less at risk" label="in this period" now={inr(Math.max(0, amt(openB) - amt(openA)), true)} t={tip("Money no longer at risk", [[`At ${fromLbl}`, inr(amt(openB), true), BEF], [`On ${toLbl}`, inr(amt(openA), true), AFT]])} />
      : <Kpi key="a" tag="Achieved" label="in this period" now={inr(ach, true)} t={tip("Achieved: cash in, cost saved, risk stopped", [["In this period", inr(ach, true), AFT]])} />);
    kpis.push(<Kpi key="r" tag="Resolved" label="in this period" now={String(inP.length)} />);
    const rows = [{ k: "Money at stake", b: amt(openB), a: amt(openA) }];
    if (!risk) rows.push({ k: "Expected impact", b: openB.reduce((t, f) => t + valOf(f, state.inputs), 0), a: openA.reduce((t, f) => t + valOf(f, state.inputs), 0) });
    if (cur === "UC1") rows.push({ k: "Overdue receivables", b: KB.overdue, a: K.overdue }, { k: "Overdue more than 60 days", b: KB.over60, a: K.over60 });
    const mx = Math.max(1, ...rows.flatMap((r) => [r.b, r.a]));
    const T2 = (r) => [[`At ${fromLbl}`, inr(r.b, true), BEF], [`On ${toLbl}`, inr(r.a, true), AFT], ["Change", sg(r.a - r.b)]];
    rows.forEach((r) => { rowsB.push({ k: r.k, v: r.b, tt: T2(r) }); rowsA.push({ k: r.k, v: r.a, tt: T2(r) }); });
    btitle = `Before · ${from ? fmtDay(from) : "when you started"}`; btot = `${openB.length} open`;
    atitle = `After · ${toLbl}`; atot = `${openA.length} open · ${risk ? (amt(openB) - amt(openA) > 0 ? `${inr(amt(openB) - amt(openA))} less at risk` : "no change in risk") : `${inr(ach)} achieved`}`;
    bmax = mx;
  } else {
    const B = now, T = (t, a, b, f) => tip(t, [["Today", f(a), BEF], ["After (projected)", f(b), AFT]]);
    if (cur === "UC1") {
      const nd = (r) => { const tot = r.ageing.reduce((s, b) => s + b.amount, 0), n = r.ageing.find((b) => b.bucket === "Not due")?.amount || 0; return tot ? (n / tot) * 100 : NaN; };
      const coll = Math.max(0, K.receivables - KP.receivables);
      kpis.push(<Kpi key="d" cls="hk" tag="Days" label="to collect" now={days(K.dso)} after={days(KP.dso)} chg={on(cur) ? `−${(K.dso - KP.dso).toFixed(1)} days` : ""} t={T("Average days to collect payment", K.dso, KP.dso, days)} />);
      kpis.push(<Kpi key="o" tag="Overdue" label="amount" now={inr(K.overdue, true)} after={inr(KP.overdue, true)} chg={on(cur) ? `−${inr(K.overdue - KP.overdue, true)}` : ""} t={T("Overdue amount", K.overdue, KP.overdue, (v) => inr(v, true))} />);
      kpis.push(<Kpi key="n" tag="Not due" label="share" now={pct(nd(B))} after={pct(nd(P))} chg={on(cur) ? `+${(nd(P) - nd(B)).toFixed(1)} points` : ""} t={T("Share of receivables not yet due", nd(B), nd(P), pct)} />);
      kpis.push(<Kpi key="c" tag="Collected" label="projected" now={inr(K.receivables < base.kpi.receivables ? base.kpi.receivables - K.receivables : 0, true)} after={inr(base.kpi.receivables - KP.receivables, true)} t={tip("Money collected from overdue customers", [["So far", inr(base.kpi.receivables - K.receivables, true), BEF], ["Projected", inr(coll, true), AFT]])} />);
      const mxA = Math.max(1, ...now.ageing.map((b) => b.amount));
      now.ageing.filter((b) => b.bucket !== "Not due").forEach((b) => {
        const a = P.ageing.find((x) => x.bucket === b.bucket)?.amount || 0, k = `${b.bucket} days late`;
        const tt = [["Today", inr(b.amount, true), BEF], ["After (projected)", inr(a, true), AFT], ["Change", sg(a - b.amount)]];
        rowsB.push({ k, v: b.amount, tt }); rowsA.push({ k, v: a, tt });
      });
      btitle = "Overdue today"; atitle = "Overdue after collections";
      btot = inr(K.overdue, true); atot = inr(KP.overdue, true);
      bmax = mxA;
    } else if (dec) {
      const e = fs.filter((f) => !isDone(f));
      kpis.push(<Kpi key="p" cls="dec" tag="Paid" label="early or late" now={inr(amt(e), true)} after="needs a decision" />);
      kpis.push(<Kpi key="b" tag="Bills" label="affected" now={String(e.length)} />);
      kpis.push(<Kpi key="d" tag="Up to" label="days" now={`${Math.max(0, ...e.map((f) => Number(f.days) || 0))} days`} />);
      kpis.push(<Kpi key="s" tag="Suppliers" label="affected" now={String(new Set(e.map((f) => f.party)).size)} />);
      e.forEach((f) => rowsB.push({ k: f.party, v: Number(f.amount) || 0, tt: [["Amount", inr(f.amount, true), BEF], ["Days", String(f.days || "?")]] }));
      btitle = "Paid before or after the due date"; btot = inr(amt(e), true);
      bmax = Math.max(1, ...rowsB.map((r) => r.v));
    } else {
      const open = fs.filter((f) => !isDone(f)), byParty = {};
      for (const f of open) byParty[f.party] = (byParty[f.party] || 0) + (Number(f.amount) || 0);
      const rows = Object.entries(byParty).map(([k, v]) => ({ k, b: v, a: on(cur) ? 0 : v })).sort((x, y) => y.b - x.b);
      const tb = rows.reduce((s, r) => s + r.b, 0), ta = rows.reduce((s, r) => s + r.a, 0);
      const benefit = on(cur) ? open.reduce((t, f) => t + valOf(f, state.inputs), 0) : 0;
      const lbl = { UC2: ["Above", "credit limits", "Amount above limits"], UC3: ["At risk", "new invoices", "Owed on new invoices to late payers"], UC4: ["Entered", "twice", "Amount entered twice"],
        UC6: ["At risk", "GST credit", "GST credit at risk"], UC7: ["Excess", "billed", "Billed above PO / receipt"], UC8: ["Blocked", "invoices", "Invoice value at risk of rejection"] }[cur] || ["At stake", "amount", "Amount at stake"];
      kpis.push(<Kpi key="s" tag={lbl[0]} label={lbl[1]} now={inr(tb, true)} after={inr(ta, true)} chg={tb - ta > 0 ? `−${inr(tb - ta, true)}` : "no change"} />);
      kpis.push(<Kpi key="b" tag="Benefit" label="projected" now={inr(benefit, true)} t={tip("Projected benefit", [["Amount", inr(benefit, true), AFT]])} />);
      kpis.push(<Kpi key="i" tag="Items" label="found" now={String(fs.length)} />);
      kpis.push(<Kpi key="a" tag="Achieved" label="so far" now={inr(fs.filter(isDone).reduce((t, f) => t + valOf(f, state.inputs), 0), true)} />);
      const mx = Math.max(1, ...rows.map((r) => r.b));
      rows.forEach((r) => { const tt = [["Today", inr(r.b, true), BEF], ["After (projected)", inr(r.a, true), AFT], ["Change", sg(r.a - r.b)]]; rowsB.push({ k: r.k, v: r.b, tt }); rowsA.push({ k: r.k, v: r.a, tt }); });
      btitle = `${lbl[2]} today`; atitle = "Remaining after the actions"; btot = inr(tb, true); atot = inr(ta, true);
      bmax = mx;
    }
  }

  const pills = mode === "actual"
    ? <><span className="fx-pl2 b">Before · {from ? fmtDay(from) : "start"}</span><span className="fx-pl2 a">After · {toLbl}</span></>
    : dec ? <><span className="fx-pl2 b">Today · Actual</span><span className="fx-pl2 d">After · Needs a decision</span></>
      : <><span className="fx-pl2 b">Today · Actual</span><span className="fx-pl2 a" title="Estimate after the recommended actions. Not money received yet.">After · Projected</span></>;
  const na = UC[cur]?.na;
  const openN = fs.filter((f) => !isDone(f)).length;

  return (
    <div className="fx-cx">
      <section className="fx-card">
        <div className="fx-cxh">
          <span className="fx-cxi" style={{ background: hueOfArea(area) }}><Ic n={UCI[cur] || "grid"} s={18} /></span>
          <div><h2>{ucTitle(cur)}</h2><div className="sub">{areaLabel(area)} · Tally entries up to {fmtDay(new Date(today.getTime() - 864e5))}</div></div>
          <div className="r">{pills}</div>
        </div>
        {na && <div className="fx-ucmiss" role="note"><b>Not checked</b><span>Not applicable to {seedMeta.company}: {na}</span></div>}
        <div className="fx-pbar">
          <div className="fx-seg2" role="group" aria-label="Which figures to show">
            <button aria-pressed={mode === "actual"} onClick={() => setMode("actual")}>Results so far</button>
            <button aria-pressed={mode === "proj"} onClick={() => setMode("proj")}>Forecast</button>
          </div>
          {mode === "actual" && <>{PERIODS.map(([k, l]) => <button key={k} className="fx-chip" aria-pressed={period === k} onClick={() => setPeriod(k)}>{l}</button>)}</>}
          <div className="why">{mode === "actual"
            ? <><b>Results so far:</b> real figures from Tally - your position at the start of the period (before) compared with now (after).</>
            : <><b>Forecast:</b> an estimate of where the figures would land if the open actions succeed. Not money received yet.</>}</div>
        </div>
        <div className="fx-kpis">{kpis}</div>
        <div className="fx-ptabs">
          {ucs.map((k) => {
            const n = list.filter((f) => f.uc === k && !isDone(f)).length;
            return (
              <button key={k} className={`fx-ptab ${on(k) ? "" : "off"}`} aria-pressed={cur === k} onClick={() => setUc(k)}>
                <Ic n={UCI[k] || "grid"} s={15} />{ucTitle(k)}<em className="num">{n}</em>
                {k !== "UC5" && <span className="tg" role="switch" aria-checked={on(k)} aria-label={`Include ${ucTitle(k)} in totals`}
                  onClick={(e) => { e.stopPropagation(); setOff({ ...off, [k]: on(k) }); }} />}
              </button>
            );
          })}
        </div>
      </section>

      <section className="fx-card p2">
        <div className="fx-cxh sm">
          <span className="fx-cxi lt"><Ic n="scale" s={16} /></span>
          <div><h2>Before vs after</h2><div className="sub">{mode === "actual" ? "Actual figures at the start and end of the period" : dec ? "Today vs the decision to make" : "Same scale, side by side"}</div></div>
        </div>
        <div className="body">
          <div className="fx-ba2">
            <div className="side b"><div className="sh"><b>{btitle}</b><span className="tot num">{btot}</span></div><HBars rows={rowsB} color={BEF} max={bmax} title="Before" /></div>
            {dec && mode !== "actual" ? (
              <div className="side d"><div className="sh"><b>After · decided by the finance head</b><span className="fx-pl2 d">Needs a decision</span></div>
                <div className="fx-opts2">
                  <div className="opt2"><b>Ask for an early-payment discount</b>Keep paying early only for a discount</div>
                  <div className="opt2"><b>Pay on the due date</b>Cash stays in the bank longer</div>
                  <div className="opt2"><b>Keep paying early on purpose</b>No cash change · reason recorded</div>
                </div></div>
            ) : (
              <div className="side a"><div className="sh"><b>{atitle}</b><span className="tot num">{atot}</span></div><HBars rows={rowsA} color={AFT} max={bmax} title="After" /></div>
            )}
          </div>
          {mode === "actual" && !fs.length && <p className="fx-hint">No issues in this area in this period.</p>}
          {mode === "actual" && risk && fs.length > 0 && <p className="fx-hint">This area guards against risk, so its result is the money no longer at risk, not money recovered. Any cash collected from these parties is counted once, in the area that chased it.</p>}
        </div>
      </section>

      <section className="fx-card p2">
        <div className="fx-cxh sm">
          <span className="fx-cxi lt"><Ic n="checkc" s={16} /></span>
          <div><h2>Actions</h2><div className="sub">How FlowIQ acts on this area - the steps, timing and tone set in the Rulesheet</div></div>
          {openN > 0 && <div className="r"><button className="fx-btn pri sm" onClick={() => onHub(cur)}>Review {openN} in the Action Hub →</button></div>}
        </div>
        <div className="body"><Flow uc={cur} fs={fs} /></div>
      </section>
    </div>
  );
}
