"use client";
import { useState } from "react";
import { inr } from "@/lib/engine";

export const PAL = ["#2f6bff", "#f08c2e", "#1a9e6e", "#7a5af0", "#e5484d", "#0f9fb3", "#c9940a", "#d6409f"];

// Donut: share actioned. SVG, animates its arc when the value changes.
export function Donut({ pct, label }) {
  const r = 44, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, pct));
  return (
    <div className="donut">
      <svg viewBox="0 0 110 110" width="120" height="120" role="img" aria-label={`${v.toFixed(0)}% ${label}`}>
        <circle cx="55" cy="55" r={r} fill="none" stroke="var(--track)" strokeWidth="11" />
        {v > 0.5 && <circle cx="55" cy="55" r={r} fill="none" stroke="url(#dg)" strokeWidth="11" strokeLinecap="round"
          strokeDasharray={`${(c * v) / 100} ${c}`} transform="rotate(-90 55 55)" className="donut-arc" />}
        <defs><linearGradient id="dg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#34c38f" /><stop offset="1" stopColor="#1a9e6e" /></linearGradient></defs>
      </svg>
      <div className="donut-c"><b className="num">{v.toFixed(0)}%</b><span>{label}</span></div>
    </div>
  );
}

// Segmented bar with markers (overdue ageing).
export function SegBar({ parts }) {
  const total = parts.reduce((t, p) => t + p.v, 0) || 1;
  let acc = 0;
  return (
    <div className="seg">
      <div className="seg-bar">
        {parts.map((p) => {
          const w = (p.v / total) * 100; acc += w;
          return <span key={p.k} className="seg-part" style={{ width: `${w}%`, background: p.c }} title={`${p.k}: ${inr(p.v, true)}`} />;
        })}
      </div>
      <div className="seg-legend">
        {parts.map((p) => (
          <div key={p.k}><i style={{ background: p.c }} /><span>{p.k}</span><b className="num">{inr(p.v)}</b></div>
        ))}
      </div>
    </div>
  );
}

// Progress row.
export function Prog({ label, value, max, color, right }) {
  const w = max && value > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="prog">
      <span className="prog-l">{label}</span>
      <span className="prog-t" style={{ background: `${color}1f` }}><span className="prog-f" style={{ width: `${w}%`, background: color }} /></span>
      <span className="prog-r num">{right}</span>
    </div>
  );
}

// Column chart: one bar per area; the bar under the pointer turns blue with a tooltip; dashed average line.
export function Columns({ data, onPick }) {
  const [hi, setHi] = useState(null);
  const max = Math.max(...data.map((d) => Math.max(d.start, d.open)), 1);
  const avg = data.reduce((t, d) => t + d.open, 0) / (data.length || 1);
  const ticks = [0, .25, .5, .75, 1].map((t) => t * max);
  const short = (v) => (v >= 1e7 ? `${(v / 1e7).toFixed(1)}Cr` : v >= 1e5 ? `${Math.round(v / 1e5)}L` : v ? `${Math.round(v / 1e3)}k` : "0");
  return (
    <div className="cols" onMouseLeave={() => setHi(null)}>
      <div className="cols-y">{ticks.slice().reverse().map((t) => <span key={t}>{short(t)}</span>)}</div>
      <div className="cols-plot">
        {ticks.map((t) => <div key={t} className="cols-grid" style={{ bottom: `${(t / max) * 100}%` }} />)}
        <div className="cols-avg" style={{ bottom: `${(avg / max) * 100}%` }}><span>Average {short(avg)}</span></div>
        <div className="cols-bars">
          {data.map((d, i) => {
            const on = hi === i;
            return (
              <button key={d.name} className={`col ${on ? "on" : ""}`} onMouseEnter={() => setHi(i)} onFocus={() => setHi(i)} onClick={() => onPick?.(d)}
                aria-label={`${d.name}: ${inr(d.open, true)} open of ${inr(d.start, true)}`}>
                <span className="col-ghost" style={{ height: `${(d.start / max) * 100}%`, background: `${d.color}26` }} />
                <span className="col-bar" style={{ height: `${Math.max(d.open ? 1.5 : 0, (d.open / max) * 100)}%`, background: `linear-gradient(180deg, ${d.color}cc, ${d.color})`, "--c": d.color }} />
                {on && <span className="col-tip" style={{ bottom: `calc(${(Math.max(d.start, d.open) / max) * 100}% + 10px)` }}>
                  <b>{inr(d.open)}</b> open<em>{d.done} of {d.count} done</em></span>}
              </button>
            );
          })}
        </div>
        <div className="cols-x">{data.map((d, i) => <span key={d.name} className={hi === i ? "on" : ""}><i style={{ background: d.color }} />{d.name}</span>)}</div>
      </div>
    </div>
  );
}

// Card frame from the reference: grey frame, icon label row, white inner panel.
export function Frame({ icon, label, right, children, className = "", flash, tone }) {
  return (
    <section className={`frame ${className} ${flash ? "flash" : ""}`}>
      <div className="frame-h"><span className={`frame-l ${tone ? "t-" + tone : ""}`}>{icon}{label}</span>{right}</div>
      <div className="frame-in">{children}</div>
    </section>
  );
}
