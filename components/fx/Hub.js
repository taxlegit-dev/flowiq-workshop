"use client";
// Action Hub: the exposure map (areas and checks) beside the decision queue.
import { AREAS, UC, inr, seedMeta } from "@/lib/engine";
import UcAnalysis from "@/components/UcAnalysis";
import { AREA_ICON, Ic, Mono, SEV_RANK, areaOf, hueOfArea, tip } from "./ui";

const fmtAmt = (n) => Number(n || 0).toLocaleString("en-IN");

export function Row({ f, state, max, onOpen, onEdit, onUndo }) {
  const done = !!state.approved[f.id];
  const what = f.title.startsWith(f.party + ":") ? f.title.slice(f.party.length + 1).trim() : f.title;
  const go = () => onOpen(f);
  return (
    <div className={`fx-row sev-${f.severity} ${done ? "done" : ""}`} role="button" tabIndex={0} onClick={go}
      onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) go(); }} aria-label={`Open ${f.party}`}>
      <Mono name={f.party} uc={f.uc} sev={f.severity} />
      <div className="fx-row-m">
        <div className="who">{f.party}<span className={`fx-sev ${f.severity}`}>{f.severity}</span></div>
        <div className="meta"><span>{UC[f.uc]?.short}</span><i /><span>{f.label || f.action}</span></div>
        <div className="what">{what}</div>
      </div>
      <div className="fx-row-a" onClick={(e) => e.stopPropagation()}>
        <label className="fx-amt" title={done ? "Undo the approval to change the amount" : "Edit the amount to see its effect"}>
          <input className="num" size={Math.max(5, fmtAmt(f.amount).length + 1)} value={"₹" + fmtAmt(f.amount)} onChange={(e) => onEdit(f, e.target.value)} disabled={done} aria-label={`Amount for ${f.party}`} />
        </label>
        <span className="fx-mb"><i style={{ width: `${Math.max(3, (Number(f.amount) / Math.max(max, 1)) * 100).toFixed(1)}%` }} /></span>
      </div>
      <div className="fx-row-n" onClick={(e) => done && e.stopPropagation()}>
        {done ? <span className="fx-ok"><Ic n="check" s={14} />Approved<button className="fx-lnk" onClick={() => onUndo(f)}><Ic n="undo" s={13} />Undo</button></span>
          : <span className="fx-go">Review</span>}
      </div>
    </div>
  );
}

const toList = () => setTimeout(() => { const el = document.querySelector(".fx-hub"); if (el && el.getBoundingClientRect().top < 0) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 76, behavior: "smooth" }); }, 30);

