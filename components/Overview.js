"use client";
import { AREAS, UC, impactOf, inr, notDueShare, scorecard, seedFull, sevLabel, topOpen, findingsOf } from "@/lib/engine";
import { TrendChart } from "@/components/Charts";
import { Columns, Donut, Frame, PAL, Prog, SegBar } from "@/components/Viz";
import Icon from "@/components/Icon";

const days = (n) => `${Number(n).toFixed(1)} days`;
const AGE_COL = { "1-30": "#1a9e6e", "31-60": "#c9940a", "61-90": "#f08c2e", "91-180": "#e5484d", "180+": "#a3262b" };
const SEV = [["critical", "Critical", "#e5484d"], ["high", "High", "#f08c2e"], ["medium", "Medium", "#c9940a"], ["low", "Low", "#2f6bff"]];

function Delta({ v, good, fmt }) {
  if (Math.abs(v) < 0.05) return <span className="delta flat">No change yet</span>;
  const up = v * good > 0;
  return <span className={`delta ${up ? "up" : "down"}`}>{v > 0 ? "+" : "−"}{fmt ? fmt(Math.abs(v)) : inr(Math.abs(v))} <em>since you started</em></span>;
}

export default function Overview({ state, now, base, proj, onOpen, onPickUc, flash = {} }) {
  const K = now.kpi, B = base.kpi, P = proj.kpi;
  const all = findingsOf(state);
  const pos = seedFull.position;

  // At stake, split by what approving does (all open items).
  const open = all.filter((f) => !state.approved[f.id]);
  const by = { cash: 0, saved: 0, protect: 0 };
  for (const f of open) { const i = impactOf(f, state.inputs); by.cash += i.cash; by.saved += i.saved; by.protect += i.protect; }
  const byT = by.cash + by.saved + by.protect || 1;
  const startTotal = B.atStake || 1;
  const pctDone = ((B.atStake - K.atStake) / startTotal) * 100;

  const overdueParts = now.ageing.filter((b) => b.bucket !== "Not due").map((b) => ({ k: b.bucket, v: b.amount, c: AGE_COL[b.bucket] || "#5b8cff" }));
  const notDue = now.ageing.find((b) => b.bucket === "Not due")?.amount || 0;

  const cols = AREAS
    ? AREAS.map(([, label, ucs]) => {
        const xs = now.areas.filter((a) => ucs.includes(a.uc));
        return { name: label, uc: ucs[0], start: xs.reduce((t, a) => t + a.open + a.resolved, 0), open: xs.reduce((t, a) => t + a.open, 0),
          count: xs.reduce((t, a) => t + a.count, 0), done: xs.reduce((t, a) => t + a.count - a.openCount, 0) };
      }).map((d, i) => ({ ...d, color: PAL[i % PAL.length] }))
    : now.areas.map((a, i) => ({ name: UC[a.uc].short, uc: a.uc, start: a.open + a.resolved, open: a.open, count: a.count, done: a.count - a.openCount, color: PAL[i % PAL.length] }));

  const sevStats = SEV.map(([k, l, c]) => {
    const fs = all.filter((f) => f.severity === k);
    return { k, l, c, total: fs.length, done: fs.filter((f) => state.approved[f.id]).length };
  }).filter((s) => s.total);

  const sc = scorecard(state, now);
  const top = topOpen(state, 5);
  const maxPos = Math.max(K.receivables, pos.payables || 0, K.cash, Math.abs(pos.working_capital || 0), 1);

  return (
    <div className="ov">
      <div className="ov-row3">
        <Frame icon={<Icon name="alert" />} label="At stake" tone="red" flash={flash.atStake} right={<span className="frame-r">{K.total - K.done} open</span>}>
          <div className="mc">
            <div className="mc-main">
              <div className="mc-v num">{inr(K.atStake)}</div>
              <Delta v={K.atStake - B.atStake} good={-1} />
              <ul className="mc-list">
                <li><i style={{ background: "#1a9e6e" }} />Cash to collect<b className="num">{Math.round((by.cash / byT) * 100)}%</b></li>
                <li><i style={{ background: "#2f6bff" }} />Cost to save<b className="num">{Math.round((by.saved / byT) * 100)}%</b></li>
                <li><i style={{ background: "#7a5af0" }} />Risk to stop<b className="num">{Math.round((by.protect / byT) * 100)}%</b></li>
              </ul>
            </div>
            <Donut pct={pctDone} label="actioned" />
          </div>
          <div className="mc-foot"><span><Icon name="bolt" size={14} />{inr(B.atStake)} found across {UC ? Object.keys(UC).length : 0} checks</span></div>
        </Frame>

        <Frame icon={<Icon name="clock" />} label="Days to collect" tone="orange" flash={flash.dso || flash.overdue} right={<span className="frame-r">Books to {seedFull.asOf}</span>}>
          <div className="mc-v num">{days(K.dso)}</div>
          <Delta v={K.dso - B.dso} good={-1} fmt={(x) => `${x.toFixed(1)} days`} />
          <div className="mc-sub">Overdue <b className="num">{inr(K.overdue)}</b> · not yet due <b className="num">{inr(notDue)}</b></div>
          <SegBar parts={overdueParts} />
          <div className="mc-foot"><span><Icon name="trend" size={14} />{days(P.dso)} and {notDueShare(proj.ageing).toFixed(0)}% not due if every action is approved</span></div>
        </Frame>

        <Frame icon={<Icon name="wallet" />} label="Cash position" tone="green" flash={flash.cash || flash.value} right={<span className="frame-r">From Tally</span>}>
          <div className="mc-v num">{inr(K.cash)}</div>
          <Delta v={K.cash - B.cash} good={1} />
          <div className="mc-bars">
            <Prog label="Receivables" value={K.receivables} max={maxPos} color="#2f6bff" right={inr(K.receivables)} />
            <Prog label="Payables" value={pos.payables || 0} max={maxPos} color="#f08c2e" right={inr(pos.payables || 0)} />
            <Prog label="Working capital" value={Math.abs(pos.working_capital || 0)} max={maxPos} color="#7a5af0" right={inr(pos.working_capital || 0)} />
          </div>
          <div className="mc-foot"><span><Icon name="shield" size={14} />{inr(K.value)} saved or risk stopped so far</span></div>
        </Frame>
      </div>

      <div className="ov-row2">
        <Frame icon={<Icon name="chart" />} label="Money at stake by area" tone="blue" className="grow"
          right={<span className="legend2"><span><i className="lg-ghost" />Faded: at start</span><span><i className="lg-bar" />Solid: open now</span></span>}>
          <div className="ch-head">
            <div><b>{seedFull.company}</b><span>{Object.keys(UC).length} checks · click a bar to open it in the Action Hub</span></div>
            <span className="pill">{inr(K.atStake)} open of {inr(B.atStake)}</span>
          </div>
          <Columns data={cols} onPick={(d) => onPickUc?.(d.uc)} />
        </Frame>

        <Frame icon={<Icon name="check" />} label="Approvals" tone="violet" flash={flash.done} className="side">
          <div className="ap-top">
            <span className="ap-ic"><Icon name="layers" size={18} /></span>
            <div><b>{K.done} of {K.total}</b><span>actions approved</span></div>
          </div>
          <div className="mc-v num">{inr(B.atStake - K.atStake)}</div>
          <span className="delta flat">actioned so far</span>
          <div className="mc-bars">
            {sevStats.map((s) => <Prog key={s.k} label={s.l} value={s.done} max={s.total} color={s.c} right={`${s.done}/${s.total}`} />)}
          </div>
          <div className="mc-foot"><span><Icon name="bolt" size={14} />Highest first: {sevStats[0] ? `${sevStats[0].total - sevStats[0].done} ${sevStats[0].l.toLowerCase()} left` : "all clear"}</span></div>
        </Frame>
      </div>

      <Frame icon={<Icon name="table" />} label="Control scorecard" tone="blue" right={<span className="frame-r">Updates as you approve</span>}>
        <div className="tw">
          <table className="dt sc">
            <thead><tr><th>Check</th><th className="r">Open</th><th className="r">At stake</th><th>Severity</th><th>Decision needed</th><th>Owner</th></tr></thead>
            <tbody>
              {sc.map((r) => (
                <tr key={r.uc} className="click" onClick={() => onPickUc?.(r.uc)}>
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
      </Frame>

      <div className="ov-row2">
        <Frame icon={<Icon name="bolt" />} label="Act on these first" tone="red" className="grow" right={<span className="frame-r">Highest severity, then amount</span>}>
          <div className="first">
            {top.length === 0 && <p className="muted">Everything is approved.</p>}
            {top.map((f) => (
              <button key={f.id} className="first-row" onClick={() => onOpen(f)}>
                <span className={`dotsev ${f.severity}`} />
                <span className="first-m"><b>{f.party}</b><em>{UC[f.uc]?.short} · {f.label || f.action}</em></span>
                <span className="first-a num">{inr(f.amount, true)}</span>
                <span className="first-go">Review <Icon name="right" size={14} /></span>
              </button>
            ))}
          </div>
        </Frame>
        <Frame icon={<Icon name="building" />} label="Financial position" tone="teal" className="side" right={<span className="frame-r">{pos.days} days</span>}>
          <dl className="fpl">
            {[
              ["Revenue (period)", inr(pos.revenue)], ["Receivables", inr(K.receivables)], ["Payables", inr(pos.payables)],
              ["Working capital", inr(pos.working_capital)], ["Duties & taxes (net)", inr(pos.duties_taxes_net)],
              [`DSO (${pos.days}-day period)`, days(pos.dso)], ["DPO", days(pos.dpo)], ["Cash cycle", days(pos.ccc)],
            ].map(([l, v]) => <div key={l}><dt>{l}</dt><dd className="num">{v}</dd></div>)}
          </dl>
        </Frame>
      </div>

      <div className="ov-grid2">
        <Frame icon={<Icon name="trend" />} label="Sales vs collections" tone="violet"
          right={<span className="legend2"><span><i style={{ background: "#7a5af0" }} />Billed</span><span><i style={{ background: "#1a9e6e" }} />Collected</span></span>}>
          <TrendChart data={seedFull.monthly} a="sales" b="receipts" la="Sales billed" lb="Collected" />
        </Frame>
        <Frame icon={<Icon name="trend" />} label="Purchases vs payments" tone="orange"
          right={<span className="legend2"><span><i style={{ background: "#f08c2e" }} />Purchases</span><span><i style={{ background: "#2f6bff" }} />Paid</span></span>}>
          <TrendChart data={seedFull.monthly} a="purchases" b="payments" la="Purchases" lb="Paid" ca="#f08c2e" cb="#2f6bff" />
        </Frame>
      </div>
    </div>
  );
}
