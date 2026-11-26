"use client";
// The command band: where the money stands, what approving everything would do, and the pipeline.
import { UC, impactOf, findingsOf, inr, seedFull, seedMeta, LB } from "@/lib/engine";
import { Big, areaLabel, areaOf, days, tip } from "./ui";

// How far "now" has moved from the start towards the position if every action were approved.
function Track({ start, now, proj }) {
  const span = proj - start;
  const pct = Math.abs(span) < 1e-9 ? 0 : Math.max(0, Math.min(100, ((now - start) / span) * 100));
  return <span className="fx-trk"><i style={{ width: `${Math.max(pct ? 3 : 0, pct)}%` }} /></span>;
}

export default function Hero({ state, now, base, proj, flash = {}, showFlow, onGo, scope = {} }) {
  const K = now.kpi, B = base.kpi, P = proj.kpi;
  const all = findingsOf(state);
  // Scope: the whole company, one business area, or one check. Every figure in the band follows it.
  const inScope = (f) => (scope.uc ? f.uc === scope.uc : scope.area ? areaOf(f.uc) === scope.area : true);
  const fs = all.filter(inScope);
  const isOpen = (f) => !state.approved[f.id];
  const amt = (xs) => xs.reduce((t, f) => t + (Number(f.amount) || 0), 0);
  const open = fs.filter(isOpen), done = fs.filter((f) => !isOpen(f));
  const scoped = !!(scope.area || scope.uc);
  const label = scope.uc ? UC[scope.uc]?.short : scope.area ? areaLabel(scope.area) : seedMeta.company;
  const by = { cash: 0, saved: 0, protect: 0 };
  for (const f of open) { const i = impactOf(f, state.inputs); by.cash += i.cash; by.saved += i.saved; by.protect += i.protect; }
  const byT = by.cash + by.saved + by.protect || 1;
  const found = amt(fs), openAmt = amt(open), actioned = Math.max(0, found - openAmt), ob = Math.max(found, 1), pc = (x) => Math.round((x / ob) * 100);
  let released = 0; for (const f of done) { const i = impactOf(f, state.inputs); released += i.cash + i.saved + i.protect; }
  const openN = open.length, doneN = done.length, total = fs.length;
  const recArea = !scoped || (scope.uc ? areaOf(scope.uc) === areaOf("UC1") : scope.area === areaOf("UC1"));
  const sevOrder = ["critical", "high", "medium", "low"];
  const topSev = sevOrder.find((s) => open.some((f) => f.severity === s));
  const biggest = open.slice().sort((x, y) => y.amount - x.amount)[0];
  const checks = scope.uc ? 1 : new Set(fs.map((f) => f.uc)).size;
  const sync = seedFull.sync || {};
  // Date only: the last sync shows today's date.
  const today = new Date();
  const dd = (d) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const mix = [["Cash to collect", by.cash, "#7CE0B5"], ["Cost to save", by.saved, "#9FB8FF"], ["Risk to stop", by.protect, "#F3C96B"]];
  const delta = (v, good, fmt) => {
    if (Math.abs(v) < 0.05) return <span className="fx-dl">no change yet</span>;
    const up = v * good > 0;
    return <span className={`fx-dl ${up ? "up" : "dn"}`}>{v > 0 ? "+" : "−"}{fmt ? fmt(Math.abs(v)) : inr(Math.abs(v))} since you started</span>;
  };
  const st = (k, v, sub, cls, go) => (
    <button className={`fx-stn ${cls || ""}`} onClick={() => onGo?.(go)}><span className="v num">{v}</span><span className="k">{k}</span><span className="s">{sub}</span></button>
  );
  const bar = (v) => <span className="fx-trk"><i style={{ width: `${Math.max(v ? 3 : 0, Math.min(100, v))}%` }} /></span>;

  return (
    <section className={`fx-hero ${scoped ? "scoped" : ""}`} aria-label="Position">
      <div className="fx-hx">
        <div className="fx-hx-l">
          <div className="fx-hx-k"><span className="fx-live"><i />Live from Tally</span><span>Last sync {dd(today)}</span>
            {scoped && <span className="fx-scope">{scope.uc ? `${areaLabel(areaOf(scope.uc))} · ${UC[scope.uc]?.short}` : `${checks} check${checks === 1 ? "" : "s"} in this area`}</span>}</div>
          <button className={`fx-big ${flash.atStake ? "flash" : ""}`} onClick={() => onGo?.("todo")}>
            <span className="v num"><Big v={openAmt} /></span>
            <span className="t">still at stake {scoped ? <>in <b>{label}</b> </> : ""}across <b>{openN} open issue{openN === 1 ? "" : "s"}</b>{doneN ? <> · <b>{doneN}</b> approved so far</> : " · nothing approved yet"}</span>
          </button>
          {recArea ? (
            <div className="fx-read">
              <div className={`fx-r ${flash.cash ? "flash" : ""}`}>
                <span className="l">Cash & bank</span><span className="v num">{inr(K.cash)}</span>{delta(K.cash - B.cash, 1)}
                <Track start={B.cash} now={K.cash} proj={P.cash} /><span className="p">→ {inr(P.cash)} if all approved</span>
              </div>
              <div className={`fx-r ${flash.dso ? "flash" : ""}`}>
                <span className="l">Days sales outstanding</span><span className="v num">{days(K.dso)}</span>{delta(K.dso - B.dso, -1, (x) => `${x.toFixed(1)} days`)}
                <Track start={B.dso} now={K.dso} proj={P.dso} /><span className="p">→ {days(P.dso)} if all approved</span>
              </div>
              <div className={`fx-r ${flash.overdue ? "flash" : ""}`}>
                <span className="l">{LB("overdue", "Overdue from customers")}</span><span className="v num">{inr(K.overdue)}</span>{delta(K.overdue - B.overdue, -1)}
                <Track start={B.overdue} now={K.overdue} proj={P.overdue} /><span className="p">→ {inr(P.overdue)} if all approved</span>
              </div>
            </div>
          ) : (
            <div className="fx-read">
              <div className="fx-r">
                <span className="l">Issues found</span><span className="v num">{total}</span><span className="fx-dl">{inr(found)} across {checks} check{checks === 1 ? "" : "s"}</span>
                {bar(total ? (openN / total) * 100 : 0)}<span className="p">{openN} still open</span>
              </div>
              <div className={`fx-r ${flash.value ? "flash" : ""}`}>
                <span className="l">Achieved</span><span className="v num">{inr(released)}</span><span className={`fx-dl ${released ? "up" : ""}`}>{doneN ? `from ${doneN} approval${doneN === 1 ? "" : "s"}` : "no change yet"}</span>
                {bar(pc(actioned))}<span className="p">{pc(actioned)}% of {label} approved</span>
              </div>
              <div className="fx-r">
                <span className="l">Largest open item</span><span className="v num">{biggest ? inr(biggest.amount) : "—"}</span><span className="fx-dl">{biggest ? biggest.party : "nothing open"}</span>
                {bar(biggest ? (biggest.amount / ob) * 100 : 0)}<span className="p">{topSev ? `most severe: ${topSev}` : "all clear"}</span>
              </div>
            </div>
          )}
        </div>

        <div className="fx-rib">
          <h3>From finding to impact <span>{label}</span></h3>
          {[["Found", found, ""], ["Approved", actioned, "act"], ["Still open", openAmt, "opn"]].map(([l, v, k]) => (
            <div key={l} className={`fx-rb ${k}`} data-tip={tip(l, [[l, inr(v, true)], ["Share of found", pc(v) + "%"]])}>
              <span>{l}</span><span className="fx-rbt"><i style={{ width: `${Math.max(v ? 1.5 : 0, (v / ob) * 100).toFixed(1)}%` }} /></span><b className="num">{inr(v)}</b>
            </div>
          ))}
          <div className="fx-mixw">
            <span className="fx-mixh">What the open issues are worth</span>
            <div className="fx-mix">{mix.map(([l, v, c]) => v > 0 && <i key={l} style={{ width: `${(v / byT) * 100}%`, background: c }} data-tip={tip(l, [["Amount", inr(v, true), c], ["Share", Math.round((v / byT) * 100) + "%"]])} />)}</div>
            <div className="fx-mixl">{mix.map(([l, v, c]) => <span key={l}><i style={{ background: c }} />{l} {Math.round((v / byT) * 100)}%</span>)}</div>
          </div>
          <div className="fx-rbf"><span><b>{pc(actioned)}%</b> approved</span><span><b>{inr(released)}</b> saved & risk stopped</span></div>
        </div>
      </div>

      {showFlow && (
        <div className="fx-flow">
          {st("Synced from Tally", "Today", sync.vouchers ? `${Number(sync.vouchers).toLocaleString("en-IN")} vouchers read` : "read-only", "done", "overview")}
          {st("Issues found", total, `${inr(found)} at the start`, "", "all")}
          {st("Needs your approval", openN, `${inr(openAmt)} at stake`, "you", "todo")}
          {st("Approved", doneN, `${inr(actioned)} actioned`, doneN ? "done" : "", "done")}
          {st("Impact so far", inr(Math.max(0, released)), "cash in, cost saved, risk stopped", released > 0 ? "done" : "", "impact")}
        </div>
      )}
    </section>
  );
}
