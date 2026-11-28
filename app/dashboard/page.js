"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AREAS, UC, compute, findingsOf, freshState, inr, projected, seedFull, seedMeta, selectCompany, LB } from "@/lib/engine";
import { COMPANIES, DEFAULT_COMPANY, companyMeta, loadCompany, reportUrl } from "@/lib/companies";
import Hero from "@/components/fx/Hero";
import Hub from "@/components/fx/Hub";
import Board from "@/components/fx/Board";
import CaseFile from "@/components/fx/CaseFile";
import Palette from "@/components/fx/Palette";
import Area from "@/components/fx/Area";
import Impact from "@/components/fx/Impact";
import Reports from "@/components/fx/Reports";
import { AREA_ICON, Ic, Tip, areaOf, hueOfArea } from "@/components/fx/ui";
import "./fx.css";

const days = (n) => `${Number(n).toFixed(1)} days`;
const MAX_EMAILS = 15;

// WhatsApp click-to-chat to the attendee's own number: opens WhatsApp with the message typed in.
function waLink(mobile, f) {
  let n = String(mobile || "").replace(/\D/g, "");
  if (n.length === 10) n = "91" + n;            // Indian mobile without country code
  if (n.length === 11 && n.startsWith("0")) n = "91" + n.slice(1);
  if (n.length < 11) return null;
  const head = `[FlowIQ test] In live use this goes to ${f.party}.\n\n`;
  const text = (head + (f.subject ? `*${f.subject}*\n\n` : "") + (f.body || f.action)).slice(0, 1800);
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}
const post = (url, body) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Request failed"); return j; });

export default function Page() {
  return <Suspense fallback={null}><Dashboard /></Suspense>;
}

