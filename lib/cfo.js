// CFO reporting models: Financial Overview and Business Impact.
// One model per company, built only from that company's own seed (seedFull) and, where it exists, the profit and loss
// rebuilt from its Tally ledgers by gen_financials.py (lib/financials.json). The screens and the PDF / Excel exports read
// the same model, so every exported figure is the figure on screen. Every metric checks that its inputs exist and is marked
// "not available" (with the reason) instead of showing a misleading zero.
import FINANCIALS from "./financials.json";
import { OWN_UCS, UC, compute, findingsOf, impactOf, inr, seedFull, seedMeta } from "./engine";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const num = (x) => { if (x === null || x === undefined || x === "") return null; const v = Number(x); return Number.isFinite(v) ? v : null; };
const sum = (a, f) => a.reduce((t, x) => t + (num(f(x)) || 0), 0);
export const p1 = (v) => (v == null ? "—" : (Math.round(v * 10) / 10).toFixed(1) + "%");
export const d1 = (v) => (v == null ? "—" : (Math.round(v * 10) / 10).toFixed(1) + " days");
export const x2 = (v) => (v == null ? "—" : (Math.round(v * 100) / 100).toFixed(2) + "×");
export const fmtDate = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || "")); return m ? `${Number(m[3])} ${MON[Number(m[2]) - 1]} ${m[1]}` : String(d || ""); };
export const monName = (p) => { const m = /^(\d{4})-(\d{2})/.exec(String(p || "")); return m ? MON[Number(m[2]) - 1] + " " + m[1].slice(2) : String(p || ""); };
export const fmtK = (k, v) => (v == null ? "—" : k === "m" ? inr(v) : k === "p" ? p1(v) : k === "d" ? d1(v) : k === "x" ? x2(v) : k === "mo" ? (Math.round(v * 10) / 10).toFixed(1) + " months" : String(v));
const addDays = (iso, n) => { const t = Date.parse(iso); if (!Number.isFinite(t)) return ""; return new Date(t + n * 864e5).toISOString().slice(0, 10); };

// ---------------------------------------------------------------- months: sorted, with a flag on a month that is still running
function months(co) {
  const asOn = String(seedMeta.asOf || "").slice(0, 10), cn = (FINANCIALS.companies[co] || {}).credit_notes || {};
  return (seedFull.monthly || []).filter((m) => m && /^\d{4}-\d{2}/.test(m.m)).slice().sort((a, b) => (a.m < b.m ? -1 : 1)).map((m) => {
    const y = Number(m.m.slice(0, 4)), mo = Number(m.m.slice(5, 7)), dim = new Date(y, mo, 0).getDate();
    const partial = asOn.slice(0, 7) === m.m && Number(asOn.slice(8, 10)) < dim;
    return { period: m.m, label: monName(m.m), sales: num(m.sales), purchase: num(m.purchases), receipts: num(m.receipts), payments: num(m.payments),
      credit_notes: m.m in cn ? num(cn[m.m]) : null, partial, daysIn: partial ? Number(asOn.slice(8, 10)) : dim, dim };
  });
}

