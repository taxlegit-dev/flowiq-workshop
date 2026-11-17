"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UC, compute, findingsOf, freshState, impactOf, inr, projected, seedFull, seedMeta } from "@/lib/engine";
import Overview from "@/components/Overview";
import UcAnalysis from "@/components/UcAnalysis";
import FindingPanel from "@/components/FindingPanel";

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
  const [busy, setBusy] = useState(false);
  const demo = user?.token === "demo";

  // ---- who is this? (saved session from the welcome form, or ?demo=1)
  useEffect(() => {
    if (params.get("demo") === "1") return setUser({ token: "demo", id: "demo", name: "Demo", email: "" });
    try {
      const s = JSON.parse(localStorage.getItem("flowiq:user") || "null");
      if (s?.token && s?.id) setUser(s); else router.replace("/");
    } catch { router.replace("/"); }
  }, [params, router]);

  // ---- each user has their own independent copy, kept only in their browser under their user ID
  const key = user && `flowiq:state:${user.id}`;
  useEffect(() => {
    if (!key) return;
    try { setState(JSON.parse(localStorage.getItem(key)) || freshState()); } catch { setState({ ...freshState(), emails: state.emails || 0 }); }
  }, [key]);
  useEffect(() => { if (key && state) localStorage.setItem(key, JSON.stringify(state)); }, [key, state]);

  const toastTimer = useRef(null);
  const say = (m) => { setToast(m); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(""), 4200); };

  const base = useMemo(() => state && compute({ ...state, approved: {} }), [state]);
  const now = useMemo(() => state && compute(state), [state]);
  const list = useMemo(() => state && findingsOf(state), [state]);
  const proj = useMemo(() => state && projected(state), [state]);

  if (!state || !now) return null;

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
        if ((state.emails || 0) >= MAX_EMAILS) return say(`You have used all ${MAX_EMAILS} emails for this workshop.`);
        await post("/api/email", { token: user.token, kind: "test", message: { party: f.party, subject: f.subject || f.action, body: f.body } });
        setState((s) => ({ ...s, emails: (s.emails || 0) + 1 }));
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

  async function sendMis() {
    if (demo) return say("Demo mode: emails are switched off.");
    if ((state.emails || 0) >= MAX_EMAILS) return say(`You have used all ${MAX_EMAILS} emails for this workshop.`);
    setBusy(true);
    const fmtK = (t) => (t.k === "dso" ? (x) => days(x) : t.k === "done" ? (x) => String(x) : (x) => inr(x, true));
    const report = {
      company: seedMeta.company, asOf: seedMeta.asOf,
      headline: `${K.done} of ${K.total} actions approved. Cash ${inr(K.cash)}, DSO ${days(K.dso)}, ${inr(K.atStake)} still at stake.`,
      kpis: tiles.filter((t) => t.k !== "done").map((t) => ({ label: t.l, start: fmtK(t)(B[t.k]), now: fmtK(t)(K[t.k]) }))
        .concat([{ label: "Actions approved", start: "0", now: `${K.done} / ${K.total}` }]),
      areas: now.areas.map((a) => ({ name: UC[a.uc].name, open: inr(a.open, true), resolved: inr(a.resolved, true), items: `${a.count - a.openCount}/${a.count}` })),
      approvals: list.filter((f) => state.approved[f.id]).map((f) => {
        const i = impactOf(f, state.inputs);
        const v = i.cash ? `+${inr(i.cash)} cash` : i.saved ? `${inr(i.saved)} saved` : `${inr(i.protect)} risk stopped`;
        return { party: f.party, action: f.action, impact: v };
      }),
    };
    try {
      await post("/api/email", { token: user.token, kind: "mis", report });
      setState((s) => ({ ...s, emails: (s.emails || 0) + 1 }));
      say(`MIS report sent to ${user.email}.`);
    } catch (e) { say(e.message); }
    setBusy(false);
  }

  function reset() {
    if (!window.confirm("Reset your sandbox to the original sample data?")) return;
    setState({ ...freshState(), emails: state.emails || 0 }); say("Sandbox reset.");
  }

  const rows = list.filter((f) => f.uc === tab).sort((a, b) => (!!state.approved[a.id] - !!state.approved[b.id]) || b.amount - a.amount);
  const openInTab = rows.filter((f) => !state.approved[f.id]).length;

  return (
    <>
      <header className="top"><div className="top-in">
        <span className="logo">FlowIQ Automation</span>
        <span className="co">{seedMeta.company} · sample data · books to {seedMeta.asOf}</span>
        <span className="sp" />
        <button className="btn ghost sm" onClick={() => setEditing(true)}>Edit numbers</button>
        <button className="btn ghost sm" onClick={reset}>Reset</button>
        {!demo && <button className="btn ghost sm" onClick={() => { localStorage.removeItem("flowiq:user"); router.replace("/"); }}>Sign out</button>}
        <button className="btn sm" onClick={sendMis} disabled={busy}>{busy ? "Sending…" : "Send MIS report"}</button>
      </div></header>

      <main className="wrap">
        <section className="kpis">
          {tiles.map((t) => {
            const dir = t.d === 0 ? "" : (t.d * t.good > 0 ? "up" : "down");
            const txt = t.sub || (Math.abs(t.d) < 0.05 ? (t.sub0 || "No change yet") : t.fmt ? t.fmt(t.d) : `${t.d > 0 ? "+" : "−"}${inr(Math.abs(t.d))}`);
            return (
              <div key={t.k} className={`kpi ${flash[t.k] ? "flash" : ""}`}>
                <div className="l">{t.l}</div>
                <div className="v num">{t.v}</div>
                <div className={`d ${t.sub ? "" : dir}`}>{txt}</div>
              </div>
            );
          })}
        </section>

        <div className="status">
          <span><i className="dot" />Synced from Tally {seedFull.sync.date}</span>
          <span>{seedFull.sync.vouchers.toLocaleString("en-IN")} vouchers read</span>
          <span>Data health {seedFull.sync.health}/100</span>
          <span>Books to {seedMeta.asOf}</span>
        </div>

        <nav className="views" role="tablist">
          <button className="view" aria-pressed={view === "overview"} onClick={() => setView("overview")}>Overview</button>
          <button className="view" aria-pressed={view === "hub"} onClick={() => setView("hub")}>Action Hub <span className="c">{K.total - K.done}</span></button>
        </nav>

        {view === "overview" && <Overview state={state} now={now} base={base} proj={proj} onOpen={(f) => setOpen(f)} />}

        {view === "hub" && (
        <section className="card">
          <div className="hd">
            <div className="tabs" role="tablist">
              {Object.keys(UC).map((k) => {
                const a = now.areas.find((x) => x.uc === k);
                return <button key={k} className="tab" aria-pressed={tab === k} onClick={() => setTab(k)}>{UC[k].short}<span className="c">{a.openCount}</span></button>;
              })}
            </div>
            {openInTab > 1 && <button className="btn ghost sm" onClick={approveAll}>Approve all {openInTab}</button>}
          </div>
          <h3 className="ucname">{UC[tab].name}</h3>
          <UcAnalysis uc={tab} state={state} />
          <p className="ucnote">Open a finding to see its analysis before you approve. Edit an amount to see its effect.</p>
          <div className="list">
            {rows.map((f) => {
              const done = !!state.approved[f.id];
              return (
                <div key={f.id} className={`row ${done ? "done" : ""}`}>
                  <span className={`sev ${f.severity}`} title={f.severity} />
                  <div><div className="p">{f.party}</div><div className="a">{f.action}</div></div>
                  <button className="t tlink" onClick={() => setOpen(f)}>{f.title.startsWith(f.party + ":") ? f.title.slice(f.party.length + 1).trim() : f.title}</button>
                  <input className="amt num" aria-label={`Amount for ${f.party}`} value={Number(f.amount).toLocaleString("en-IN")}
                    onChange={(e) => editAmount(f, e.target.value)} disabled={done} />
                  <div className="acts">
                    {done ? <button className="btn ghost sm" onClick={() => undo(f)}>Undo</button>
                      : <button className="btn sm" onClick={() => setOpen(f)}>Review</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        )}
        <p className="foot">Sample company data. Emails go only to your own address{user.email ? ` (${user.email})` : ""}.</p>
      </main>

      {open && <FindingPanel f={open} state={state} onClose={() => setOpen(null)} onApprove={approve} demo={demo} waOk={!demo && !!waLink(user.mobile, open)} email={user.email} />}
      {editing && <EditDrawer state={state} setState={setState} onClose={() => setEditing(false)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
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
