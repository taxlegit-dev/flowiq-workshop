"use client";
import { UC, inr, notDueShare, scorecard, seedFull, sevLabel, topOpen } from "@/lib/engine";
import { AgeingChart, BeforeAfterChart, TrendChart } from "@/components/Charts";

const days = (n) => `${Number(n).toFixed(1)} days`;

export default function Overview({ state, now, base, proj, onOpen }) {
  const K = now.kpi, P = proj.kpi;
  const benefit = proj.tot.cash + proj.tot.saved + proj.tot.protect;
  const pos = seedFull.position;
  const cockpit = [
    { l: "Days to collect", v: days(K.dso), to: days(P.dso), d: `−${Math.abs(P.dso - K.dso).toFixed(1)} days` },
    { l: "Overdue amount", v: inr(K.overdue, true), to: inr(P.overdue, true), d: `−${inr(K.overdue - P.overdue)}` },
    { l: "Not-due share", v: `${notDueShare(now.ageing).toFixed(1)}%`, to: `${notDueShare(proj.ageing).toFixed(1)}%`, d: `+${(notDueShare(proj.ageing) - notDueShare(now.ageing)).toFixed(1)} points` },
    { l: "Benefit if all approved", v: inr(benefit, true), sub: `${inr(proj.tot.cash)} cash · ${inr(proj.tot.saved)} saved · ${inr(proj.tot.protect)} risk stopped` },
  ];
  const ba = now.areas.map((a) => ({ name: UC[a.uc].short, start: a.open + a.resolved, open: a.open }));
  const sc = scorecard(state, now);
  const top = topOpen(state, 5);

  return (
    <>
      <section className="card">
        <div className="hd"><h3>{seedFull.company} · Collections cockpit</h3><span className="hint">Now → if you approve everything</span></div>
        <div className="cockpit">
          {cockpit.map((c) => (
            <div key={c.l} className="ck">
              <div className="l">{c.l}</div>
              <div className="v num">{c.v}</div>
              {c.to ? <div className="to num">→ {c.to} <span>{c.d}</span></div> : <div className="to muted">{c.sub}</div>}
            </div>
          ))}
        </div>
      </section>

      <section className="grid2">
        <div className="card">
          <div className="hd"><h3>Before vs after, by area</h3>
            <span className="legend"><span><i style={{ background: "#b9c0ba" }} />At start</span><span><i style={{ background: "var(--open)" }} />Open now</span></span></div>
          <BeforeAfterChart data={ba} />
        </div>
        <div className="card">
          <div className="hd"><h3>Customer dues by days overdue</h3><span className="hint">Not yet due: {inr(now.ageing.find((b) => b.bucket === "Not due")?.amount)}</span></div>
          <AgeingChart data={now.ageing.filter((b) => b.bucket !== "Not due")} maxY={Math.max(...base.ageing.filter((b) => b.bucket !== "Not due").map((b) => b.amount), 1) * 1.08} />
        </div>
      </section>

      <section className="card">
        <div className="hd"><h3>Control scorecard</h3><span className="hint">One row per check · updates as you approve</span></div>
        <div className="tw">
          <table className="dt sc">
            <thead><tr><th>Area</th><th className="r">Open</th><th className="r">At stake</th><th>Severity</th><th>Decision needed</th><th>Owner</th></tr></thead>
            <tbody>
              {sc.map((r) => (
                <tr key={r.uc}>
                  <td><b>{r.name}</b></td>
                  <td className="r num">{r.open} / {r.total}</td>
                  <td className="r num">{inr(r.atStake)}</td>
                  <td><span className={`sevtag ${r.severity || "clear"}`}>{sevLabel(r.severity)}</span></td>
                  <td className="dec">{r.decision}</td>
                  <td className="muted">{r.owner}</td>
                </tr>
              ))}
              <tr className="tot"><td>Total</td><td className="r num">{sc.reduce((s, r) => s + r.open, 0)}</td><td className="r num">{inr(sc.reduce((s, r) => s + r.atStake, 0))}</td><td colSpan={3} /></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="hd"><h3>Act on these first</h3><span className="hint">Highest severity, then amount</span></div>
        <div className="list">
          {top.length === 0 && <p className="muted">Everything is approved.</p>}
          {top.map((f) => (
            <div key={f.id} className="row top5">
              <span className={`sev ${f.severity}`} />
              <div><div className="p">{f.party}</div><div className="a">{UC[f.uc].short} · {f.action}</div></div>
              <div className="r num amtv">{inr(f.amount, true)}</div>
              <div className="acts"><button className="btn sm" onClick={() => onOpen(f)}>Review</button></div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid2">
        <div className="card">
          <div className="hd"><h3>Sales vs collections by month</h3>
            <span className="legend"><span><i style={{ background: "#7a5af0" }} />Sales billed</span><span><i style={{ background: "#1baf7a" }} />Collected</span></span></div>
          <TrendChart data={seedFull.monthly} a="sales" b="receipts" la="Sales billed" lb="Collected" />
        </div>
        <div className="card">
          <div className="hd"><h3>Purchases vs payments by month</h3>
            <span className="legend"><span><i style={{ background: "#7a5af0" }} />Purchases</span><span><i style={{ background: "#1baf7a" }} />Paid</span></span></div>
          <TrendChart data={seedFull.monthly} a="purchases" b="payments" la="Purchases" lb="Paid" />
        </div>
      </section>

      <section className="card">
        <div className="hd"><h3>Financial position</h3><span className="hint">From Tally, {pos.period_from} to {seedFull.asOf} ({pos.days} days)</span></div>
        <div className="fp">
          {[
            ["Revenue (period)", inr(pos.revenue)], ["Receivables", inr(K.receivables)], ["Payables", inr(pos.payables)],
            ["Cash & bank", inr(K.cash)], ["Working capital", inr(pos.working_capital)], ["Duties & taxes (net)", inr(pos.duties_taxes_net)],
            [`DSO (${pos.days}-day period)`, days(pos.dso)], ["DPO", days(pos.dpo)], ["Cash cycle", days(pos.ccc)],
          ].map(([l, v]) => <div key={l}><span>{l}</span><b className="num">{v}</b></div>)}
        </div>
      </section>
    </>
  );
}
