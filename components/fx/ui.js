"use client";
// Shared pieces of the dashboard design: icons, monograms, money display, tooltip and stepper.
import { useEffect, useState } from "react";
import { AREAS, UC, inr } from "@/lib/engine";

const P = {
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  inbox: "M4 13l2.5-7h11L20 13M4 13v6h16v-6M4 13h4.5l1.5 2.5h4l1.5-2.5H20",
  file: "M7 3h7l5 5v13H7zM14 3v5h5",
  download: "M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19h14",
  sliders: "M5 7h9m4 0h1M5 17h3m4 0h7M15 5v4M9 15v4",
  reset: "M5 12a7 7 0 1 0 2-5M5 4v4h4",
  logout: "M14 4h5v16h-5M10 12h10M10 12l3.5-3.5M10 12l3.5 3.5",
  alert: "M12 4l9 16H3zM12 10v4M12 17v.5",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  check: "M5 12.5l4.5 4.5L19 7",
  checkc: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l3 3 5-6",
  list: "M8 6h12M8 12h12M8 18h12M4 6h.5M4 12h.5M4 18h.5",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3",
  wallet: "M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4zM4 7l11-3v3M16 13.5h.5",
  scale: "M12 4v16M5 20h14M6 8h12M6 8l-3 6a3 3 0 0 0 6 0zM18 8l-3 6a3 3 0 0 0 6 0z",
  box: "M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10",
  users: "M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-2a4 4 0 0 0-3-3.9M16 2.1a4 4 0 0 1 0 7.8",
  report: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 18v-2M12 18v-5M16 18v-3",
  cart: "M3 4h2l2.5 11h11L21 7H6.5M9 20h.5M17 20h.5",
  layers: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5",
  bolt: "M13 3L5 13h6l-1 8 8-10h-6z",
  right: "M10 7l5 5-5 5",
  x: "M6 6l12 12M18 6L6 18",
  undo: "M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  mail: "M3 5h18v14H3zM3 6l9 7 9-7",
  chat: "M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l1.9-5.6A8.4 8.4 0 1 1 21 11.5z",
  trend: "M4 16l5-5 4 4 7-7M15 8h5v5",
  building: "M5 21V5l7-2v18M12 7h7v14M8 8v.5M8 12v.5M8 16v.5M15.5 11v.5M15.5 15v.5",
  chevron: "M8 10l4 4 4-4",
};
export function Ic({ n, s = 16, className = "" }) {
  return (
    <svg className={`fx-ic ${className}`} width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={P[n] || P.grid} /></svg>
  );
}

// Area colours: one per business area, used by monograms, the exposure map and charts.
const AREA_HUE = { rec: "#0F6B5B", pay: "#3B5FC0", gst: "#A0661A", proc: "#6A55A8", tax: "#B0476A", inv: "#4E7D2A", close: "#4B5563", mkt: "#C0563A" };
const SPARE = ["#0F6B5B", "#3B5FC0", "#A0661A", "#6A55A8", "#B0476A", "#4E7D2A", "#4B5563", "#C0563A"];
export const AREA_ICON = { rec: "receipt", pay: "wallet", gst: "scale", proc: "cart", tax: "users", inv: "box", close: "report", mkt: "trend" };
export const areaOf = (uc) => UC[uc]?.area || (AREAS || []).find((a) => a[2].includes(uc))?.[0] || "rec";
export const hueOfArea = (id) => AREA_HUE[id] || SPARE[Math.max(0, (AREAS || []).findIndex((a) => a[0] === id)) % SPARE.length];
export const hueOf = (uc) => hueOfArea(areaOf(uc));
export const areaLabel = (id) => (AREAS || []).find((a) => a[0] === id)?.[1] || "Checks";

export const initials = (s) => {
  const w = String(s || "?").replace(/[^A-Za-z0-9 &]/g, " ").split(/\s+/)
    .filter((x) => x && !/^(pvt|ltd|the|and|&|of|llp|private|limited|co)$/i.test(x));
  return ((w[0] || "?")[0] + ((w[1] || "")[0] || "")).toUpperCase();
};
export function Mono({ name, uc, sev, size }) {
  return <span className={`fx-mono ${sev ? "sev-" + sev : ""} ${size || ""}`} style={{ background: hueOf(uc) }} aria-hidden="true">{initials(name)}</span>;
}

// "₹2.38 Cr" -> big number with the unit set smaller.
export function Big({ v }) {
  const m = inr(v), i = m.lastIndexOf(" ");
  return i > 0 ? <>{m.slice(0, i)}<small>{m.slice(i + 1)}</small></> : <>{m}</>;
}
export const days = (n) => `${Number(n || 0).toFixed(1)} days`;
export const SEV_RANK = { critical: 4, high: 3, medium: 2, low: 1 };

// One floating tooltip for the whole dashboard: any element with data-tip='{"t":"Title","r":[["Label","Value","#colour"]]}'.
export function Tip() {
  const [t, setT] = useState(null);
  useEffect(() => {
    const over = (e) => {
      const el = e.target.closest?.("[data-tip]");
      if (!el) return setT(null);
      try { setT({ ...JSON.parse(el.dataset.tip), x: e.clientX, y: e.clientY }); } catch { setT(null); }
    };
    const out = () => setT(null);
    document.addEventListener("mousemove", over);
    window.addEventListener("scroll", out, true);
    return () => { document.removeEventListener("mousemove", over); window.removeEventListener("scroll", out, true); };
  }, []);
  if (!t) return null;
  const left = Math.min(t.x + 14, (typeof window !== "undefined" ? window.innerWidth : 1200) - 260);
  return (
    <div className="fx-tip" style={{ left, top: t.y + 16 }}>
      <b>{t.t}</b>
      {(t.r || []).map(([l, v, c], i) => (
        <div key={i}><span>{c && <i style={{ background: c }} />}{l}</span><em>{v}</em></div>
      ))}
    </div>
  );
}
export const tip = (t, r) => JSON.stringify({ t, r });
