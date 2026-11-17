"use client";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { inr } from "@/lib/engine";

// Sequential (one hue, light -> dark) for age; "Not due" is neutral gray.
const AGE = { "Not due": "#c9cec9", "1-30": "#f6c3a4", "31-60": "#f0a074", "61-90": "#eb6834", "91-180": "#c44e1e", "180+": "#8f3410" };
const axis = { fontSize: 12, fill: "#5b6660" };
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
        <CartesianGrid vertical={false} stroke="#eef0ec" />
        <XAxis dataKey="bucket" tick={axis} tickLine={false} axisLine={{ stroke: "#d5d9d3" }} />
        <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={short} width={48} domain={[0, maxY || "auto"]} allowDataOverflow />
        <Tooltip cursor={{ fill: "rgba(14,107,102,.06)" }} content={<Tip />} />
        <Bar dataKey="amount" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={500}>
          {data.map((d) => <Cell key={d.bucket} fill={AGE[d.bucket] || "#999"} />)}
          <LabelList dataKey="amount" position="top" formatter={short} style={{ fontSize: 11.5, fill: "#5b6660" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AreaChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }} barCategoryGap="24%">
        <CartesianGrid horizontal={false} stroke="#eef0ec" />
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