// ---------------------------------------------------------------- FINANCIAL OVERVIEW model
// `now` and `base` are compute() results: cash, receivables, overdue and DSO follow the approvals, as everywhere else in the dashboard.
export function FIN(co, state, now, base) {
  const P = seedFull.position || {}, M = months(co), full = M.filter((m) => !m.partial), K0 = now.kpi, B0 = base.kpi;
  const asOn = String(seedMeta.asOf || "").slice(0, 10), from = String(P.period_from || "").slice(0, 10), days = num(P.days) || null;
  const has = (k) => num(P[k]) != null;
  const K = {}, NA = [];
  const add = (key, o) => { K[key] = Object.assign({ key, avail: o.value != null }, o); if (o.value == null && o.why) NA.push({ key, label: o.label, why: o.why }); return K[key]; };
  const src = "Tally trial balance rebuilt by FlowIQ" + (asOn ? " · as on " + fmtDate(asOn) : "");
  const live = "Tally, updated by the actions you approve";
  const LX = FINANCIALS.companies[co], LG = LX && LX.pl ? LX : null, Q = LG ? LG.pl : {}, BS = LG ? LG.bs : {}, CK = LG ? LG.checks : {};
  // revenue and margin (trial-balance basis: net of GST)
  const rev = has("revenue") && P.revenue > 0 ? P.revenue : null, pur = LG ? num(Q.direct_costs) : null;
  add("revenue", { label: "Revenue (year to date)", value: rev, fmt: "m", src, formula: "Sales ledgers in the trial balance, " + (from ? fmtDate(from) : "period start") + " to " + fmtDate(asOn), why: "No sales in the trial balance" });
  add("run_rate", { label: "Annualised revenue run-rate", value: rev && days ? (rev / days) * 365 : null, fmt: "m", src, formula: `Revenue ÷ ${days || "?"} days × 365`, why: "Needs revenue and the period length" });
  add("direct", { label: "Purchases and direct costs", value: pur, fmt: "m", src: LG ? "Tally ledgers (gen_financials)" : src, formula: "Purchase and direct-expense ledgers", why: "Purchase and direct-cost ledgers are not in the reporting data for this company" });
  // with the ledger P&L, gross profit is the ledgers' own (revenue there excludes other income); otherwise revenue − purchases
  const gpRev = LG && num(Q.revenue) ? Q.revenue : rev;
  const gp = LG && num(Q.gross_profit_before_stock) != null ? Q.gross_profit_before_stock : rev != null && pur != null ? rev - pur : null;
  add("gross_profit", { label: "Gross profit (purchase basis)", value: gp, fmt: "m", src, formula: "Revenue − purchases and direct costs. Stock movement is not included because closing stock is not in the data.", why: "Needs revenue and purchases" });
  add("gross_margin", { label: "Gross margin (purchase basis)", value: gp != null && gpRev ? (gp / gpRev) * 100 : null, fmt: "p", src, formula: "Gross profit ÷ revenue (sales and direct incomes)", why: "Needs revenue and purchases" });
  // billing, collections and cash movement (voucher basis: values include GST)
  const sb = sum(M, (m) => m.sales), rc = sum(M, (m) => m.receipts), py = sum(M, (m) => m.payments), pu = sum(M, (m) => m.purchase);
  const hasCN = M.some((m) => m.credit_notes != null), cn = sum(M, (m) => m.credit_notes);
  const vsrc = "Tally vouchers by month (values include GST)";
  add("billing", { label: "Billing (vouchers, incl. GST)", value: M.length ? sb : null, fmt: "m", src: vsrc, formula: "Sum of sales vouchers by month", why: "No monthly sales vouchers" });
  add("receipts", { label: "Cash received", value: M.length ? rc : null, fmt: "m", src: vsrc, formula: "Sum of receipt vouchers", why: "No monthly receipt vouchers" });
  add("payments", { label: "Cash paid out", value: M.length ? py : null, fmt: "m", src: vsrc, formula: "Sum of payment vouchers", why: "No monthly payment vouchers" });
  add("net_cash", { label: "Net cash movement (year to date)", value: M.length ? rc - py : null, fmt: "m", src: vsrc, formula: "Cash received − cash paid out (all receipt and payment vouchers)", why: "No monthly receipts and payments" });
  add("collection", { label: "Collections as % of billing", value: sb ? (rc / sb) * 100 : null, fmt: "p", src: vsrc, formula: "Cash received ÷ billing, both including GST", why: "No billing in the period" });
  add("credit_note_ratio", { label: "Credit notes as % of billing", value: sb && hasCN ? (cn / sb) * 100 : null, fmt: "p", src: vsrc, formula: "Credit notes ÷ billing", why: "Credit notes by month are not in the reporting data for this company" });
  const avgPay = full.length ? sum(full, (m) => m.payments) / full.length : null;
  // liquidity and working capital (cash, receivables, overdue and DSO move with your approvals)
  const cash = num(K0.cash), rcv = num(K0.receivables), pay = has("payables") ? P.payables : null, av = num(P.advances_to_vendors) || 0;
  add("cash", { label: "Cash and bank", value: cash, fmt: "m", src: live, formula: "Cash-in-hand and bank ledgers (closing balance), plus collections you approved", why: "No cash or bank ledgers" });
  add("cash_cover", { label: "Cash cover", value: cash != null && avgPay ? cash / avgPay : null, fmt: "mo", src: live + " · vouchers", formula: `Cash and bank ÷ average monthly payments (${full.length} full month${full.length === 1 ? "" : "s"}: ${avgPay != null ? inr(avgPay) : "—"})`, why: "Needs cash and at least one full month of payments" });
  add("receivables", { label: "Receivables", value: rcv, fmt: "m", src: live, formula: "Sundry debtors (closing balance), less collections you approved", why: "No debtor ledgers" });
  add("payables", { label: "Payables", value: pay, fmt: "m", src, formula: "Sundry creditors (closing balance)", why: "No creditor ledgers" });
  add("wc", { label: "Working capital", value: has("working_capital") ? P.working_capital : null, fmt: "m", src, formula: "Current assets − current liabilities, as rebuilt from the trial balance. A collection turns receivables into cash, so it does not change the total.", why: "Working capital was not computed for this company" });
  add("trade_liq", { label: "Trade liquidity cover", value: cash != null && rcv != null && pay ? (cash + rcv + av) / pay : null, fmt: "x", src, formula: "(Cash + receivables + advances to suppliers) ÷ payables. Loans and other liabilities are not included.", why: "Needs cash, receivables and payables" });
  add("dso", { label: "Days sales outstanding", value: num(K0.dso), fmt: "d", src: live, formula: "Receivables ÷ net sales of the last 90 days × 90", why: "Needs sales and receivables" });
  add("dpo", { label: "Days payables outstanding", value: has("dpo") ? P.dpo : null, fmt: "d", src, formula: "Payables ÷ annual purchases × 365", why: "Needs purchases and payables" });
  add("inventory", { label: "Inventory", value: null, fmt: "m", src, formula: "Closing stock", why: "Closing stock is not kept in the reporting data (stock value reads 0)" });
  add("dio", { label: "Days inventory outstanding", value: null, fmt: "d", src, formula: "Inventory ÷ cost of sales × 365", why: "Needs closing stock" });
  add("ccc", { label: "Cash conversion cycle (DSO − DPO)", value: K.dso.value != null && K.dpo.value != null ? K.dso.value - K.dpo.value : null, fmt: "d", src, formula: "DSO − DPO (stock days not available)", why: "Needs DSO and DPO" });
  add("duties", { label: "Duties and taxes (net)", value: has("duties_taxes_net") ? P.duties_taxes_net : null, fmt: "m", src, formula: "Duties and taxes ledgers, net, as in Tally", why: "No duties and taxes ledgers" });
  // receivables quality (live: collections you approve clear the oldest bills first)
  const B = (now.ageing || []).map((b) => ({ bucket: String(b.bucket), amount: num(b.amount) || 0 }));
  const tot = sum(B, (b) => b.amount), od = num(K0.overdue) || 0, o60 = num(K0.over60) || 0;
  const gsrc = "Bill-wise receivables from Tally, updated by your approvals";
  add("overdue", { label: "Overdue receivables", value: B.length ? od : null, fmt: "m", src: gsrc, formula: "Bills past their due date", why: "No bill-wise receivables" });
  add("overdue_share", { label: "Overdue share", value: tot ? (od / tot) * 100 : null, fmt: "p", src: gsrc, formula: "Overdue ÷ all open bills", why: "No bill-wise receivables" });
  add("over60", { label: "Over 60 days", value: B.length ? o60 : null, fmt: "m", src: gsrc, formula: "Bills more than 60 days past due", why: "No bill-wise receivables" });
  // largest overdue customers: the open collection findings (UC1), by party
  const byP = {};
  for (const f of findingsOf(state)) if (f.uc === "UC1" && f.kind === "cash" && !state.approved[f.id]) byP[f.party] = (byP[f.party] || 0) + (Number(f.amount) || 0);
  const top = Object.entries(byP).map(([party, overdue]) => ({ party, overdue })).filter((t) => t.overdue > 0).sort((a, b) => b.overdue - a.overdue);
  add("concentration", { label: "Largest overdue customer", value: top.length && od ? Math.min(100, (top[0].overdue / od) * 100) : null, fmt: "p", src: gsrc, formula: top[0] ? top[0].party + " ÷ all overdue" : "Largest customer ÷ all overdue", why: "No overdue customers open" });
  // profit and funding: from the ledger rebuild (lib/financials.json), when it exists for this company
  const lsrc = LG ? `Tally ledgers and vouchers · ${CK.vouchers} vouchers, ${fmtDate(CK.from)} to ${fmtDate(CK.to)}` : "";
  const lwhy = "The ledger-level profit and loss has not been built for this company yet";
  const lv = (k) => (LG && num(Q[k]) != null ? Q[k] : null), bv = (k) => (LG && num(BS[k]) != null ? BS[k] : null);
  const rv = lv("revenue");
  add("ebitda", { label: "EBITDA", value: lv("ebitda"), fmt: "m", src: lsrc, formula: "Gross profit + other income − operating expenses (indirect expenses excluding depreciation and interest)", why: lwhy });
  add("ebitda_margin", { label: "EBITDA margin", value: rv && lv("ebitda") != null ? (Q.ebitda / rv) * 100 : null, fmt: "p", src: lsrc, formula: "EBITDA ÷ revenue", why: lwhy });
  add("opex", { label: "Operating expenses", value: lv("operating_expenses"), fmt: "m", src: lsrc, formula: "Indirect expenses excluding depreciation and interest", why: lwhy });
  add("opex_ratio", { label: "Operating expenses as % of revenue", value: rv && lv("operating_expenses") != null ? (Q.operating_expenses / rv) * 100 : null, fmt: "p", src: lsrc, formula: "Operating expenses ÷ revenue", why: lwhy });
  add("depreciation", { label: "Depreciation", value: lv("depreciation"), fmt: "m", src: lsrc, formula: "Indirect-expense ledgers named depreciation or amortisation", why: lwhy });
  add("interest", { label: "Interest and finance costs", value: lv("interest"), fmt: "m", src: lsrc, formula: "Indirect-expense ledgers named interest or finance cost", why: lwhy });
  add("pbt", { label: "Profit before tax (before stock)", value: lv("pbt_before_stock"), fmt: "m", src: lsrc, formula: "EBITDA − depreciation − interest. Before the closing-stock adjustment and tax.", why: lwhy });
  add("pbt_margin", { label: "Pre-tax margin (before stock)", value: rv && lv("pbt_before_stock") != null ? (Q.pbt_before_stock / rv) * 100 : null, fmt: "p", src: lsrc, formula: "Profit before tax ÷ revenue", why: lwhy });
  add("interest_cover", { label: "Interest cover", value: lv("interest") ? Q.ebit / Q.interest : null, fmt: "x", src: lsrc, formula: "EBIT ÷ interest and finance costs", why: LG ? "No interest cost in the period" : lwhy });
  add("loans", { label: "Borrowings", value: bv("loans_total"), fmt: "m", src: lsrc, formula: "Loans (Liability) group: secured, unsecured and bank overdraft / cash credit", why: lwhy });
  add("loans_change", { label: "Change in borrowings this year", value: LG ? (BS.loans_total || 0) - (BS.loans_total_open || 0) : null, fmt: "m", src: lsrc, formula: `Borrowings now (${inr(BS.loans_total)}) − at the start of the year (${inr(BS.loans_total_open)})`, why: lwhy });
  const nd = LG ? (BS.loans_total || 0) - (BS.cash_bank || 0) : null;
  add("net_debt", { label: nd != null && nd < 0 ? "Net cash" : "Net debt", value: nd != null && nd < 0 ? -nd : nd, fmt: "m", src: lsrc, formula: nd != null && nd < 0 ? "Cash and bank − borrowings (cash exceeds borrowings)" : "Borrowings − cash and bank", why: lwhy });
  const cdays = LG ? Math.max(1, Math.round((Date.parse(CK.to) - Date.parse(CK.from)) / 864e5) + 1) : days;
  const ebA = lv("ebitda") != null && cdays ? (Q.ebitda / cdays) * 365 : null;
  add("debt_ebitda", { label: "Borrowings ÷ annualised EBITDA", value: bv("loans_total") && ebA > 0 ? BS.loans_total / ebA : null, fmt: "x", src: lsrc, formula: `Borrowings ÷ (EBITDA ÷ ${cdays} days × 365)`, why: !LG ? lwhy : !BS.loans_total ? "No borrowings" : "EBITDA is negative" });
  add("fixed_assets", { label: "Fixed assets (net)", value: bv("fixed_assets_net") || null, fmt: "m", src: lsrc, formula: "Fixed Assets group net of accumulated depreciation", why: LG ? "No fixed-asset ledgers" : lwhy });
  // what the data cannot tell (always listed, so nobody reads a blank as zero)
  if (!LG) [["EBITDA and operating profit", "Indirect expenses are not in the reporting data for this company"], ["Debt and interest cover", "Loans and finance costs are not in the reporting data for this company"]].forEach(([l, w]) => NA.push({ key: "x_" + l, label: l, why: w }));
  NA.push({ key: "x_tax", label: "Profit after tax", why: "Tax provision and the closing-stock adjustment are not booked in the ledgers yet; profit is shown before both" });
  NA.push({ key: "x_daily", label: "Daily position history", why: "End-of-day snapshots come from the daily run; this workshop copy holds the position at one date" });
  if (LG && Math.abs(CK.opening_difference || 0) >= 1) NA.push({ key: "x_open", label: "Balance sheet tie-out", why: `Opening balances in Tally differ by ${inr(Math.abs(CK.opening_difference))} (usually opening stock or brought-forward profit not entered); funding figures use the ledgers as they stand` });
  if (LG && rev != null && Math.abs((Q.revenue || 0) - rev) > 1 && Math.abs((Q.revenue || 0) + (Q.other_income || 0) - rev) > 1) NA.push({ key: "x_rev", label: "Revenue cross-check", why: `Ledger revenue ${inr(Q.revenue)} differs from the trial-balance revenue ${inr(rev)}` });
  const LM = LG ? (LG.monthly || []).map((m) => Object.assign({ label: monName(m.period), partial: (M.find((x) => x.period === m.period) || {}).partial }, m)) : [];
  const otherIn = LG && rev != null && Math.abs((Q.revenue || 0) + (Q.other_income || 0) - rev) <= 1 && (Q.other_income || 0) > 1 ? Q.other_income : 0;
  return { co, otherIn, P, M, full, B, top, K, NA, asOn, from, days, avgPay, LG, LM, base: B0, sums: { sb, rc, py, cn, pu, tot, od, o60 } };
}

