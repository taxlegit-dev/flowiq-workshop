"use client";
// Charts for Financial Overview and Business Impact. SVG drawn from the CFO models; every mark has a hover card (data-tip).
import { inr } from "@/lib/engine";
import { d1, fmtDate, fmtK, p1 } from "@/lib/cfo";
import { tip } from "./ui";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const rs = (v) => (v == null ? "—" : inr(v, true));
const short = (v) => inr(v).replace("₹", "");
const sg = (v) => (v < 0 ? "−" : "") + inr(Math.abs(v), true);

export function Bar({ v, mx, col }) {
  const w = Math.max(v > 0 ? 1.5 : 0, Math.min(100, ((v || 0) / (mx || 1)) * 100));
  return <span className="cf-bar"><i style={{ width: `${w.toFixed(1)}%`, ...(col ? { background: col } : {}) }} /></span>;
}

export function Empty({ children }) { return <div className="fx-empty sm"><span>{children}</span></div>; }

// Billing vs purchases by month + purchases-to-billing line; a running month is hatched.
export function BarsCombo({ M }) {
  if (!M.length) return <Empty>No monthly vouchers in the data.</Empty>;
  const W = 720, H = 250, L = 52, R = 40, T = 16, Bm = 30, n = M.length, bw = (W - L - R) / n;
  const mx = Math.max(1, ...M.flatMap((m) => [m.sales || 0, m.purchase || 0])) * 1.08, Y = (v) => T + (H - T - Bm) * (1 - v / mx);
  const ratio = M.map((m) => (m.sales ? ((m.purchase || 0) / m.sales) * 100 : null)), rmx = Math.max(100, ...ratio.filter((x) => x != null)) * 1.1;
  const YR = (v) => T + (H - T - Bm) * (1 - v / rmx), ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => (mx / 1.08) * f);
  const pts = ratio.map((r, i) => (r == null ? null : [L + i * bw + bw / 2, YR(r)])).filter(Boolean);
  return (
    <svg className="cf-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Billing and purchases by month">
      <defs><pattern id="cfh" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--cf-bill)" opacity=".35" /><line x1="0" y1="0" x2="0" y2="6" stroke="var(--cf-bill)" strokeWidth="3" /></pattern></defs>
      {ticks.map((v, k) => <g key={k}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} className="cf-grid" /><text x={L - 8} y={Y(v) + 4} className="cf-tk" textAnchor="end">{short(v)}</text></g>)}
      {M.map((m, i) => {
        const x = L + i * bw, w = Math.min(26, bw * 0.32), cx = x + bw / 2;
        const t = tip(m.label + (m.partial ? ` (to ${m.daysIn} ${MON[Number(m.period.slice(5, 7)) - 1]})` : ""), [["Billing (incl. GST)", rs(m.sales), "var(--cf-bill)"], ["Purchases (incl. GST)", rs(m.purchase), "var(--cf-buy)"], ["Purchases ÷ billing", p1(ratio[i])], ["Credit notes", rs(m.credit_notes)]]);
        return (
          <g key={m.period} className="cf-hit" data-tip={t}>
            <rect x={x} y={T} width={bw} height={H - T - Bm} fill="transparent" />
            <rect x={cx - w - 2} y={Y(m.sales || 0)} width={w} height={Math.max(0, H - Bm - Y(m.sales || 0))} rx="3" fill={m.partial ? "url(#cfh)" : "var(--cf-bill)"} />
            <rect x={cx + 2} y={Y(m.purchase || 0)} width={w} height={Math.max(0, H - Bm - Y(m.purchase || 0))} rx="3" fill="var(--cf-buy)" opacity={m.partial ? 0.45 : 1} />
            <text x={cx} y={H - 10} className="cf-tk" textAnchor="middle">{m.label.split(" ")[0]}{m.partial ? "*" : ""}</text>
          </g>
        );
      })}
      {pts.length > 1 && <polyline points={pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ")} fill="none" stroke="var(--cf-line)" strokeWidth="2" strokeDasharray="4 3" pointerEvents="none" />}
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="var(--cf-line)" pointerEvents="none" />)}
      <text x={W - R + 6} y={YR(100) + 4} className="cf-tk">100%</text>
      <line x1={L} x2={W - R} y1={YR(100)} y2={YR(100)} stroke="var(--cf-line)" strokeWidth=".6" opacity=".5" />
    </svg>
  );
}

