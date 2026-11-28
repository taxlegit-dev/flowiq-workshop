"use client";
// Reports: the report families, each with its own downloads. MIS and Action reports are the files built by the
// FlowIQ daily run (report_center.py); Financial Overview and Business Impact are built live from the dashboard figures.
import { useMemo } from "react";
import { seedMeta } from "@/lib/engine";
import { reportUrl } from "@/lib/companies";
import { BIZ, FIN } from "@/lib/cfo";
import { ExportBtn } from "./Board";
import { Ic } from "./ui";

// Which family a daily-run file belongs to.
export const familyOf = (d) => (/^(mis|mc_mis|fund)/.test(d.id) ? "mis" : /^(action|defaulter)/.test(d.id) ? "action" : d.period === "impact" || /^impact/.test(d.id) ? "impact" : "mis");
const nameOf = (d) => {
  if (familyOf(d) === "impact" && !d.short) return "Daily-run impact workbook";
  const t = d.short || String(d.title || d.id).replace(/^.* - /, "");
  return /\((pdf|excel)\)/i.test(t) || !d.format ? t : `${t} (${d.format === "pdf" ? "PDF" : "Excel"})`;
};

export default function Reports({ co, state, list, now, base, downloads, onGo, say }) {
  const F = useMemo(() => FIN(co, state, now, base), [co, state, now, base]);
  const Bz = useMemo(() => BIZ(state, list), [state, list]);
  const args = () => ({ F, Bz, company: seedMeta.company, co });
  const fam = (k) => downloads.filter((d) => familyOf(d) === k).sort((a, b) => (a.format === b.format ? 0 : a.format === "pdf" ? -1 : 1));
  const files = (k) => fam(k).map((d) => (
    <a key={d.id} className="fx-btn sm" href={reportUrl(co, d.filename)} download={d.filename} title={d.covers ? "Covers " + d.covers : ""}><Ic n="download" s={14} />{nameOf(d)}</a>));
  const card = (icon, title, text, btns, note, extra) => (
    <section className="fx-tile cf-rc"><div className="cf-rh"><span className="cf-ri"><Ic n={icon} s={18} /></span><h3>{title}</h3></div><p>{text}</p>
      <div className="cf-btns">{btns}</div>{extra}{note && <p className="fx-hint">{note}</p>}</section>);
  return (
    <div className="cf cf-rpt">
      <div className="cf-rg">
        {card("file", "MIS reports", "The management information pack: daily, weekly and monthly, from the books in Tally.",
          fam("mis").length ? files("mis") : <span className="fx-hint">Built at the next daily run.</span>, "Produced by the daily run from the setup templates. Hover a file to see the period it covers.")}
        {card("checkc", "Action reports", "What FlowIQ found and did: every action, follow-up and Tally confirmation for the week or month.",
          fam("action").length ? files("action") : <span className="fx-hint">Built at the next daily run.</span>, "Produced by the daily run from the setup templates. Hover a file to see the period it covers.")}
        {card("trend", "Impact reports", "Cash released, cost saved, margin protected and risk prevented, with before and after and the evidence behind every figure.",
          <>
            <ExportBtn kind="biz" fmt="pdf" args={args} onDone={say} className="fx-btn sm pri">Business Impact (PDF)</ExportBtn>
            <ExportBtn kind="biz" fmt="xlsx" args={args} onDone={say}>Business Impact (Excel)</ExportBtn>
            {files("impact")}
            <button className="fx-btn sm" onClick={() => onGo("impact")}><Ic n="right" s={14} />Open Business Impact</button>
          </>, "Business Impact is built live from your approvals; the daily-run workbook is the file from the last run.")}
        {card("grid", "Financial Overview", `Revenue, margin, profit, cash, working capital and receivables for ${seedMeta.company}, with the signals that need attention.`,
          <>
            <ExportBtn kind="fin" fmt="pdf" args={args} onDone={say} className="fx-btn sm pri">PDF</ExportBtn>
            <ExportBtn kind="fin" fmt="xlsx" args={args} onDone={say}>Excel</ExportBtn>
            <button className="fx-btn sm" onClick={() => onGo("overview")}><Ic n="right" s={14} />Open Financial Overview</button>
          </>, "Built live from the same figures as the dashboard.")}
      </div>
    </div>
  );
}