function Dashboard() {
  const router = useRouter();
  const params = useSearchParams();
  const [user, setUser] = useState(null);
  const [state, setState] = useState(null);
  const [tab, setTab] = useState("UC1");     // use case for "Approve all"
  const [view, setView] = useState("hub");
  const [areaUc, setAreaUc] = useState(null);
  const [seg, setSeg] = useState("todo");      // Action Hub: needs approval / approved / all
  const [hubUc, setHubUc] = useState(null);    // Action Hub filter: one check
  const [kp, setKp] = useState(false);         // search palette
  const [open, setOpen] = useState(null);      // finding being approved
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState("");
  const [flash, setFlash] = useState({});
  const [co, setCo] = useState(null);        // company on screen (key from lib/companies)
  const [area, setArea] = useState(null);    // Action Hub area, for companies running more than nine use cases
  const [dlOpen, setDlOpen] = useState(false);
  const [emails, setEmails] = useState(0);
  const [bizMetric, setBizMetric] = useState("");  // Business Impact opened on one outcome (from a signal)
  const demo = user?.token === "demo";

  // ---- who is this? (saved session from the welcome form, or ?demo=1)
  useEffect(() => {
    if (params.get("demo") === "1") return setUser({ token: "demo", id: "demo", name: "Demo", email: "" });
    try {
      const s = JSON.parse(localStorage.getItem("flowiq:user") || "null");
      if (s?.token && s?.id) setUser(s); else router.replace("/");
    } catch { router.replace("/"); }
  }, [params, router]);

  // ---- each user has an independent copy of EACH company, kept only in their browser under user ID + company.
  // (Vardhan keeps the original key so earlier workshop sessions carry on.)
  const stateKey = (k) => (k === DEFAULT_COMPANY ? `flowiq:state:${user.id}` : `flowiq:state:${user.id}:${k}`);
  const readState = (k) => {
    try { const s = JSON.parse(localStorage.getItem(stateKey(k))); if (s?.approved) return { ...s, co: k }; } catch {}
    return { ...freshState(), co: k };
  };
  const firstTab = () => {
    const withItems = Object.keys(UC).find((u) => seedFull.findings.some((f) => f.uc === u));
    return withItems || Object.keys(UC)[0];
  };
  async function switchCompany(k) {
    const { key: kk, data } = await loadCompany(k);
    selectCompany(data);
    const t = firstTab();
    setTab(t); setArea(null); setHubUc(null);
    setOpen(null); setDlOpen(false); setToast(""); setFlash({});
    setState(readState(kk)); setCo(kk);
    try { localStorage.setItem(`flowiq:company:${user.id}`, kk); } catch {}
  }
  useEffect(() => {
    if (!user) return;
    let k = DEFAULT_COMPANY;
    try { k = localStorage.getItem(`flowiq:company:${user.id}`) || DEFAULT_COMPANY; } catch {}
    try { setEmails(Number(localStorage.getItem(`flowiq:emails:${user.id}`)) || 0); } catch {}
    switchCompany(k);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  // Save only to the company the state belongs to, so switching never mixes records.
  useEffect(() => { if (user && state?.co) try { localStorage.setItem(stateKey(state.co), JSON.stringify(state)); } catch {} }, [user, state]); // eslint-disable-line react-hooks/exhaustive-deps

  const toastTimer = useRef(null);
  const say = (m) => { setToast(m); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(""), 4200); };

  const base = useMemo(() => state && compute({ ...state, approved: {} }), [state]);
  const now = useMemo(() => state && compute(state), [state]);
  const list = useMemo(() => state && findingsOf(state), [state]);
  const proj = useMemo(() => state && projected(state), [state]);

  if (!state || !now || state.co !== co) return null;

  const K = now.kpi, B = base.kpi;
  const tiles = [
    { k: "atStake", l: "At stake", v: inr(K.atStake), d: K.atStake - B.atStake, good: -1, sub0: `${K.total - K.done} open items` },
    { k: "cash", l: "Cash & bank", v: inr(K.cash), d: K.cash - B.cash, good: 1 },
    { k: "dso", l: "DSO", v: days(K.dso), d: K.dso - B.dso, good: -1, fmt: (x) => `${x > 0 ? "+" : "−"}${Math.abs(x).toFixed(1)} days` },
    { k: "overdue", l: LB("overdue", "Overdue from customers"), v: inr(K.overdue), d: K.overdue - B.overdue, good: -1 },
    { k: "value", l: "Saved & risk stopped", v: inr(K.value), d: K.value - B.value, good: 1 },
    { k: "done", l: "Actions approved", v: `${K.done} / ${K.total}`, d: 0, sub: K.done ? `${inr(B.atStake - K.atStake)} actioned` : "Waiting for you" },
  ];

  function applyApproval(ids, verb) {
    const before = compute(state).kpi;
    const approved = { ...state.approved };
    const stamp = new Date().toISOString();
    ids.forEach((id) => { approved[id] = stamp; });
    const next = { ...state, approved };
    const after = compute(next).kpi;
    setState(next);
    const changed = {};
    for (const k of ["atStake", "cash", "receivables", "dso", "overdue", "value", "done"]) if (Math.abs(after[k] - before[k]) > 0.01) changed[k] = 1;
    setFlash(changed); setTimeout(() => setFlash({}), 1600);
    const parts = [];
    if (after.cash > before.cash) parts.push(`Cash +${inr(after.cash - before.cash)}`);
    if (after.dso < before.dso - 0.05) parts.push(`DSO ${before.dso.toFixed(1)} → ${after.dso.toFixed(1)}`);
    if (after.value > before.value) parts.push(`Saved/stopped +${inr(after.value - before.value)}`);
    say(`${verb}. ${parts.join(" · ") || "Recorded."}`);
  }

  async function approve(f, sendTest, sendWa) {
    if (sendWa) { const l = waLink(user.mobile, f); if (l) window.open(l, "_blank", "noopener"); }
    applyApproval([f.id], `Approved: ${f.action} · ${f.party}`);
    setOpen(null);
    if (sendTest) {
      if (demo) return say("Demo mode: emails are switched off.");
      try {
        if (emails >= MAX_EMAILS) return say(`You have used all ${MAX_EMAILS} emails for this workshop.`);
        await post("/api/email", { token: user.token, kind: "test", message: { party: f.party, subject: f.subject || f.action, body: f.body } });
        const n = emails + 1; setEmails(n); try { localStorage.setItem(`flowiq:emails:${user.id}`, String(n)); } catch {}
        say(`Test copy sent to ${user.email}.`);
      } catch (e) { say(e.message); }
    }
  }

  function approveAll() {
    const u = hubUc || tab;
    const ids = list.filter((f) => f.uc === u && !state.approved[f.id]).map((f) => f.id);
    if (!ids.length) return;
    applyApproval(ids, `Approved ${ids.length} × ${UC[u].short}`);
  }

  function undo(f) {
    const approved = { ...state.approved }; delete approved[f.id];
    if (open?.id === f.id) setOpen(null);
    setState({ ...state, approved });
    say(`Undone: ${f.party}`);
  }

  function editAmount(f, v) {
    const n = Math.max(0, Number(String(v).replace(/[^\d.]/g, "")) || 0);
    setState({ ...state, edits: { ...state.edits, [f.id]: { amount: n } } });
  }

  function reset() {
    if (!window.confirm("Reset the dashboard to the figures from the last Tally sync?")) return;
    setState({ ...freshState(), co }); say(`${seedMeta.company} reset to the last Tally sync.`);
  }


  // Open the Action Hub (optionally filtered) and bring the list into view, below the green band.
  const goHub = (s, a, u) => {
    setView("hub"); if (s) setSeg(s); setArea(a ?? null); setHubUc(u ?? null); if (u) setTab(u);
    if (typeof window === "undefined") return;
    const filtered = !!(a || u || (s && s !== "todo"));
    setTimeout(() => {
      const el = document.querySelector(".fx-hub");
      if (filtered && el) window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 76), behavior: "smooth" });
      else window.scrollTo({ top: 0, behavior: "smooth" });
    }, 30);
  };
  const goArea = (id, u) => { setView("area"); setArea(id); setAreaUc(u ?? null); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); };
  const goView = (v) => { setView(v); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); };
  const pickUc = (uc) => goHub("todo", areaOf(uc), uc);
  const onHeroGo = (k) => { if (k === "overview" || k === "impact" || k === "reports") { goView(k); return; } goHub(k); };
  const goBiz = (m) => { setBizMetric(m || ""); goView("impact"); };
  const downloads = companyMeta(co).downloads;
  const initials = (user.name || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const openN = K.total - K.done;
  const areaCount = (ucs) => list.filter((f) => ucs.includes(f.uc) && !state.approved[f.id]).length;
  const sections = [{ id: "overview", label: "Financial Overview", icon: "grid" }, { id: "impact", label: "Business Impact", icon: "trend" }, { id: "hub", label: "Action Hub", icon: "inbox" }, { id: "reports", label: "Reports", icon: "report" }]
    .concat((AREAS || []).map(([id, label]) => ({ id: "area:" + id, label, icon: AREA_ICON[id] || "grid" })));
  const onSection = (x) => { if (x.id === "hub") goHub("todo"); else if (x.id === "overview" || x.id === "impact" || x.id === "reports") goView(x.id); else goArea(x.id.slice(5)); };
  const title = view === "overview" ? "Financial Overview" : view === "impact" ? "Business Impact" : view === "reports" ? "Reports" : view === "area" ? (AREAS || []).find((a) => a[0] === area)?.[1] : hubUc ? UC[hubUc]?.name : area ? (AREAS || []).find((a) => a[0] === area)?.[1] : "Action Hub";

  return (
    <div className="fx">
      <aside className="fx-rail" aria-label="Navigation">
        <div className="fx-mark"><i /><div><b>FlowIQ</b><small>Financial intelligence</small></div></div>
        <label className="fx-cosw"><span>Company</span>
          <select value={co} onChange={(e) => switchCompany(e.target.value)} aria-label="Company">
            {COMPANIES.map((c) => <option key={c.key} value={c.key}>{c.label || c.name}</option>)}
          </select>
        </label>
        <nav className="fx-nav">
          <button className="fx-tab" aria-current={view === "overview" ? "page" : undefined} onClick={() => goView("overview")}><Ic n="grid" />Financial Overview</button>
          <button className="fx-tab" aria-current={view === "impact" ? "page" : undefined} onClick={() => goBiz("")}><Ic n="trend" />Business Impact</button>
          <button className={`fx-tab ${openN ? "hot" : ""}`} aria-current={view === "hub" && !area && !hubUc ? "page" : undefined} onClick={() => goHub()}><Ic n="inbox" />Action Hub<em className="num">{openN}</em></button>
          {AREAS && <div className="fx-grpl">Business areas</div>}
          {(AREAS || []).map(([id, label, ucs]) => {
            const n = areaCount(ucs);
            return (
              <button key={id} className={`fx-tab ${n ? "" : "zero"}`} aria-current={view === "area" && area === id ? "page" : undefined} onClick={() => goArea(id)}>
                <span className="sw" style={{ background: hueOfArea(id) }}><Ic n={AREA_ICON[id] || "grid"} s={11} /></span>{label}<em className="num">{n}</em>
              </button>
            );
          })}
          <div className="fx-sep" />
          <button className="fx-tab" aria-current={view === "reports" ? "page" : undefined} onClick={() => goView("reports")}><Ic n="report" />Reports<em className="num">{downloads.length}</em></button>
          <div className="fx-sep" />
          <button className="fx-tab" onClick={() => setEditing(true)}><Ic n="sliders" />Edit numbers</button>
          <button className="fx-tab" onClick={reset}><Ic n="reset" />Reset to Tally</button>
        </nav>
        <div className="fx-foot">
          <div className="fx-user">
            <span className="av">{initials}</span>
            <div><b>{user.name}</b><span>{user.email || "Demo mode, emails off"}</span></div>
            {!demo && <button className="fx-icon" title="Sign out" aria-label="Sign out" onClick={() => { localStorage.removeItem("flowiq:user"); router.replace("/"); }}><Ic n="logout" /></button>}
          </div>
          <div className="fx-note"><b>Live from Tally.</b> Your own workspace. Emails go only to your address{!demo && emails ? ` (${emails}/${MAX_EMAILS} used)` : ""}.</div>
        </div>
      </aside>

      <div className="fx-stage">
        <header className="fx-top"><div className="in">
          <div className="fx-crumb"><h1>{title}</h1><span>{seedMeta.company} · {view === "overview" ? "where the money stands, and what needs attention" : view === "impact" ? "the value the actions delivered, with the evidence" : view === "reports" ? "MIS, action and impact reports" : view === "area" ? "each check: results, forecast and the actions" : "decisions, approvals and their effect"}</span></div>
          <button className="fx-kbtn" onClick={() => setKp(true)} aria-label="Search (Ctrl+K)"><Ic n="search" /><span className="lbl">Search parties, findings…</span><kbd>Ctrl K</kbd></button>
          <div className="fx-menu">
            <button className="fx-btn pri sm" onClick={() => setDlOpen(!dlOpen)} aria-expanded={dlOpen}><Ic n="download" s={15} /><span className="lbl">Download reports</span></button>
            {dlOpen && (
              <div className="fx-pop" role="menu">
                {[...new Set(downloads.map((d) => d.group))].map((g) => (
                  <div key={g}>
                    <div className="h">{g}</div>
                    {downloads.filter((d) => d.group === g).map((d) => (
                      <a key={d.id} href={reportUrl(co, d.filename)} download={d.filename} onClick={() => setDlOpen(false)}>{d.title.replace(/^.* - /, "")}<span>{d.covers}</span></a>
                    ))}
                  </div>
                ))}
                <div className="note">Built by FlowIQ from {seedMeta.company}'s books (Tally, read-only).</div>
              </div>
            )}
          </div>
        </div></header>

        <main className="fx-wrap">
          {view === "hub" && <Hero state={state} now={now} base={base} proj={proj} flash={flash} showFlow={view === "hub"} onGo={onHeroGo} scope={view === "hub" ? { area, uc: hubUc } : {}} />}
          {view === "hub" ? (
            <Hub state={state} list={list} now={now} seg={seg} setSeg={setSeg} area={area} setArea={setArea} uc={hubUc} setUc={(u) => { setHubUc(u); if (u) setTab(u); }}
              onOpen={(f) => setOpen(f)} onEdit={editAmount} onUndo={undo} onApproveAll={approveAll} />
          ) : view === "area" ? (
            <Area key={area} state={state} list={list} now={now} base={base} area={area} uc={areaUc} setUc={setAreaUc} onHub={(u) => goHub("todo", areaOf(u), u)} />
          ) : view === "impact" ? (
            <Impact key={co + ":" + bizMetric} state={state} now={now} base={base} proj={proj} list={list} co={co} downloads={downloads} emails={emails} onOpen={(f) => setOpen(f)} say={say} metric0={bizMetric} />
          ) : view === "reports" ? (
            <Reports co={co} state={state} list={list} now={now} base={base} downloads={downloads} onGo={(v) => (v === "impact" ? goBiz("") : goView(v))} say={say} />
          ) : (
            <Board co={co} state={state} list={list} now={now} base={base} proj={proj} onOpen={(f) => setOpen(f)} onEdit={editAmount} onUndo={undo}
              onPickArea={(id) => goArea(id)} onPickUc={pickUc} onSeeAll={() => goHub("todo")} onBiz={goBiz} say={say} />
          )}
          <p className="fx-legal">Live data from Tally through FlowIQ Automation. Emails go only to your own address{user.email ? ` (${user.email})` : ""}.</p>
        </main>
      </div>

      {open && <CaseFile key={open.id} f={list.find((x) => x.id === open.id) || open} state={state} onClose={() => setOpen(null)} onApprove={approve} onUndo={undo} demo={demo} waOk={!demo && !!waLink(user.mobile, open)} email={user.email} />}
      {editing && <EditDrawer state={state} setState={setState} onClose={() => setEditing(false)} />}
      <Palette open={kp} setOpen={setKp} sections={sections} findings={list} state={state} onSection={onSection} onFinding={(f) => setOpen(f)} />
      <Tip />
      {toast && <div className="fx-toast" role="status">{toast}</div>}
    </div>
  );
}