// Receipts above the line, payments below, the month's net as a marker.
export function CashChart({ M }) {
  if (!M.length) return <Empty>No monthly receipts or payments in the data.</Empty>;
  const W = 720, H = 250, L = 52, R = 16, T = 12, Bm = 26, n = M.length, bw = (W - L - R) / n;
  const mx = Math.max(1, ...M.flatMap((m) => [m.receipts || 0, m.payments || 0])) * 1.05, mid = T + (H - T - Bm) / 2, Y = (v) => mid - (v / mx) * (H - T - Bm) / 2;
  let cum = 0;
  return (
    <svg className="cf-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Cash received and paid by month">
      {[mx * 0.5, 0, -mx * 0.5].map((v, k) => <g key={k}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} className="cf-grid" style={v === 0 ? { stroke: "var(--mut)", opacity: 0.6 } : undefined} /><text x={L - 8} y={Y(v) + 4} className="cf-tk" textAnchor="end">{v ? (v < 0 ? "−" : "") + short(Math.abs(v)) : "0"}</text></g>)}
      {M.map((m, i) => {
        const x = L + i * bw, w = Math.min(34, bw * 0.5), cx = x + bw / 2, r = m.receipts || 0, p = m.payments || 0, net = r - p; cum += net;
        return (
          <g key={m.period} className="cf-hit" data-tip={tip(m.label + (m.partial ? " (month running)" : ""), [["Received", rs(r), "var(--cf-in)"], ["Paid out", rs(p), "var(--cf-out)"], ["Net", (net < 0 ? "−" : "+") + rs(Math.abs(net)), net < 0 ? "var(--crit)" : "var(--ok)"], ["Cumulative net", (cum < 0 ? "−" : "+") + rs(Math.abs(cum))]])}>
            <rect x={x} y={T} width={bw} height={H - T - Bm} fill="transparent" />
            <rect x={cx - w / 2} y={Y(r)} width={w} height={Math.max(0, mid - Y(r))} rx="3" fill="var(--cf-in)" opacity={m.partial ? 0.5 : 1} />
            <rect x={cx - w / 2} y={mid} width={w} height={Math.max(0, Y(-p) - mid)} rx="3" fill="var(--cf-out)" opacity={m.partial ? 0.5 : 1} />
            <circle cx={cx} cy={Y(net)} r="5" fill="var(--panel)" stroke={net < 0 ? "var(--crit)" : "var(--ok)"} strokeWidth="2.4" />
            <text x={cx} y={H - 8} className="cf-tk" textAnchor="middle">{m.label.split(" ")[0]}{m.partial ? "*" : ""}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Monthly EBITDA bars (green above zero, coral below), pre-tax as a dot.
export function EbitdaChart({ LM }) {
  if (!LM.length) return <Empty>No monthly profit and loss.</Empty>;
  const W = 720, H = 230, L = 56, R = 16, T = 12, Bm = 26, n = LM.length, bw = (W - L - R) / n;
  const vs = LM.flatMap((m) => [m.ebitda, m.pbt_before_stock]), mx = Math.max(1, ...vs.map(Math.abs)) * 1.1, lo = Math.min(0, ...vs) < 0 ? -mx : 0;
  const Y = (v) => T + ((H - T - Bm) * (mx - v)) / (mx - lo);
  return (
    <svg className="cf-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Monthly EBITDA">
      {[mx / 1.1, 0].concat(lo ? [lo / 1.1] : []).map((v, k) => <g key={k}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} className="cf-grid" style={v === 0 ? { stroke: "var(--mut)", opacity: 0.6 } : undefined} /><text x={L - 8} y={Y(v) + 4} className="cf-tk" textAnchor="end">{v ? (v < 0 ? "−" : "") + short(Math.abs(v)) : "0"}</text></g>)}
      {LM.map((m, i) => {
        const x = L + i * bw, w = Math.min(36, bw * 0.55), cx = x + bw / 2, v = m.ebitda, y0 = Y(0), y1 = Y(v);
        return (
          <g key={m.period} className="cf-hit" data-tip={tip(m.label + (m.partial ? " (month running)" : ""), [["Revenue", rs(m.revenue)], ["Gross profit (before stock)", rs(m.gross_profit_before_stock)], ["Operating expenses", rs(m.operating_expenses)], ["EBITDA", sg(v), v < 0 ? "var(--crit)" : "var(--ok)"], ["Depreciation", rs(m.depreciation)], ["Interest", rs(m.interest)], ["Pre-tax", sg(m.pbt_before_stock)]])}>
            <rect x={x} y={T} width={bw} height={H - T - Bm} fill="transparent" />
            <rect x={cx - w / 2} y={Math.min(y0, y1)} width={w} height={Math.max(1, Math.abs(y1 - y0))} rx="3" fill={v < 0 ? "var(--cf-out)" : "var(--cf-in)"} opacity={m.partial ? 0.45 : 1} />
            <circle cx={cx} cy={Y(m.pbt_before_stock)} r="3.5" fill="var(--cf-line)" />
            <text x={cx} y={H - 8} className="cf-tk" textAnchor="middle">{m.label.split(" ")[0]}{m.partial ? "*" : ""}</text>
          </g>
        );
      })}
    </svg>
  );
}

// A simple line over time. pts: [{x label, v}]; used for the value delivered by approvals.
export function StepLine({ pts, label, col = "var(--ok)", h = 260 }) {
  if (pts.length < 2) return <Empty>The line appears after two approvals in this period. Each approval adds its value here.</Empty>;
  const W = 460, L = 56, R = 16, T = 14, Bm = 26, mx = Math.max(1, ...pts.map((p) => p.v)) * 1.08;
  const X = (i) => L + (i * (W - L - R)) / (pts.length - 1), Y = (v) => T + (h - T - Bm) * (1 - v / mx);
  const step = Math.max(1, Math.ceil(pts.length / 6));
  return (
    <svg className="cf-svg" viewBox={`0 0 ${W} ${h}`} role="img" aria-label={label}>
      {[0, 0.5, 1].map((f, k) => { const v = (mx / 1.08) * f; return <g key={k}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} className="cf-grid" /><text x={L - 8} y={Y(v) + 4} className="cf-tk" textAnchor="end">{short(v)}</text></g>; })}
      <polyline points={pts.map((p, i) => `${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ")} fill="none" stroke={col} strokeWidth="2.4" strokeLinejoin="round" />
      {pts.map((p, i) => {
        const w = (W - L - R) / Math.max(1, pts.length - 1);
        return (
          <g key={i} className="cf-hit" data-tip={tip(p.when, [["Approved", p.party], ["Added", rs(p.add), col], ["Cumulative", rs(p.v)]])}>
            <rect x={X(i) - w / 2} y={T} width={w} height={h - T - Bm} fill="transparent" />
            <circle cx={X(i)} cy={Y(p.v)} r="3.5" fill={col} />
            {(i % step === 0 || i === pts.length - 1) && <text x={X(i)} y={h - 6} className="cf-tk" textAnchor="middle">{p.tick}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// Revenue to profit, as a ledger of bars.
export function Bridge({ F }) {
  const Q = F.LG.pl;
  const rows = [["Revenue", Q.revenue, "t"], ["Purchases and direct costs", -Q.direct_costs, ""], ["Gross profit (before stock)", Q.gross_profit_before_stock, "t"], ["Other income", Q.other_income, ""], ["Operating expenses", -Q.operating_expenses, ""], ["EBITDA", Q.ebitda, "t"], ["Depreciation", -Q.depreciation, ""], ["Interest", -Q.interest, ""], ["Profit before tax (before stock)", Q.pbt_before_stock, "t"]].filter((r) => r[2] || Math.abs(r[1]) >= 1);
  const mx = Math.max(1, ...rows.map((r) => Math.abs(r[1])));
  return (
    <div className="cf-wc">{rows.map(([l, v, t]) => (
      <div key={l} className={`cf-wr ${t ? "t2" : ""}`} data-tip={tip(l, [["Amount", sg(v)], ["Share of revenue", p1((Math.abs(v) / (Q.revenue || 1)) * 100)]])}>
        <span>{l}</span><Bar v={Math.abs(v)} mx={mx} col={v < 0 ? (t ? "var(--crit)" : "var(--cf-out)") : t ? "var(--cf-bill)" : "var(--cf-in)"} />
        <b className={`num ${v < 0 && t ? "neg" : ""}`}>{v < 0 ? "−" : ""}{inr(Math.abs(v))}</b>
      </div>))}
    </div>
  );
}

// One KPI tile that opens its detail drawer.
export function Kpi({ k, extra, onOpen }) {
  if (!k) return null;
  return (
    <button className={`cf-kpi ${k.avail ? "" : "na"}`} onClick={() => onOpen(k.key)} aria-label={`${k.label}: open the detail`}>
      <span className="l">{k.label}</span><span className="v num">{k.avail ? fmtK(k.fmt, k.value) : "Not available"}</span><span className="s">{k.avail ? extra || "" : k.why}</span>
    </button>
  );
}
export { rs, sg, d1, fmtDate };