// ---------------------------------------------------------------- signals: what a CFO should look at, ranked
export const LVL = { risk: ["Needs attention", "var(--crit)"], watch: ["Watch", "var(--med)"], good: ["Strength", "var(--ok)"] };
export function signals(F, Bz) {
  const out = [], K = F.K, full = F.full, L = full[full.length - 1], add = (lvl, t, d, k) => out.push({ lvl, t, d, k });
  if (L && L.payments != null && L.receipts != null && L.payments > L.receipts) add("risk", `Cash out exceeded cash in during ${L.label}`, `${inr(L.payments)} paid against ${inr(L.receipts)} received: a net outflow of ${inr(L.payments - L.receipts)}.`, "net_cash");
  if (K.cash_cover.value != null) {
    const v = K.cash_cover.value;
    if (v < 1) add("risk", "Cash covers less than a month of payments", `${inr(K.cash.value)} in cash and bank against average monthly payments of ${inr(F.avgPay)}.`, "cash_cover");
    else if (v >= 2.5) add("good", `Cash covers ${v.toFixed(1)} months of payments`, `${inr(K.cash.value)} in cash and bank. Surplus cash may be earning less than it could.`, "cash_cover");
  }
  if (K.ccc.value != null) {
    const v = K.ccc.value;
    if (v > 30) add("risk", `Customers are funded for ${Math.round(v)} days longer than suppliers fund you`, `DSO ${d1(K.dso.value)} vs DPO ${d1(K.dpo.value)}. Each day taken off DSO frees about ${inr((K.revenue.value || 0) / (F.days || 365))} of cash.`, "ccc");
    else if (v < 0) add("good", "Suppliers fund the trading cycle", `DPO ${d1(K.dpo.value)} is longer than DSO ${d1(K.dso.value)}.`, "ccc");
  }
  if (K.overdue_share.value != null && K.overdue_share.value > 35) add("risk", `${p1(K.overdue_share.value)} of receivables are overdue`, `${inr(K.overdue.value)} is past due; ${inr(K.over60.value)} of it by more than 60 days.`, "overdue");
  else if (K.over60.value && K.receivables.value && K.over60.value / K.receivables.value > 0.05) add("watch", "Receivables ageing past 60 days", `${inr(K.over60.value)} is more than 60 days overdue.`, "over60");
  if (K.concentration.value != null && K.concentration.value >= 25 && F.top[0]) add("watch", `${F.top[0].party} holds ${p1(K.concentration.value)} of all overdue`, `${inr(F.top[0].overdue)} overdue from one customer.`, "concentration");
  if (full.length >= 4) {
    const l = full[full.length - 1], prev = full.slice(-4, -1), avg = sum(prev, (m) => m.sales) / prev.length;
    if (avg && l.sales != null) {
      const ch = ((l.sales - avg) / avg) * 100;
      if (ch >= 10) add("good", `Billing in ${l.label} was ${p1(ch)} above the 3-month average`, `${inr(l.sales)} against an average of ${inr(avg)}.`, "billing");
      else if (ch <= -10) add("risk", `Billing in ${l.label} was ${p1(-ch)} below the 3-month average`, `${inr(l.sales)} against an average of ${inr(avg)}.`, "billing");
    }
    const cr = (m) => (m.sales ? ((m.credit_notes || 0) / m.sales) * 100 : 0), avc = sum(prev, cr) / prev.length;
    if (l.credit_notes != null && cr(l) > 2 && cr(l) > avc * 1.5) add("watch", `Credit notes rose to ${p1(cr(l))} of billing in ${l.label}`, `The previous 3 months averaged ${p1(avc)}. Returns or price disputes are eroding revenue.`, "credit_note_ratio");
  }
  full.slice(-2).forEach((m) => { if (m.purchase != null && m.sales != null && m.purchase > m.sales) add("watch", `Purchases exceeded billing in ${m.label}`, `${inr(m.purchase)} bought against ${inr(m.sales)} billed: a stock build-up or a margin squeeze.`, "direct"); });
  if (F.base && Math.abs(F.K.dso.value - F.base.dso) >= 1) { const a = F.base.dso, b = F.K.dso.value; add(b < a ? "good" : "risk", `DSO ${b < a ? "improved" : "worsened"} from ${d1(a)} to ${d1(b)}`, "Since you started approving actions in this workspace.", "dso"); }
  if (F.LG) {
    if (K.ebitda.value != null && K.ebitda.value < 0) add("risk", `Operating at a loss: EBITDA −${inr(-K.ebitda.value)}`, `Operating expenses of ${inr(K.opex.value)} are more than the gross profit of ${inr(F.LG.pl.gross_profit_before_stock)} plus other income.`, "ebitda");
    else if (K.pbt.value != null && K.pbt.value < 0) add("risk", `Pre-tax loss of ${inr(-K.pbt.value)} after depreciation and interest`, `EBITDA is ${inr(K.ebitda.value)} (${p1(K.ebitda_margin.value)}), but depreciation of ${inr(K.depreciation.value)} and interest of ${inr(K.interest.value)} take it below zero. Figures are before the closing-stock adjustment.`, "pbt");
    else if (K.ebitda_margin.value != null && K.ebitda_margin.value >= 15) add("good", `EBITDA margin of ${p1(K.ebitda_margin.value)}`, `${inr(K.ebitda.value)} of EBITDA; ${inr(K.pbt.value)} before tax and stock adjustment.`, "ebitda_margin");
    const lc = K.loans_change.value, cashUp = F.LG.bs.cash_bank - F.LG.bs.cash_bank_open;
    if (lc != null && lc > 0 && lc >= 0.1 * Math.max(1, F.LG.bs.loans_total_open || 0)) add("watch", `Borrowings rose by ${inr(lc)} this year`, `From ${inr(F.LG.bs.loans_total_open)} to ${inr(F.LG.bs.loans_total)}.${cashUp > 0 ? ` Cash rose ${inr(cashUp)} over the same period, so ${cashUp <= lc ? "the whole" : "part of the"} cash build-up is borrowed money.` : ""}`, "loans_change");
    else if (lc != null && lc < 0) add("good", `Borrowings reduced by ${inr(-lc)} this year`, `Now ${inr(F.LG.bs.loans_total)}.`, "loans_change");
    if (K.interest_cover.value != null && K.interest_cover.value < 3) add("risk", `Interest cover is only ${x2(K.interest_cover.value)}`, `Operating profit after depreciation covers interest of ${inr(K.interest.value)} ${K.interest_cover.value < 0 ? "not at all" : "less than three times"}.`, "interest_cover");
    const lf = F.LM.filter((m) => !m.partial), lm = lf[lf.length - 1];
    if (lm && lm.ebitda < 0 && !(K.ebitda.value < 0)) add("watch", `EBITDA was negative in ${lm.label}`, `${inr(lm.ebitda)} for the month, before stock movement: a month of heavy buying can show this.`, "ebitda");
    if (Math.abs(F.LG.checks.opening_difference || 0) >= 1) add("watch", "Opening balances in Tally do not tally", `They differ by ${inr(Math.abs(F.LG.checks.opening_difference))}. Usually opening stock or brought-forward profit was not entered. Ask the accountant to correct it.`, "loans");
  }
  if (Bz) { const r = Bz.byM.risk_prevented; if (r && r.open > 0) add("watch", `${inr(r.open)} of control and credit exposure is still open`, `${r.openN} open risk item${r.openN === 1 ? "" : "s"} from FlowIQ checks. Open Business Impact for the list.`, "biz:risk_prevented"); }
  const rank = { risk: 0, watch: 1, good: 2 };
  return out.sort((a, b) => rank[a.lvl] - rank[b.lvl]);
}

