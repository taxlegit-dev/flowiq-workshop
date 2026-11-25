"use client";
// Ctrl/Cmd + K: jump to any party, finding, voucher or section.
import { useEffect, useMemo, useRef, useState } from "react";
import { UC, inr } from "@/lib/engine";
import { Ic, hueOf, initials } from "./ui";

export default function Palette({ open, setOpen, sections, findings, state, onSection, onFinding }) {
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const inp = useRef(null);
  const box = useRef(null);
  useEffect(() => {
    const k = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(!open); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, setOpen]);
  useEffect(() => { if (open) { setQ(""); setI(0); setTimeout(() => inp.current?.focus(), 0); } }, [open]);

  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    const secs = sections.filter((x) => !s || x.label.toLowerCase().includes(s)).slice(0, s ? 6 : 4).map((x) => ({ kind: "sec", ...x }));
    const fs = findings
      .filter((f) => !s || `${f.party} ${UC[f.uc]?.short} ${f.title} ${f.refs || ""} ${f.action}`.toLowerCase().includes(s))
      .sort((a, b) => (!!state.approved[a.id] - !!state.approved[b.id]) || b.amount - a.amount)
      .slice(0, 40).map((f) => ({ kind: "f", f }));
    return [...secs, ...fs];
  }, [q, sections, findings, state]);
  useEffect(() => { box.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" }); }, [i]);
  if (!open) return null;

  const go = (x) => { if (!x) return; setOpen(false); x.kind === "sec" ? onSection(x) : onFinding(x.f); };
  const key = (e) => {
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setI(Math.min(items.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setI(Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); go(items[i]); }
  };
  const secN = items.filter((x) => x.kind === "sec").length;
  const it = (x, k) => (
    <button key={x.kind === "sec" ? "s" + x.id : x.f.id} className="it" aria-selected={k === i} onMouseEnter={() => setI(k)} onClick={() => go(x)}>
      {x.kind === "sec" ? <span className="av s"><Ic n={x.icon || "grid"} s={14} /></span> : <span className="av" style={{ background: hueOf(x.f.uc) }}>{initials(x.f.party)}</span>}
      <span>{x.kind === "sec" ? <><b>{x.label}</b><small>Go to</small></> : <><b>{x.f.party}</b><small>{UC[x.f.uc]?.short} · {x.f.label || x.f.action}{state.approved[x.f.id] ? " · approved" : ""}</small></>}</span>
      {x.kind === "f" && <em>{inr(x.f.amount)}</em>}
    </button>
  );
  return (
    <>
      <div className="fx-scrim" style={{ zIndex: 39 }} onClick={() => setOpen(false)} />
      <div className="fx-kpal" role="dialog" aria-label="Search">
        <input ref={inp} autoFocus value={q} onChange={(e) => { setQ(e.target.value); setI(0); }} onKeyDown={key} placeholder="Search parties, findings, vouchers or sections…" autoComplete="off" />
        <div className="res" ref={box}>
          {secN > 0 && <div className="grp">Sections</div>}
          {items.slice(0, secN).map((x, k) => it(x, k))}
          {items.length > secN && <div className="grp">Findings and actions</div>}
          {items.slice(secN).map((x, k) => it(x, k + secN))}
          {!items.length && <div className="grp">No matches</div>}
        </div>
        <div className="foot"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span></div>
      </div>
    </>
  );
}