export default function Hub({ state, list, now, seg, setSeg, area, setArea, uc, setUc, onOpen, onEdit, onUndo, onApproveAll }) {
  const isDone = (f) => !!state.approved[f.id];
  const inSeg = (f) => (seg === "todo" ? !isDone(f) : seg === "done" ? isDone(f) : true);
  const pool = list.filter(inSeg);
  const n = (pred) => pool.filter(pred).length;
  const amt = (pred) => pool.filter(pred).reduce((t, f) => t + (Number(f.amount) || 0), 0);
  const areas = (AREAS || []).map(([id, label, ucs]) => ({ id, label, ucs, n: n((f) => ucs.includes(f.uc)), a: amt((f) => ucs.includes(f.uc)) }));
  const mxA = Math.max(1, ...areas.map((x) => x.a));
  const tot = amt(() => true);

  let rows = pool;
  if (uc) rows = rows.filter((f) => f.uc === uc);
  else if (area) rows = rows.filter((f) => areaOf(f.uc) === area);
  rows = rows.slice().sort((a, b) =>
    seg === "done" ? String(state.approved[b.id]).localeCompare(String(state.approved[a.id]))
      : (isDone(a) - isDone(b)) || (SEV_RANK[b.severity] - SEV_RANK[a.severity]) || b.amount - a.amount);
  const max = Math.max(0, ...rows.map((f) => Number(f.amount) || 0));
  const openInUc = uc ? list.filter((f) => f.uc === uc && !isDone(f)).length : 0;
  const scope = uc ? UC[uc]?.short : area ? areas.find((x) => x.id === area)?.label : "all areas";
  const cnt = (k) => list.filter((f) => (k === "todo" ? !isDone(f) : k === "done" ? isDone(f) : true)).length;
  const clear = areas.filter((x) => !x.n && x.id !== area);
  const xm = (on, onClick, name, icn, count, a, bar, cls) => (
    <button className={`fx-xm ${cls || ""} ${count ? "" : "zero"}`} aria-pressed={on} onClick={onClick}>
      <span className="n">{icn}{name}</span><span className="c"><b>{count}</b>{a ? ` · ${inr(a)}` : ""}</span>
      {bar != null && <span className="bar"><i style={{ width: `${bar}%`, background: cls === "all" ? "var(--g3)" : undefined }} /></span>}
    </button>
  );

  return (
    <div className="fx-hub">
      <div className="fx-qhead">
        <div className="fx-seg" role="tablist">
          {[["todo", "Needs your approval", "alert"], ["done", "Approved", "checkc"], ["all", "All", "list"]].map(([k, l, i]) => (
            <button key={k} aria-pressed={seg === k} onClick={() => setSeg(k)}><Ic n={i} s={15} />{l}<em className="num">{cnt(k)}</em></button>
          ))}
        </div>
        <span className="fx-qsum"><b>{rows.length}</b> item{rows.length === 1 ? "" : "s"} · <b>{inr(rows.reduce((t, f) => t + (Number(f.amount) || 0), 0))}</b> · {scope}{seg === "todo" ? " · most severe first" : ""}</span>
      </div>

      <div className="fx-ws">
        <aside className="fx-mapw">
          <div className="fx-map">
            <h3>Exposure map <span>{seg === "todo" ? "open" : seg === "done" ? "approved" : "all"}</span></h3>
            {xm(!area && !uc, () => { setArea(null); setUc(null); }, "All areas", <Ic n="grid" s={15} />, pool.length, tot, tot ? 100 : 0, "all")}
            {areas.map((x) => (x.n || x.id === area) && (
              <div key={x.id}>
                {xm(area === x.id && !uc, () => { setArea(x.id); setUc(null); toList(); }, x.label,
                  <span className="sw" style={{ background: hueOfArea(x.id) }}><Ic n={AREA_ICON[x.id] || "grid"} s={12} /></span>, x.n, x.a, ((x.a / mxA) * 100).toFixed(1))}
                {area === x.id && x.ucs.map((k) => {
                  const c = n((f) => f.uc === k);
                  return <div key={k}>{xm(uc === k, () => { setUc(k); toList(); }, UC[k]?.short || k, null, c, amt((f) => f.uc === k), null, "sub")}</div>;
                })}
              </div>
            ))}
            {clear.length > 0 && <p className="fx-clear"><Ic n="checkc" s={14} />Clear: {clear.map((x) => x.label).join(", ")}</p>}
          </div>
        </aside>

        <div className="fx-queue">
          {(area || uc) && (() => {
            const aid = area || areaOf(uc), ucs = ((AREAS || []).find((a) => a[0] === aid)?.[2] || []).filter((k) => list.some((f) => f.uc === k));
            return ucs.length > 0 && (
              <div className="fx-ucs">{ucs.map((k) => {
                const fsK = list.filter((f) => f.uc === k), op = fsK.filter((f) => !isDone(f)), oa = op.reduce((t, f) => t + (Number(f.amount) || 0), 0);
                const fa = fsK.reduce((t, f) => t + (Number(f.amount) || 0), 0), sv = ["critical", "high", "medium", "low"].find((s) => op.some((f) => f.severity === s));
                return (
                  <button key={k} className="fx-uc" aria-pressed={uc === k} onClick={() => { setUc(uc === k ? null : k); if (uc === k) setArea(aid); }} style={{ "--h": hueOfArea(aid) }}>
                    <span className="t">{UC[k]?.short}{sv && <span className={`fx-sev ${sv}`}>{sv}</span>}</span>
                    <b className="num">{inr(oa)}</b>
                    <span className="s">{op.length} open of {fsK.length} · {UC[k]?.name}</span>
                    <span className="bar"><i style={{ width: `${fa ? ((fa - oa) / fa) * 100 : 0}%` }} /></span>
                  </button>
                );
              })}</div>
            );
          })()}
          {uc && (
            <details className="fx-how" open={!rows.length}>
              <summary><span><Ic n="layers" s={15} />How the {UC[uc]?.short} check works</span><em>{UC[uc]?.name}</em></summary>
              {UC[uc]?.na ? <p className="fx-na">Not applicable to {seedMeta.company}: {UC[uc].na}</p> : <UcAnalysis uc={uc} state={state} />}
            </details>
          )}
          {uc && openInUc > 1 && seg !== "done" && (
            <div className="fx-bulk"><span><b>{openInUc}</b> open {UC[uc]?.short} actions</span><button className="fx-btn ghost sm" onClick={onApproveAll}>Approve all {openInUc}</button></div>
          )}
          {rows.length ? (
            <div className="fx-list">{rows.map((f) => <Row key={f.id} f={f} state={state} max={max} onOpen={onOpen} onEdit={onEdit} onUndo={onUndo} />)}</div>
          ) : (
            <div className="fx-empty"><Ic n="checkc" s={22} /><b>{seg === "done" ? "Nothing approved here yet" : "Nothing waiting here"}</b>
              <span>{seg === "done" ? "Approve an action and it moves here, with its effect on the numbers above." : `No open actions for ${seedMeta.company} in ${scope}.`}</span></div>
          )}
        </div>
      </div>
    </div>
  );
}
