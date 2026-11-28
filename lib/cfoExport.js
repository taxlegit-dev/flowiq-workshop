// Exports for Financial Overview and Business Impact: Excel (.xlsx written natively, no library) and PDF (jsPDF, loaded on first use).
// Both read the same models as the screens (lib/cfo.js), so every exported figure is the figure on screen.
import { inr } from "./engine";
import { LVL, OUTCOMES, OUTCOME_KEYS, d1, fmtDate, fmtK, num, p1, signals, x2 } from "./cfo";

const today = () => new Date().toISOString().slice(0, 10);
export function save(blob, filename) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const safe = (s) => String(s || "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");

// ---------------------------------------------------------------- XLSX writer (store-only zip)
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = t[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }; })();
function zip(files) {
  const enc = new TextEncoder(), parts = [], cen = []; let off = 0;
  const u16 = (v) => [v & 255, (v >>> 8) & 255], u32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  files.forEach((f) => {
    const nm = enc.encode(f.name), crc = CRC(f.data), sz = f.data.length;
    const lh = new Uint8Array([0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(sz), ...u32(sz), ...u16(nm.length), ...u16(0)]);
    parts.push(lh, nm, f.data);
    cen.push(new Uint8Array([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(sz), ...u32(sz), ...u16(nm.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nm);
    off += lh.length + nm.length + sz;
  });
  const cl = cen.reduce((t, x) => t + x.length, 0), end = new Uint8Array([0x50, 0x4b, 5, 6, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cl), ...u32(off), ...u16(0)]);
  return new Blob([...parts, ...cen, end], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
// sheets: [{name, cols:[widths], rows:[[cell]], freeze}] ; cell = value | {v, s}; s: h header, t title, n note, m rupees, p percent, d decimal, b bold, mb bold rupees, i integer, sub section, ok green, bad red
function xlsx(sheets, title) {
  const X = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  const SI = { "": 0, h: 1, t: 2, n: 3, m: 4, p: 5, d: 6, b: 7, mb: 8, i: 9, sub: 10, ok: 11, bad: 12 };
  const col = (i) => { let s = ""; i++; while (i) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; };
  const ws = (sh) => {
    const rows = sh.rows.map((r, ri) => `<row r="${ri + 1}">${r.map((c, ci) => {
      if (c === null || c === undefined || c === "") return "";
      const o = typeof c === "object" ? c : { v: c }, s = SI[o.s || (typeof o.v === "number" ? "m" : "")] || 0, ref = col(ci) + (ri + 1);
      if (o.v === null || o.v === undefined) return "";
      if (typeof o.v === "number" && Number.isFinite(o.v)) return `<c r="${ref}" s="${s}"><v>${o.s === "p" ? o.v / 100 : o.v}</v></c>`;
      return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${X(o.v)}</t></is></c>`;
    }).join("")}</row>`).join("");
    const fr = sh.freeze ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${sh.freeze}" topLeftCell="A${sh.freeze + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : `<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>`;
    const merge = (sh.cols || []).length > 1 ? ["A1:" + col(sh.cols.length - 1) + "1", "A2:" + col(sh.cols.length - 1) + "2"] : [];
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>${fr}<cols>${(sh.cols || []).map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${rows}</sheetData>${merge.length ? `<mergeCells count="${merge.length}">${merge.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : ""}<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
  };
  const INR = '[&gt;=10000000]&quot;₹&quot;##\\,##\\,##\\,##0;[&gt;=100000]&quot;₹&quot;##\\,##\\,##0;&quot;₹&quot;##,##0';
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="${INR}"/><numFmt numFmtId="165" formatCode="0.0"/></numFmts>
<fonts count="7"><font><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FFE6F5C8"/><name val="Calibri"/></font><font><b/><sz val="15"/><color rgb="FF00463C"/><name val="Calibri"/></font><font><i/><sz val="9"/><color rgb="FF5C6863"/><name val="Calibri"/></font><font><b/><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FF11804F"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FFD6402B"/><name val="Calibri"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF00463C"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE4F0EA"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFE2E5DF"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="13"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" applyFont="1" applyFill="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" applyFont="1"><alignment wrapText="1" vertical="top"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyBorder="1"><alignment vertical="top"/></xf>
<xf numFmtId="10" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyBorder="1"><alignment vertical="top"/></xf>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyBorder="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="4" fillId="3" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="164" fontId="4" fillId="3" borderId="1" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="top"/></xf>
<xf numFmtId="3" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyBorder="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="4" fillId="0" borderId="0" applyFont="1"/>
<xf numFmtId="164" fontId="5" fillId="0" borderId="1" applyNumberFormat="1" applyFont="1" applyBorder="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="6" fillId="0" borderId="1" applyFont="1" applyBorder="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const enc = new TextEncoder(), names = sheets.map((s, i) => X(String(s.name).replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Sheet" + (i + 1)));
  const files = [
    { name: "[Content_Types].xml", data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`) },
    { name: "_rels/.rels", data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`) },
    { name: "docProps/core.xml", data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${X(title)}</dc:title><dc:creator>FlowIQ</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`) },
    { name: "xl/workbook.xml", data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`) },
    { name: "xl/_rels/workbook.xml.rels", data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`) },
    { name: "xl/styles.xml", data: enc.encode(styles) },
  ].concat(sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: enc.encode(ws(s)) })));
  return zip(files);
}
const H = (a) => a.map((v) => ({ v, s: "h" }));
const head = (title, sub) => [[{ v: title, s: "t" }], [{ v: sub, s: "n" }], []];
const stLbl = { Open: "Open", Approved: "Approved" };

function finSheets(F, Bz, company) {
  const K = F.K, sub = `${company} · ${F.from ? fmtDate(F.from) + " to " : ""}${fmtDate(F.asOn)} · generated ${fmtDate(today())} by FlowIQ`;
  const kv = (k) => { const m = K[k]; return [m.label, m.avail ? { v: Math.round(m.value * 100) / 100, s: m.fmt === "m" ? "m" : m.fmt === "p" ? "p" : "d" } : "Not available", m.fmt === "d" ? "days" : m.fmt === "mo" ? "months" : m.fmt === "x" ? "times" : "", m.avail ? m.formula : m.why, m.src]; };
  const grp = (t, ks) => [[{ v: t, s: "sub" }]].concat(ks.map(kv));
  const S1 = head("Financial Overview", sub).concat([H(["Metric", "Value", "Unit", "How it is calculated", "Source"])],
    grp("Revenue and margin", ["revenue", "run_rate", "direct", "gross_profit", "gross_margin", "credit_note_ratio"]), grp("Cash and liquidity", ["cash", "cash_cover", "net_cash", "collection", "trade_liq"]),
    F.LG ? grp("Profitability and funding (Tally ledgers)", ["ebitda", "ebitda_margin", "opex", "opex_ratio", "depreciation", "interest", "pbt", "pbt_margin", "interest_cover", "loans", "loans_change", "net_debt", "debt_ebitda", "fixed_assets"]) : [],
    grp("Working capital", ["wc", "receivables", "payables", "duties", "dso", "dpo", "ccc"]), grp("Receivables", ["overdue", "overdue_share", "over60", "concentration"]));
  const SG = signals(F, Bz);
  const S2 = head("Signals", sub).concat([H(["Level", "Signal", "Detail"])], SG.map((s) => [{ v: LVL[s.lvl][0], s: s.lvl === "good" ? "b" : "bad" }, { v: s.t, s: "b" }, s.d]));
  const S3 = head("Monthly billing, purchases and cash", sub + " · voucher values include GST").concat([H(["Month", "Billing", "Purchases", "Purchases ÷ billing", "Received", "Paid out", "Net cash", "Credit notes", "Credit notes ÷ billing"])],
    F.M.map((m) => [m.label, m.sales, m.purchase, m.sales ? { v: ((m.purchase || 0) / m.sales) * 100, s: "p" } : "", m.receipts, m.payments, (m.receipts || 0) - (m.payments || 0), m.credit_notes, m.sales && m.credit_notes != null ? { v: (m.credit_notes / m.sales) * 100, s: "p" } : ""]),
    [[{ v: "Total", s: "b" }, { v: F.sums.sb, s: "mb" }, { v: F.sums.pu, s: "mb" }, F.sums.sb ? { v: (F.sums.pu / F.sums.sb) * 100, s: "p" } : "", { v: F.sums.rc, s: "mb" }, { v: F.sums.py, s: "mb" }, { v: F.sums.rc - F.sums.py, s: "mb" }, { v: F.sums.cn, s: "mb" }, F.sums.sb ? { v: (F.sums.cn / F.sums.sb) * 100, s: "p" } : ""]]);
  const P = F.P, S4 = head("Working capital and receivables", sub).concat([H(["Position", "Balance"])],
    [["Cash and bank", K.cash.value], ["Receivables", K.receivables.value], ["Advances to suppliers", num(P.advances_to_vendors)], ["Payables", num(P.payables)], ["Duties and taxes (net, as in Tally)", num(P.duties_taxes_net)], ["Working capital", num(P.working_capital)]].filter((x) => x[1] != null),
    [[], H(["Receivables by age", "Amount", "Share"])], F.B.map((b) => [b.bucket, b.amount, { v: (b.amount / (F.sums.tot || 1)) * 100, s: "p" }]),
    [[], H(["Largest overdue customers (open)", "Overdue", "Share of overdue"])], F.top.slice(0, 15).map((t) => [t.party, t.overdue, { v: (t.overdue / (F.sums.od || 1)) * 100, s: "p" }]));
  const out = [{ name: "Summary", cols: [34, 18, 8, 60, 40], rows: S1, freeze: 4 }, { name: "Signals", cols: [16, 52, 80], rows: S2, freeze: 4 }, { name: "Monthly", cols: [12, 16, 16, 12, 16, 16, 16, 14, 12], rows: S3, freeze: 4 }];
  if (F.LG) {
    const Q = F.LG.pl, b = F.LG.bs, r = (v) => ({ v, s: "m" });
    out.push({ name: "Profit and loss", cols: [34, 16, 16, 16, 18, 14, 16, 14, 14, 16], rows: head("Profit and loss and funding", sub + " · from the Tally ledgers; before closing-stock adjustment and tax").concat([H(["Profit and loss", "Year to date", "% of revenue"])],
      [["Revenue", Q.revenue], ["Purchases", -Q.purchases], ["Direct expenses", -Q.direct_expenses], ["Gross profit (before stock)", Q.gross_profit_before_stock], ["Other income", Q.other_income], ["Operating expenses", -Q.operating_expenses], ["EBITDA", Q.ebitda], ["Depreciation", -Q.depreciation], ["Interest and finance costs", -Q.interest], ["Profit before tax (before stock)", Q.pbt_before_stock]]
        .map(([l, v]) => [/profit|EBITDA|Revenue/.test(l) ? { v: l, s: "b" } : l, { v, s: /profit|EBITDA/.test(l) ? "mb" : "m" }, { v: (v / (Q.revenue || 1)) * 100, s: "p" }]),
      [[], H(["Month", "Revenue", "Direct costs", "Gross profit", "Operating expenses", "Other income", "EBITDA", "Depreciation", "Interest", "Pre-tax"])],
      F.LM.map((m) => [m.label, m.revenue, m.direct_costs, m.gross_profit_before_stock, m.operating_expenses, m.other_income, { v: m.ebitda, s: "mb" }, m.depreciation, m.interest, m.pbt_before_stock]),
      [[], H(["Funding and assets", "Start of year", "Now", "Change"])],
      [["Borrowings (all)", b.loans_total_open, b.loans_total], ["Secured loans", null, b.secured_loans], ["Bank overdraft / cash credit", null, b.bank_od], ["Unsecured loans", null, b.unsecured_loans], ["Cash and bank", b.cash_bank_open, b.cash_bank], ["Net debt (negative = net cash)", (b.loans_total_open || 0) - (b.cash_bank_open || 0), (b.loans_total || 0) - (b.cash_bank || 0)], ["Fixed assets (net)", b.fixed_assets_net_open, b.fixed_assets_net], ["Capital", null, b.capital]]
        .map(([l, a, z]) => [l, a == null ? "" : r(a), z == null ? "" : r(z), a == null || z == null ? "" : r(z - a)]),
      [[], H(["Expense ledger", "Group", "Type", "Year to date", "% of revenue"])],
      F.LG.expenses.map((e) => [e.ledger, e.group, ({ opex: "Operating", direct_exp: "Direct", depreciation: "Depreciation", interest: "Interest" })[e.class] || e.class, e.amount, { v: (e.amount / (Q.revenue || 1)) * 100, s: "p" }]),
      [[], [{ v: `Checks: ${F.LG.checks.vouchers} vouchers, ${F.LG.checks.from} to ${F.LG.checks.to}; opening-balance difference ${inr(F.LG.checks.opening_difference || 0)}; ledgers without a group: ${F.LG.checks.unmapped_ledgers}.`, s: "n" }]]) });
  }
  out.push({ name: "Working capital", cols: [38, 18, 18], rows: S4 }, { name: "Not available", cols: [34, 90], rows: head("What this data cannot show", sub).concat([H(["Item", "Why"])], F.NA.map((n) => [n.label, n.why])) });
  return out;
}
function bizSheets(B, company) {
  const sub = `${company} · ${B.label} · generated ${fmtDate(today())} by FlowIQ`, T = B.tot;
  const S1 = head("Business Impact", sub).concat([H(["Outcome", "Items", "Approved", "Identified (at stake)", "Potential (if all approved)", "Actioned", "Achieved", "Exposure closed", "Still open", "Achieved ÷ potential"])],
    OUTCOME_KEYS.map((k) => { const m = B.byM[k]; return [{ v: OUTCOMES[k][0], s: "b" }, { v: m.n, s: "i" }, { v: m.closed, s: "i" }, m.stake, m.pot, m.actioned, { v: m.ach, s: "ok" }, m.closedStake, m.open, m.pot ? { v: (m.achAll / m.pot) * 100, s: "p" } : "n/a"]; }),
    [[{ v: "Total", s: "b" }, { v: T.n, s: "i" }, { v: T.closed, s: "i" }, { v: T.stake, s: "mb" }, { v: T.pot, s: "mb" }, { v: T.actioned, s: "mb" }, { v: T.ach, s: "mb" }, { v: T.closedStake, s: "mb" }, { v: T.open, s: "mb" }, T.pot ? { v: (T.achAll / T.pot) * 100, s: "p" } : ""]],
    [[], [{ v: "Achieved: cash collected, cost saved and risk stopped by the actions you approved. Each use case feeds one outcome (FlowIQ rules, outcome mapping).", s: "n" }]]);
  const S2 = head("Impact by use case", sub).concat([H(["Use case", "Code", "Outcome", "Items", "Approved", "Identified", "Potential", "Achieved (to date)", "Achieved (period)", "Still open"])],
    B.byU.map((u) => [u.name, u.uc, OUTCOMES[u.metric][0], { v: u.n, s: "i" }, { v: u.closed, s: "i" }, u.stake, u.pot, { v: u.achAll, s: "ok" }, u.ach, u.open]));
  const S3 = head("Evidence ledger: every item behind the figures", sub).concat([H(["Finding", "Use case", "Outcome", "Party", "Issue", "Action", "Voucher references", "Evidence", "Severity", "At stake", "Potential", "Achieved", "Status", "Approved at"])],
    B.rows.slice().sort((a, b) => b.ach - a.ach || b.stake - a.stake).map((r) => [r.id, r.ucn, OUTCOMES[r.metric][0], r.party, r.title, r.action, r.refs, r.evid, r.severity, r.stake, r.exp, { v: r.ach, s: r.ach ? "ok" : "m" }, stLbl[r.stage] || r.stage, r.at ? r.at.replace("T", " ").slice(0, 16) : ""]));
  const S4 = head("Before and after", sub).concat([H(["Position", "When you started", "Now", "Change", "If all approved"])],
    B.BA.map((x) => { const st = x.k === "m" ? "m" : x.k === "d" ? "d" : "i"; return [x.l, { v: x.a, s: st }, { v: x.b, s: st }, { v: x.d, s: st }, { v: x.p, s: st }]; }));
  return [{ name: "Summary", cols: [22, 8, 10, 18, 18, 18, 18, 18, 18, 14], rows: S1, freeze: 4 }, { name: "By use case", cols: [40, 8, 18, 8, 10, 16, 16, 18, 18, 16], rows: S2, freeze: 4 },
    { name: "Evidence ledger", cols: [16, 30, 16, 28, 50, 30, 34, 26, 10, 15, 15, 15, 12, 18], rows: S3, freeze: 4 }, { name: "Before and after", cols: [34, 18, 18, 18, 18], rows: S4, freeze: 4 }];
}

// ---------------------------------------------------------------- PDF (A4 landscape, branded header, tables via autoTable)
function load(src) { return new Promise((ok, no) => { if (document.querySelector(`script[src="${src}"]`) && window.jspdf) return ok(); const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => no(new Error("load")); document.head.appendChild(s); }); }
async function pdfLib() {
  if (!(window.jspdf && window.jspdf.jsPDF)) await load("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  if (!(window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API.autoTable)) await load("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js");
  return window.jspdf.jsPDF;
}
const R = (v) => (v == null || !Number.isFinite(Number(v)) ? "-" : inr(v).replace("₹", "Rs ").replace("−", "-"));
const PT = (s) => String(s ?? "").replace(/₹/g, "Rs ").replace(/\s*·\s*/g, "  |  ").replace(/[–—]/g, "-").replace(/[−]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[÷]/g, "/").replace(/[×]/g, "x").replace(/[→]/g, "->").replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
function doc(J, title, sub) {
  const d = new J({ orientation: "landscape", unit: "pt", format: "a4" }), W = d.internal.pageSize.getWidth(), Hh = d.internal.pageSize.getHeight();
  const hd = () => { d.setFillColor(0, 70, 60); d.rect(0, 0, W, 56, "F"); d.setFillColor(201, 235, 149); d.rect(36, 46, 22, 2, "F");
    d.setTextColor(230, 245, 200); d.setFont("helvetica", "bold"); d.setFontSize(15); d.text(PT(title), 36, 30); d.setFont("helvetica", "normal"); d.setFontSize(9); d.setTextColor(156, 194, 182); d.text(PT(sub), 36, 42);
    d.setTextColor(230, 245, 200); d.setFont("helvetica", "bold"); d.setFontSize(11); d.text("FlowIQ", W - 36, 30, { align: "right" }); };
  const ft = () => { const n = d.internal.getNumberOfPages(); for (let i = 1; i <= n; i++) { d.setPage(i); d.setFontSize(8); d.setTextColor(120, 130, 125); d.text(PT(`${sub.split(" · ")[0]} · FlowIQ · page ${i} of ${n}`), 36, Hh - 18); d.text("Figures from Tally via FlowIQ. Confidential.", W - 36, Hh - 18, { align: "right" }); } };
  hd(); return { d, W, H: Hh, head: hd, foot: ft, y: 76 };
}
function tiles(o, items) {
  const { d, W } = o, n = Math.min(items.length, 4), gw = (W - 72 - (n - 1) * 10) / n; let x = 36, y = o.y;
  items.forEach((it, i) => {
    if (i && i % 4 === 0) { x = 36; y += 62; }
    d.setDrawColor(226, 229, 223); d.setFillColor(i % 4 === 0 && it.hero ? 228 : 250, i % 4 === 0 && it.hero ? 240 : 251, i % 4 === 0 && it.hero ? 234 : 249); d.roundedRect(x, y, gw, 54, 5, 5, "FD");
    d.setFont("helvetica", "normal"); d.setFontSize(8); d.setTextColor(92, 104, 99); d.text(PT(it.l), x + 10, y + 15);
    d.setFont("helvetica", "bold"); d.setFontSize(15); d.setTextColor(...(it.col || [15, 26, 23])); d.text(PT(it.v), x + 10, y + 34);
    d.setFont("helvetica", "normal"); d.setFontSize(7.5); d.setTextColor(120, 130, 125); d.text(PT(it.s || "").slice(0, Math.floor(gw / 3.6)), x + 10, y + 47);
    x += gw + 10;
  });
  o.y = y + 70;
}
function bars(o, title, cats, series, { h = 150 } = {}) {
  const { d, W } = o; if (o.y + h + 40 > o.H - 40) { d.addPage(); o.head(); o.y = 76; }
  d.setFont("helvetica", "bold"); d.setFontSize(11); d.setTextColor(15, 26, 23); d.text(PT(title), 36, o.y); o.y += 10;
  const L = 86, Rr = 36, top = o.y + 8, bot = o.y + h, bw = (W - L - Rr) / Math.max(1, cats.length), mx = Math.max(1, ...series.flatMap((s) => s.vals.map((v) => Math.abs(v || 0))));
  d.setDrawColor(226, 229, 223); d.setFontSize(7); d.setTextColor(120, 130, 125);
  [0, 0.5, 1].forEach((f) => { const yy = bot - (bot - top) * f; d.line(L, yy, W - Rr, yy); d.text(PT(R(mx * f)), L - 6, yy + 2, { align: "right" }); });
  const gw = Math.min(16, (bw * 0.7) / series.length);
  cats.forEach((c, i) => { const cx = L + i * bw + bw / 2, x0 = cx - (gw * series.length) / 2;
    series.forEach((s, j) => { const v = Math.max(0, s.vals[i] || 0), hh = ((bot - top) * v) / mx; d.setFillColor(...s.col); d.rect(x0 + j * gw, bot - hh, gw - 1.5, hh, "F"); });
    d.setTextColor(92, 104, 99); d.text(PT(c), cx, bot + 10, { align: "center" }); });
  let lx = L; series.forEach((s) => { d.setFillColor(...s.col); d.rect(lx, bot + 18, 8, 8, "F"); d.setTextColor(92, 104, 99); d.text(PT(s.name), lx + 12, bot + 25); lx += d.getTextWidth(PT(s.name)) + 30; });
  o.y = bot + 42;
}
function table(o, title, hd, body, opt = {}) {
  const { d } = o; if (o.y > o.H - 120) { d.addPage(); o.head(); o.y = 76; }
  if (title) { d.setFont("helvetica", "bold"); d.setFontSize(11); d.setTextColor(15, 26, 23); d.text(PT(title), 36, o.y); o.y += 6; }
  d.autoTable(Object.assign({ startY: o.y, head: [hd.map(PT)], body: body.map((r) => r.map(PT)), margin: { left: 36, right: 36, top: 70, bottom: 36 }, theme: "plain",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 4, textColor: [15, 26, 23], lineColor: [226, 229, 223], lineWidth: { bottom: 0.5 }, overflow: "linebreak" },
    headStyles: { fillColor: [0, 70, 60], textColor: [230, 245, 200], fontStyle: "bold" }, alternateRowStyles: { fillColor: [246, 247, 244] }, didDrawPage: () => o.head() }, opt,
    { didParseCell: (h) => { const cs = (opt.columnStyles || {})[h.column.index]; if (h.section === "head" && cs && cs.halign) h.cell.styles.halign = cs.halign; if (opt.didParseCell) opt.didParseCell(h); } }));
  o.y = d.lastAutoTable.finalY + 20;
}
const right = (...ix) => Object.fromEntries(ix.map((i) => [i, { halign: "right" }]));
async function finPdf(F, Bz, company) {
  const J = await pdfLib(), K = F.K, o = doc(J, "Financial Overview", `${company} · ${F.from ? fmtDate(F.from) + " to " : ""}${fmtDate(F.asOn)} · ${F.days} days`), v = (k) => (K[k].avail ? PT(fmtK(K[k].fmt, K[k].value)) : "n/a");
  tiles(o, [{ l: "Revenue (year to date)", v: R(K.revenue.value), s: K.run_rate.avail ? "run-rate " + R(K.run_rate.value) + " a year" : "", hero: 1 }, { l: "Gross margin (purchase basis)", v: v("gross_margin"), s: K.gross_profit.avail ? R(K.gross_profit.value) + " gross profit" : K.gross_margin.why },
    { l: "Cash and bank", v: R(K.cash.value), s: K.cash_cover.avail ? K.cash_cover.value.toFixed(1) + " months of payments" : "" }, { l: "Net cash movement YTD", v: R(K.net_cash.value), s: K.collection.avail ? p1(K.collection.value) + " of billing collected" : "", col: (K.net_cash.value || 0) < 0 ? [214, 64, 43] : [17, 128, 79] },
    { l: "Working capital", v: R(K.wc.value), s: K.ccc.avail ? "cycle " + d1(K.ccc.value) : "" }, { l: "DSO / DPO", v: `${K.dso.avail ? Math.round(K.dso.value) : "-"} / ${K.dpo.avail ? Math.round(K.dpo.value) : "-"} days`, s: "days sales / payables outstanding" },
    { l: "Overdue receivables", v: R(K.overdue.value), s: K.overdue_share.avail ? p1(K.overdue_share.value) + " of receivables" : "", col: [214, 64, 43] }, { l: "Trade liquidity cover", v: v("trade_liq"), s: "trade assets / payables" }]);
  if (F.LG) tiles(o, [{ l: "EBITDA", v: R(K.ebitda.value), s: K.ebitda_margin.avail ? p1(K.ebitda_margin.value) + " of revenue" : "", col: K.ebitda.value < 0 ? [214, 64, 43] : [17, 128, 79] }, { l: "Profit before tax (before stock)", v: R(K.pbt.value), s: "after depreciation and interest", col: K.pbt.value < 0 ? [214, 64, 43] : [17, 128, 79] },
    { l: "Borrowings", v: R(K.loans.value), s: K.loans_change.avail ? (K.loans_change.value >= 0 ? "up " : "down ") + R(Math.abs(K.loans_change.value)) + " this year" : "" }, { l: "Interest cover", v: K.interest_cover.avail ? x2(K.interest_cover.value) : "n/a", s: K.interest.avail ? R(K.interest.value) + " interest" : "no interest cost" }]);
  const SG = signals(F, Bz);
  if (SG.length) table(o, "What needs attention", ["", "Signal", "Detail"], SG.map((s) => [LVL[s.lvl][0], s.t, s.d]), { columnStyles: { 0: { cellWidth: 90, fontStyle: "bold" }, 1: { cellWidth: 230, fontStyle: "bold" } },
    didParseCell: (h) => { if (h.section === "body" && h.column.index === 0) { const l = SG[h.row.index].lvl; h.cell.styles.textColor = l === "risk" ? [214, 64, 43] : l === "watch" ? [165, 122, 0] : [17, 128, 79]; } } });
  bars(o, "Billing and purchases by month (vouchers, incl. GST)", F.M.map((m) => m.label), [{ name: "Billing", col: [0, 70, 60], vals: F.M.map((m) => m.sales) }, { name: "Purchases", col: [201, 182, 120], vals: F.M.map((m) => m.purchase) }]);
  bars(o, "Cash received and paid by month", F.M.map((m) => m.label), [{ name: "Received", col: [17, 128, 79], vals: F.M.map((m) => m.receipts) }, { name: "Paid out", col: [214, 64, 43], vals: F.M.map((m) => m.payments) }]);
  table(o, "Monthly detail", ["Month", "Billing", "Purchases", "Received", "Paid out", "Net cash", "Credit notes"], F.M.map((m) => [m.label, R(m.sales), R(m.purchase), R(m.receipts), R(m.payments), R((m.receipts || 0) - (m.payments || 0)), R(m.credit_notes)]).concat([["Total", R(F.sums.sb), R(F.sums.pu), R(F.sums.rc), R(F.sums.py), R(F.sums.rc - F.sums.py), R(F.sums.cn)]]),
    { columnStyles: right(1, 2, 3, 4, 5, 6), didParseCell: (h) => { if (h.section === "body" && h.row.index === F.M.length) h.cell.styles.fontStyle = "bold"; } });
  if (F.LG) {
    const Q = F.LG.pl;
    table(o, "Profit and loss, year to date (Tally ledgers; before stock adjustment and tax)", ["", "Amount", "% of revenue"], [["Revenue", Q.revenue], ["Purchases and direct costs", -Q.direct_costs], ["Gross profit (before stock)", Q.gross_profit_before_stock], ["Other income", Q.other_income], ["Operating expenses", -Q.operating_expenses], ["EBITDA", Q.ebitda], ["Depreciation", -Q.depreciation], ["Interest and finance costs", -Q.interest], ["Profit before tax (before stock)", Q.pbt_before_stock]].map(([l, val]) => [l, R(val), p1((Math.abs(val) / (Q.revenue || 1)) * 100)]),
      { tableWidth: 420, columnStyles: right(1, 2), didParseCell: (h) => { if (h.section === "body" && [0, 2, 5, 8].includes(h.row.index)) h.cell.styles.fontStyle = "bold"; } });
    bars(o, "EBITDA by month (before stock movement)", F.LM.map((m) => m.label), [{ name: "EBITDA", col: [17, 128, 79], vals: F.LM.map((m) => Math.max(0, m.ebitda)) }, { name: "Negative EBITDA (shown as size)", col: [214, 64, 43], vals: F.LM.map((m) => Math.max(0, -m.ebitda)) }]);
    table(o, "Largest expenses", ["Ledger", "Group", "Year to date", "% of revenue"], F.LG.expenses.filter((e) => e.amount > 0).slice(0, 15).map((e) => [e.ledger, e.group, R(e.amount), p1((e.amount / (Q.revenue || 1)) * 100)]), { columnStyles: right(2, 3) });
  }
  table(o, "Metrics, formulas and sources", ["Metric", "Value", "How it is calculated", "Source"], Object.values(K).map((k) => [k.label, k.avail ? fmtK(k.fmt, k.value) : "Not available", k.avail ? k.formula : k.why, k.src]), { columnStyles: { 0: { cellWidth: 150, fontStyle: "bold" }, 1: { cellWidth: 90, halign: "right" } } });
  table(o, "Receivables by age", ["Age", "Amount", "Share"], F.B.map((b) => [b.bucket, R(b.amount), p1((b.amount / (F.sums.tot || 1)) * 100)]), { tableWidth: 300, columnStyles: right(1, 2) });
  if (F.top.length) table(o, "Largest overdue customers (open)", ["Customer", "Overdue", "Share of overdue"], F.top.slice(0, 15).map((t) => [t.party, R(t.overdue), p1((t.overdue / (F.sums.od || 1)) * 100)]), { columnStyles: right(1, 2) });
  table(o, "What this data cannot show yet", ["Item", "Why"], F.NA.map((n) => [n.label, n.why]), { columnStyles: { 0: { cellWidth: 200, fontStyle: "bold" } } });
  o.foot(); return o.d.output("blob");
}
async function bizPdf(B, company) {
  const J = await pdfLib(), T = B.tot, o = doc(J, "Business Impact", `${company} · ${B.label}`), M = (k) => B.byM[k];
  tiles(o, [{ l: "Achieved", v: R(T.ach), s: `${T.closed} of ${T.n} issues approved`, hero: 1, col: [17, 128, 79] }, { l: "Potential (if all approved)", v: R(T.pot), s: T.pot ? Math.round((T.achAll / T.pot) * 100) + "% of potential achieved" : "" }, { l: "Identified (at stake)", v: R(T.stake), s: R(T.actioned) + " actioned" }, { l: "Still open", v: R(T.open), s: T.openN + " open items" },
    ...OUTCOME_KEYS.map((k) => ({ l: OUTCOMES[k][0], v: R(M(k).ach), s: "of " + R(M(k).pot) + " potential", col: k === "risk_prevented" ? [176, 71, 106] : [17, 128, 79] }))]);
  table(o, "Before and after", ["Position", "When you started", "Now", "Change", "If all approved"], B.BA.map((x) => { const f2 = (v) => (x.k === "m" ? R(v) : x.k === "d" ? d1(v) : v == null ? "-" : String(Math.round(v))); return [x.l, f2(x.a), f2(x.b), x.d ? (x.d > 0 ? "+" : "-") + f2(Math.abs(x.d)) + (x.d * x.good > 0 ? "  (better)" : "  (worse)") : "no change", f2(x.p)]; }),
    { columnStyles: right(1, 2, 3, 4), didParseCell: (h) => { if (h.section === "body" && h.column.index === 3) { const x = B.BA[h.row.index]; if (x.d) h.cell.styles.textColor = x.d * x.good > 0 ? [17, 128, 79] : [214, 64, 43]; } } });
  bars(o, "Identified, potential and achieved by outcome", OUTCOME_KEYS.map((k) => OUTCOMES[k][0]), [{ name: "Identified", col: [156, 194, 182], vals: OUTCOME_KEYS.map((k) => M(k).stake) }, { name: "Potential", col: [201, 182, 120], vals: OUTCOME_KEYS.map((k) => M(k).pot) }, { name: "Achieved", col: [17, 128, 79], vals: OUTCOME_KEYS.map((k) => M(k).ach) }]);
  table(o, "Impact by use case", ["Use case", "Outcome", "Items", "Identified", "Potential", "Achieved", "Still open"], B.byU.map((u) => [u.name + " (" + u.uc + ")", OUTCOMES[u.metric][0], `${u.closed}/${u.n} approved`, R(u.stake), R(u.pot), R(u.achAll), R(u.open)]), { columnStyles: right(3, 4, 5, 6) });
  const top = B.rows.filter((r) => r.achP > 0).sort((a, b) => b.achP - a.achP);
  if (top.length) table(o, "Value achieved, item by item (evidence trail)", ["Party", "Issue", "Use case", "Vouchers", "Evidence", "Achieved"], top.map((r) => [r.party, r.title, r.ucn, r.refs, r.evid, R(r.achP)]), { columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 200 }, 3: { cellWidth: 120 }, 5: { halign: "right", fontStyle: "bold" } } });
  table(o, "Open items still at stake", ["Party", "Issue", "Use case", "At stake", "Severity"], B.rows.filter((r) => r.stage !== "Approved").sort((a, b) => b.stake - a.stake).slice(0, 40).map((r) => [r.party, r.title, r.ucn, R(r.stake), r.severity]), { columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 260 }, 3: { halign: "right" } } });
  o.foot(); return o.d.output("blob");
}

// kind: "fin" | "biz"; fmt: "pdf" | "xlsx"
export async function exportReport(kind, fmt, { F, Bz, company, co }) {
  const base = `FlowIQ_${kind === "fin" ? "Financial_Overview" : "Business_Impact"}_${safe(company || co)}_${today()}`;
  if (fmt === "xlsx") { save(xlsx(kind === "fin" ? finSheets(F, Bz, company) : bizSheets(Bz, company), base), base + ".xlsx"); return base + ".xlsx"; }
  const blob = kind === "fin" ? await finPdf(F, Bz, company) : await bizPdf(Bz, company);
  save(blob, base + ".pdf"); return base + ".pdf";
}
