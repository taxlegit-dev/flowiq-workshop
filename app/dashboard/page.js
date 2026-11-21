"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AREAS, UC, compute, findingsOf, freshState, inr, projected, seedFull, seedMeta, selectCompany } from "@/lib/engine";
import { COMPANIES, DEFAULT_COMPANY, companyMeta, loadCompany, reportUrl } from "@/lib/companies";
import Overview from "@/components/Overview";
import UcAnalysis from "@/components/UcAnalysis";
import FindingPanel from "@/components/FindingPanel";
import Icon from "@/components/Icon";
import { Frame } from "@/components/Viz";

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
  const [tab, setTab] = useState("UC1");
  const [view, setView] = useState("overview");
  const [open, setOpen] = useState(null);      // finding being approved
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState("");
  const [flash, setFlash] = useState({});
  const [co, setCo] = useState(null);        // company on screen (key from lib/companies)
  const [area, setArea] = useState(null);    // Action Hub area, for companies running more than nine use cases
  const [dlOpen, setDlOpen] = useState(false);
  const [emails, setEmails] = useState(0);
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
    setTab(t); setArea(AREAS ? (AREAS.find((a) => a[2].includes(t)) || AREAS[0])[0] : null);
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
    { k: "overdue", l: "Overdue from customers", v: inr(K.overdue), d: K.overdue - B.overdue, good: -1 },
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
    const ids = list.filter((f) => f.uc === tab && !state.approved[f.id]).map((f) => f.id);
    if (!ids.length) return;
    applyApproval(ids, `Approved ${ids.length} × ${UC[tab].short}`);
  }

  function undo(f) {
    const approved = { ...state.approved }; delete approved[f.id];
    setState({ ...state, approved });
    say(`Undone: ${f.party}`);
  }

  function editAmount(f, v) {
    const n = Math.max(0, Number(String(v).replace(/[^\d.]/g, "")) || 0);
    setState({ ...state, edits: { ...state.edits, [f.id]: { amount: n } } });
  }

  function reset() {
    if (!window.confirm("Reset your sandbox to the original sample data?")) return;
    setState({ ...freshState(), co }); say(`${seedMeta.company} reset to the original sample data.`);
  }

  const rows = list.filter((f) => f.uc === tab).sort((a, b) => (!!state.approved[a.id] - !!state.approved[b.id]) || b.amount - a.amount);
  const openInTab = rows.filter((f) => !state.approved[f.id]).length;

  const pickUc = (uc) => {
    setView("hub"); setTab(uc);
    if (AREAS) setArea((AREAS.find((x) => x[2].includes(uc)) || AREAS[0])[0]);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const ucCount = (k) => now.areas.find((x) => x.uc === k)?.openCount || 0;
  const downloads = companyMeta(co).downloads;
  const initials = (user.name || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const UcItem = ({ k }) => (
    <button className="sn-sub" aria-current={view === "hub" && tab === k ? "page" : undefined} onClick={() => pickUc(k)}>
      <span>{UC[k].short}</span><em className={`num ${ucCount(k) ? "" : "zero"}`}>{ucCount(k)}</em>
    </button>
  );

  return (
    <div className="app">
      <aside className="sn" aria-label="Navigation">
        <div className="sn-brand"><span className="mark" /><b>FlowIQ</b><em>Automation</em></div>
        <label className="sn-co">
          <span className="sn-co-ic"><Icon name="building" size={15} /></span>
          <select value={co} onChange={(e) => switchCompany(e.target.value)} aria-label="Company">
            {COMPANIES.map((c) => <option key={c.key} value={c.key}>{c.label || c.name}</option>)}
          </select>
          <Icon name="chevron" size={14} className="sn-co-ch" />
        </label>

        <nav className="sn-nav">
          <button className="sn-item" aria-current={view === "overview" ? "page" : undefined} onClick={() => setView("overview")}><Icon name="grid" />Overview</button>
          <button className="sn-item" aria-current={view === "hub" ? "page" : undefined} onClick={() => setView("hub")}>
            <Icon name="inbox" />Action Hub<span className="badge num">{K.total - K.done}</span>
          </button>
          {view === "hub" && (
            <div className="sn-subs">
              {AREAS
                ? AREAS.map(([id, label, ucs]) => (
                    <div key={id} className="sn-grp">
                      <div className="sn-grp-h">{label}</div>
                      {ucs.map((k) => <UcItem key={k} k={k} />)}
                    </div>
                  ))
                : Object.keys(UC).map((k) => <UcItem key={k} k={k} />)}
            </div>
          )}
          <div className="sn-item static"><Icon name="file" />Reports</div>
          <div className="sn-subs">
            {downloads.map((d) => (
              <a key={d.id} className="sn-sub dl-link" href={reportUrl(co, d.filename)} download={d.filename} title={`${d.title} · ${d.covers}`}>
                <span>{d.format === "pdf" ? "MIS" : "Actionable"} · {d.period}</span><Icon name="download" size={14} />
              </a>
            ))}
          </div>
          <button className="sn-item" onClick={() => setEditing(true)}><Icon name="sliders" />Edit numbers</button>
          <button className="sn-item" onClick={reset}><Icon name="reset" />Reset sandbox</button>
        </nav>

        <div className="sn-user">
          <span className="av">{initials}</span>
          <div><b>{user.name}</b><span>{user.email || "Demo mode"}</span></div>
          {!demo && <button className="icon-btn" title="Sign out" aria-label="Sign out" onClick={() => { localStorage.removeItem("flowiq:user"); router.replace("/"); }}><Icon name="logout" /></button>}
        </div>
      </aside>

      <main className="main">
        <div className="crumbs">
          <span>{seedMeta.company}</span><Icon name="right" size={13} />
          <span>{view === "overview" ? "Overview" : "Action Hub"}</span>
          {view === "hub" && <><Icon name="right" size={13} /><b>{UC[tab]?.short}</b></>}
          <span className="sp" />
          <select className="m-co" value={co} onChange={(e) => switchCompany(e.target.value)} aria-label="Company">
            {COMPANIES.map((c) => <option key={c.key} value={c.key}>{c.label || c.name}</option>)}
          </select>
        </div>

        <header className="page-h">
          <div>
            <h1>{view === "overview" ? "Control overview" : UC[tab]?.name}</h1>
            <p>{view === "overview"
              ? `${seedMeta.company} · sample data · books to ${seedMeta.asOf} · synced from Tally ${seedFull.sync.date}`
              : UC[tab]?.na ? `Not applicable to ${seedMeta.company}: ${UC[tab].na}` : "Open a finding to see its analysis before you approve. Edit an amount to see its effect."}</p>
          </div>
          <div className="page-act">
            <div className="seg-sw" role="tablist">
              <button aria-pressed={view === "overview"} onClick={() => setView("overview")}>Overview</button>
              <button aria-pressed={view === "hub"} onClick={() => setView("hub")}>Action Hub</button>
            </div>
            <div className="dl">
              <button className="btn sm" onClick={() => setDlOpen(!dlOpen)} aria-expanded={dlOpen}><Icon name="download" size={15} />Download reports</button>
              {dlOpen && (
                <div className="dl-menu" role="menu">
                  {[...new Set(downloads.map((d) => d.group))].map((g) => (
                    <div key={g} className="dl-group">
                      <div className="dl-h">{g}</div>
                      {downloads.filter((d) => d.group === g).map((d) => (
                        <a key={d.id} className="dl-item" href={reportUrl(co, d.filename)} download={d.filename} onClick={() => setDlOpen(false)}>
                          <b>{d.title.replace(/^.* - /, "")}</b><span>{d.covers}</span>
                        </a>
                      ))}
                    </div>
                  ))}
                  <div className="dl-note">Built by FlowIQ from {seedMeta.company}'s books (Tally, read-only).</div>
                </div>
              )}
            </div>
          </div>
        </header>

        {view === "overview" && <Overview state={state} now={now} base={base} proj={proj} flash={flash} onOpen={(f) => setOpen(f)} onPickUc={pickUc} />}

        {view === "hub" && (
          <div className="hub">
            {AREAS && (
              <div className="chips" role="tablist" aria-label="Area">
                {AREAS.map(([id, label, ucs]) => {
                  const n = now.areas.filter((x) => ucs.includes(x.uc)).reduce((t, x) => t + x.openCount, 0);
                  return <button key={id} className="chip2" aria-pressed={area === id} onClick={() => { setArea(id); setTab(ucs.find((u) => seedFull.findings.some((f) => f.uc === u)) || ucs[0]); }}>{label}<em className="num">{n}</em></button>;
                })}
              </div>
            )}
            <div className="chips" role="tablist" aria-label="Use case">
              {Object.keys(UC).filter((k) => !AREAS || (AREAS.find((x) => x[0] === area)?.[2] || []).includes(k)).map((k) => (
                <button key={k} className="chip2 sm" aria-pressed={tab === k} onClick={() => setTab(k)}>{UC[k].short}<em className="num">{ucCount(k)}</em></button>
              ))}
            </div>

            <Frame icon={<Icon name="layers" />} label="How this check works" right={<span className="frame-r">{UC[tab]?.name}</span>}>
              <UcAnalysis uc={tab} state={state} />
            </Frame>

            <Frame icon={<Icon name="inbox" />} label="Findings"
              right={openInTab > 1 ? <button className="btn ghost xs" onClick={approveAll}>Approve all {openInTab}</button> : <span className="frame-r">{rows.length} items</span>}>
              <div className="fl">
                <div className="fl-h"><span>Party and action</span><span>What we found</span><span className="r">Amount (₹)</span><span /></div>
                {rows.length === 0 && <p className="muted fl-empty">No actions for {seedMeta.company} under this use case.</p>}
                {rows.map((f) => {
                  const done = !!state.approved[f.id];
                  return (
                    <div key={f.id} className={`fl-r ${done ? "done" : ""}`}>
                      <div className="fl-p"><span className={`dotsev ${f.severity}`} title={f.severity} /><div><b>{f.party}</b><em>{f.label || f.action}</em></div></div>
                      <button className="fl-t" onClick={() => setOpen(f)}>{f.title.startsWith(f.party + ":") ? f.title.slice(f.party.length + 1).trim() : f.title}</button>
                      <input className="amt num" aria-label={`Amount for ${f.party}`} value={Number(f.amount).toLocaleString("en-IN")}
                        onChange={(e) => editAmount(f, e.target.value)} disabled={done} />
                      <div className="acts">
                        {done ? <button className="btn ghost xs" onClick={() => undo(f)}><Icon name="check" size={14} />Undo</button>
                          : <button className="btn xs" onClick={() => setOpen(f)}>Review</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Frame>
          </div>
        )}
        <p className="foot">Sample company data. Emails go only to your own address{user.email ? ` (${user.email})` : ""}.</p>
      </main>

      {open && <FindingPanel f={open} state={state} onClose={() => setOpen(null)} onApprove={approve} demo={demo} waOk={!demo && !!waLink(user.mobile, open)} email={user.email} />}
      {editing && <EditDrawer state={state} setState={setState} onClose={() => setEditing(false)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function EditDrawer({ state, setState, onClose }) {
  const n = (v) => Math.max(0, Number(String(v).replace(/[^\d.]/g, "")) || 0);
  const setIn = (k) => (e) => setState({ ...state, inputs: { ...state.inputs, [k]: n(e.target.value) } });
  const setAge = (i) => (e) => setState({ ...state, ageing: state.ageing.map((b, j) => (j === i ? { ...b, amount: n(e.target.value) } : b)) });
  const fmt = (v) => Number(v).toLocaleString("en-IN");
  const F = ({ label, value, on, key }) => (
    <div className="f" key={key || label}><span>{label}</span><input className="num" value={fmt(value)} onChange={on} /></div>
  );
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer edit" aria-label="Edit numbers">
        <div className="mh"><h2>Edit numbers</h2><button className="x" onClick={onClose} aria-label="Close">×</button></div>
        <p className="ucnote">Every change updates the dashboard instantly.</p>
        <h3>Position</h3>
        {F({ label: "Cash & bank (₹)", value: state.inputs.cash, on: setIn("cash") })}
        {F({ label: "Receivables (₹)", value: state.inputs.receivables, on: setIn("receivables") })}
        {F({ label: "Net sales, last 90 days (₹)", value: state.inputs.netSales90, on: setIn("netSales90") })}
        {F({ label: "Interest rate on early / late payments (%)", value: state.inputs.interestRate, on: setIn("interestRate") })}
        <h3>Customer dues by days overdue</h3>
        {state.ageing.map((b, i) => F({ label: b.bucket, value: b.amount, on: setAge(i), key: b.bucket }))}
        <div style={{ marginTop: 20 }}><button className="btn" onClick={onClose}>Done</button></div>
      </aside>
    </>
  );
}