// ---------------------------------------------------------------- BUSINESS IMPACT model
// The four outcome metrics of the FlowIQ rules (config/rules.yaml, outcome_mapping): each use case feeds exactly one.
export const OUTCOMES = { cash_released: ["Cash released", "#0F7A62"], cost_saved: ["Cost saved", "#3B5FC0"], margin_protected: ["Margin protected", "#B7791F"], risk_prevented: ["Risk prevented", "#B0476A"] };
export const OUTCOME_KEYS = Object.keys(OUTCOMES);
const UC_METRIC = { UC1: "cash_released", UC2: "risk_prevented", UC3: "risk_prevented", UC4: "cost_saved", UC5: "cash_released", UC6: "cost_saved", UC7: "cost_saved", UC8: "cash_released", UC9: "cost_saved", UC10: "cost_saved", UC11: "risk_prevented", UC12: "cash_released", UC13: "risk_prevented", UC14: "cost_saved", UC15: "risk_prevented", UC16: "cost_saved", UC17: "risk_prevented", UC18: "risk_prevented", UC19: "risk_prevented", UC20: "cash_released", UC21: "risk_prevented", UC22: "risk_prevented", UC23: "risk_prevented", UC24: "cost_saved", UC25: "margin_protected", UC26: "risk_prevented", UC27: "cash_released", UC28: "margin_protected", UC29: "margin_protected", UC30: "margin_protected", UC31: "margin_protected", UC32: "margin_protected", UC33: "margin_protected", UC34: "margin_protected", UC36: "risk_prevented", UC37: "risk_prevented", UC38: "risk_prevented", UC39: "risk_prevented", UC40: "margin_protected", UC41: "cash_released", UC42: "risk_prevented", UC47: "cost_saved", UC48: "cost_saved", UC49: "cost_saved", UC50: "margin_protected", UC51: "risk_prevented", UC52: "risk_prevented", UC54: "risk_prevented" };
const KIND_METRIC = { cash: "cash_released", saved: "cost_saved", interest: "cost_saved", protect: "risk_prevented" };
// A company with its own check names (UC numbers mean something else there) is classified by the kind of money each finding moves.
export const metricOf = (f) => (!OWN_UCS && UC_METRIC[f.uc]) || KIND_METRIC[f.kind] || "risk_prevented";
export const valueOf = (f, inputs) => { const i = impactOf(f, inputs); return i.cash + i.saved + i.protect; };
export const BIZ_PERIODS = [["all", "All to date"], ["today", "Today"], ["week", "Last 7 days"], ["month", "This month"]];
export function periodFrom(p) {
  const d = new Date();
  if (p === "today") { d.setHours(0, 0, 0, 0); return d; }
  if (p === "week") return new Date(Date.now() - 7 * 864e5);
  if (p === "month") { d.setDate(1); d.setHours(0, 0, 0, 0); return d; }
  return null;
}

