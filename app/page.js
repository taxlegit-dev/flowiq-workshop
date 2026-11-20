"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { COMPANIES } from "@/lib/companies";
import { inr } from "@/lib/engine";

const AT_STAKE = inr(COMPANIES.reduce((t, c) => t + c.atStake, 0));
const ISSUES = COMPANIES.reduce((t, c) => t + c.findings, 0);
const USE_CASES = Math.max(...COMPANIES.map((c) => c.useCases));

export default function Welcome() {
  const router = useRouter();
  const [f, setF] = useState({ name: "", mobile: "", email: "", company: "", consent: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem("flowiq:user") || "null"); if (s?.token && s?.id) setSaved(s); } catch {}
  }, []);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function submit(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const r = await fetch("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Could not register.");
      localStorage.setItem("flowiq:user", JSON.stringify(j));
      router.push("/dashboard");
    } catch (x) { setErr(x.message); setBusy(false); }
  }

  return (
    <main className="welcome">
      <section className="hero">
        <div className="brand">FlowIQ Automation</div>
        <h1>Welcome to FlowIQ Automation</h1>
        <p className="tag">Every rupee at risk, found and fixed in one click.</p>
        <div className="hero-stats">
          <div><b>{USE_CASES}</b><span>use cases</span></div>
          <div><b>{COMPANIES.length}</b><span>companies</span></div>
          <div><b>{ISSUES}</b><span>issues found</span></div>
          <div><b>{AT_STAKE}</b><span>at stake</span></div>
        </div>
      </section>
      <section className="formside">
        <form className="form" onSubmit={submit}>
          <h2>Start your sandbox</h2>
          <p className="sub">Your own copy of a sample company's books.</p>
          <div className="field"><label htmlFor="n">Name</label><input id="n" required value={f.name} onChange={set("name")} autoComplete="name" /></div>
          <div className="field"><label htmlFor="m">Mobile</label><input id="m" required inputMode="tel" value={f.mobile} onChange={set("mobile")} autoComplete="tel" /></div>
          <div className="field"><label htmlFor="e">Email</label><input id="e" required type="email" value={f.email} onChange={set("email")} autoComplete="email" /></div>
          <div className="field"><label htmlFor="c">Company <span style={{ fontWeight: 400, color: "var(--faint)" }}>(optional)</span></label><input id="c" value={f.company} onChange={set("company")} autoComplete="organization" /></div>
          <label className="consent"><input type="checkbox" checked={f.consent} onChange={set("consent")} /> I agree to receive workshop emails from FlowIQ at this address.</label>
          {err && <div className="err">{err}</div>}
          <button className="btn" disabled={busy}>{busy ? "Setting up…" : "Open my dashboard"}</button>
          {saved && <button type="button" className="link" onClick={() => router.push("/dashboard")}>Continue as {saved.name} →</button>}
        </form>
      </section>
    </main>
  );
}
