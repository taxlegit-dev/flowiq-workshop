"use client";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { inr } from "@/lib/engine";

// Sequential (one hue, light -> dark) for age; "Not due" is neutral gray.
const AGE = { "Not due": "#c9cec9", "1-30": "#f6c3a4", "31-60": "#f0a074", "61-90": "#eb6834", "91-180": "#c44e1e", "180+": "#8f3410" };
const axis = { fontSize: 12, fill: "#5b6678" };
const short = (v) => (v >= 1e7 ? `${(v / 1e7).toFixed(1)}Cr` : v >= 1e5 ? `${Math.round(v / 1e5)}L` : v ? `${Math.round(v / 1e3)}k` : "0");

function Tip({ active, payload, label, rows }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tip">
      <b>{label}</b>
      {rows ? rows(payload[0].payload) : <span className="num">{inr(payload[0].value, true)}</span>}
    </div>
  );
}

export function AgeingChart({ data, maxY }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 22, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke="#eef1f5" />
        <XAxis dataKey="bucket" tick={axis} tickLine={false} axisLine={{ stroke: "#dfe3ea" }} />
        <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={short} width={48} domain={[0, maxY || "auto"]} allowDataOverflow />
        <Tooltip cursor={{ fill: "rgba(14,107,102,.06)" }} content={<Tip />} />
        <Bar dataKey="amount" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={500}>
          {data.map((d) => <Cell key={d.bucket} fill={AGE[d.bucket] || "#999"} />)}
          <LabelList dataKey="amount" position="top" formatter={short} style={{ fontSize: 11.5, fill: "#5b6678" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AreaChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }} barCategoryGap="24%">
        <CartesianGrid horizontal={false} stroke="#eef1f5" />
        <XAxis type="number" tick={axis} tickLine={false} axisLine={false} tickFormatter={short} />
        <YAxis type="category" dataKey="name" tick={axis} tickLine={false} axisLine={false} width={104} />
        <Tooltip cursor={{ fill: "rgba(14,107,102,.06)" }}
          content={<Tip rows={(p) => (<>
            <div className="num">Open: {inr(p.open, true)}</div>
            <div className="num">Resolved: {inr(p.resolved, true)}</div>
            <div>{p.openCount} of {p.count} items open</div></>)} />} />
        <Bar dataKey="resolved" stackId="a" fill="var(--resolved)" stroke="#fff" strokeWidth={2} isAnimationActive animationDuration={500} />
        <Bar dataKey="open" stackId="a" fill="var(--open)" stroke="#fff" strokeWidth={2} radius={[0, 4, 4, 0]} isAnimationActive animationDuration={500} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Billed vs paid per month (two series, one axis).
export function TrendChart({ data, a, b, la, lb, ca = "#7a5af0", cb = "#1a9e6e" }) {
  const mon = (m) => new Date(m + "-01").toLocaleString("en-IN", { month: "short" });
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#eef1f5" />
        <XAxis dataKey="m" tick={axis} tickLine={false} axisLine={{ stroke: "#dfe3ea" }} tickFormatter={mon} />
        <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={short} width={48} />
        <Tooltip content={<Tip rows={(p) => (<><div className="num">{la}: {inr(p[a], true)}</div><div className="num">{lb}: {inr(p[b], true)}</div></>)} />} labelFormatter={mon} />
        <Line type="monotone" dataKey={a} stroke={ca} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 6 }} isAnimationActive={false} />
        <Line type="monotone" dataKey={b} stroke={cb} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: "#fff" }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Money at stake per area: at the start vs open now.
export function BeforeAfterChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }} barGap={2} barCategoryGap="20%">
        <CartesianGrid horizontal={false} stroke="#eef1f5" />
        <XAxis type="number" tick={axis} tickLine={false} axisLine={false} tickFormatter={short} />
        <YAxis type="category" dataKey="name" tick={axis} tickLine={false} axisLine={false} width={108} />
        <Tooltip cursor={{ fill: "rgba(14,107,102,.06)" }}
          content={<Tip rows={(p) => (<><div className="num">At start: {inr(p.start, true)}</div><div className="num">Open now: {inr(p.open, true)}</div></>)} />} />
        <Bar dataKey="start" fill="#b9c0ba" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={400} />
        <Bar dataKey="open" fill="var(--open)" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={400} />
      </BarChart>
    </ResponsiveContainer>
  );
}