export function BIZ(state, list, period = "all") {
  const from = periodFrom(period), label = (BIZ_PERIODS.find((x) => x[0] === period) || BIZ_PERIODS[0])[1];
  const inP = (id) => !!state.approved[id] && (!from || new Date(state.approved[id]) >= from);
  const rows = list.map((f) => {
    const v = valueOf(f, state.inputs), i = impactOf(f, state.inputs), approved = !!state.approved[f.id];
    return { id: f.id, f, uc: f.uc, ucn: UC[f.uc]?.name || f.uc, metric: metricOf(f), party: f.party, title: f.title || f.label || f.action, action: f.action,
      refs: Array.isArray(f.refs) ? f.refs.join(", ") : String(f.refs || ""), evid: f.evidence && typeof f.evidence === "object" ? String(f.evidence.label || "") : String(f.evidence || ""),
      stake: Number(f.amount) || 0, exp: v, estd: v > 0, nocash: f.kind === "protect", collected: i.collected,
      stage: approved ? "Approved" : "Open", at: state.approved[f.id] || "", ach: approved ? v : 0, achP: inP(f.id) ? v : 0, severity: f.severity };
  });
  const blank = () => ({ n: 0, closed: 0, stake: 0, pot: 0, actioned: 0, ach: 0, achAll: 0, open: 0, openN: 0, closedStake: 0 });
  const byM = {}, byU = {};
  OUTCOME_KEYS.forEach((k) => (byM[k] = blank()));
  rows.forEach((r) => {
    [byM[r.metric], (byU[r.uc] = byU[r.uc] || Object.assign(blank(), { uc: r.uc, name: r.ucn, metric: r.metric }))].forEach((t) => {
      t.n++; t.stake += r.stake; t.pot += r.exp; t.ach += r.achP; t.achAll += r.ach;
      if (r.stage === "Approved") { t.closed++; t.closedStake += r.stake; t.actioned += r.stake; } else { t.open += r.stake; t.openN++; }
    });
  });
  const tot = Object.values(byM).reduce((t, m) => { Object.keys(t).forEach((k) => (t[k] += m[k])); return t; }, blank());
  // before and after: the position when you started, now, and if every open action were approved
  const base = compute({ ...state, approved: {} }).kpi, now = compute(state).kpi;
  const all = {}; for (const f of list) all[f.id] = state.approved[f.id] || "projected";
  const proj = compute({ ...state, approved: all }).kpi;
  const BA = [["Overdue receivables", "overdue", "m", -1], ["Receivables over 60 days", "over60", "m", -1], ["Days sales outstanding", "dso", "d", -1], ["Cash and bank", "cash", "m", 1],
    ["Receivables", "receivables", "m", -1], ["Money still at stake", "atStake", "m", -1], ["Saved and risk stopped", "value", "m", 1], ["Actions approved", "done", "n", 1]]
    .map(([l, k, f, good]) => ({ l, k: f, good, a: base[k], b: now[k], p: proj[k], d: now[k] - base[k] }));
  // value over time: cumulative value of the approvals, in the order they were made
  const done = rows.filter((r) => r.at && (!from || new Date(r.at) >= from)).sort((a, b) => (a.at < b.at ? -1 : 1));
  let c = 0; const trend = done.map((r) => ({ at: r.at, v: (c += r.ach), party: r.party, add: r.ach }));
  return { rows, byM, byU: Object.values(byU).sort((a, b) => b.achAll + b.pot - (a.achAll + a.pot) || b.stake - a.stake), tot, BA, trend, period, label, from, base, now, proj };
}
export { addDays };