function EditDrawer({ state, setState, onClose }) {
  useEffect(() => { const k = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const n = (v) => Math.max(0, Number(String(v).replace(/[^\d.]/g, "")) || 0);
  const setIn = (k) => (e) => setState({ ...state, inputs: { ...state.inputs, [k]: n(e.target.value) } });
  const setAge = (i) => (e) => setState({ ...state, ageing: state.ageing.map((b, j) => (j === i ? { ...b, amount: n(e.target.value) } : b)) });
  const fmt = (v) => Number(v).toLocaleString("en-IN");
  const F = ({ label, value, on, key }) => (
    <label className="fx-f" key={key || label}><span>{label}</span><input className="num" value={fmt(value)} onChange={on} /></label>
  );
  return (
    <>
      <div className="fx-scrim" onClick={onClose} />
      <aside className="fx-drawer fx-edit" aria-label="Edit numbers">
        <div className="fx-cf-top">
          <div className="fx-cf-band" style={{ gridTemplateColumns: "minmax(0,1fr)" }}><div><span className="area">Every change updates the dashboard instantly</span><h2>Edit numbers</h2></div></div>
          <button className="fx-x" onClick={onClose} aria-label="Close"><Ic n="x" s={16} /></button>
        </div>
        <div className="fx-cf-body">
          <h3>Position</h3>
          {F({ label: "Cash & bank (₹)", value: state.inputs.cash, on: setIn("cash") })}
          {F({ label: "Receivables (₹)", value: state.inputs.receivables, on: setIn("receivables") })}
          {F({ label: "Net sales, last 90 days (₹)", value: state.inputs.netSales90, on: setIn("netSales90") })}
          {F({ label: "Interest rate on early / late payments (%)", value: state.inputs.interestRate, on: setIn("interestRate") })}
          <h3>{LB("dues_by_age", "Customer dues by days overdue")}</h3>
          {state.ageing.map((b, i) => F({ label: b.bucket, value: b.amount, on: setAge(i), key: b.bucket }))}
        </div>
        <div className="fx-dact"><button className="fx-btn pri" onClick={onClose}>Done</button></div>
      </aside>
    </>
  );
}
