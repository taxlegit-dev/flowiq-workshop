// FlowIQ O2C/P2P workshop engine. Pure functions: state in -> KPIs, charts, impact out.
import seed from "./seed.json";

export const UC = {
  UC1: { name: "Receivables & DSO", short: "Collections" },
  UC2: { name: "Credit-limit breach", short: "Credit limits" },
  UC3: { name: "Overdue + new dispatch", short: "Dispatch hold" },
  UC4: { name: "Duplicate invoice / payment", short: "Duplicates" },
  UC5: { name: "Early payment & penalties", short: "Vendor payments" },
  UC6: { name: "GST credit vs GSTR-2B", short: "GST credit" },
  UC7: { name: "PO / receipt / bill match", short: "Purchase match" },
  UC8: { name: "Customer invoice validation", short: "Invoice checks" },
};

export const BUCKET_MAX = { "Not due": 0, "1-30": 30, "31-60": 60, "61-90": 90, "91-180": 180, "180+": Infinity };

export function freshState() {
  return {
    inputs: { ...seed.inputs },
    ageing: seed.ageing.map((b) => ({ ...b })),
    edits: {},      // id -> { amount }
    approved: {},   // id -> ISO time
  };
}

export const findingsOf = (state) =>
  seed.findings.map((f) => ({ ...f, ...(state.edits[f.id] || {}) }));

// Money effect of approving one finding.
export function impactOf(f, inputs) {
  const amt = Math.max(0, Number(f.amount) || 0);
  if (f.kind === "interest") {
    const v = Math.round(amt * (Number(inputs.interestRate) || 0) / 100 * (f.days || 0) / 365);
    return { cash: 0, saved: v, protect: 0, collected: 0 };
  }
  return {
    cash: f.kind === "cash" ? amt : 0,
    collected: f.kind === "cash" && f.uc === "UC1" ? amt : 0,
    saved: f.kind === "saved" ? amt : 0,
    protect: f.kind === "protect" ? amt : 0,
  };
}

// Deduct collections from the ageing bucket of the oldest bill, spilling into younger buckets.
function applyCollections(ageing, collections) {
  const out = ageing.map((b) => ({ ...b, amount: Math.max(0, Number(b.amount) || 0) }));
  const overdueIdx = out.map((b, i) => i).filter((i) => out[i].bucket !== "Not due");
  for (const { amount, days } of collections) {
    let left = amount;
    let start = overdueIdx.findIndex((i) => days <= BUCKET_MAX[out[i].bucket]);
    if (start < 0) start = overdueIdx.length - 1;
    for (let k = start; k >= 0 && left > 0; k--) {
      const b = out[overdueIdx[k]];
      const take = Math.min(b.amount, left);
      b.amount -= take; left -= take;
    }
  }
  return out;
}

export function compute(state, extraApprovedId) {
  const inputs = state.inputs;
  const all = findingsOf(state);
  const isDone = (f) => !!state.approved[f.id] || f.id === extraApprovedId;
  const done = all.filter(isDone);

  const tot = { cash: 0, saved: 0, protect: 0, collected: 0 };
  const collections = [];
  for (const f of done) {
    const i = impactOf(f, inputs);
    for (const k in tot) tot[k] += i[k];
    if (i.collected) collections.push({ amount: i.collected, days: f.days });
  }

  const ageing = applyCollections(state.ageing, collections);
  const receivables = Math.max(0, (Number(inputs.receivables) || 0) - tot.collected);
  const netSales90 = Number(inputs.netSales90) || 0;
  const overdue = ageing.filter((b) => b.bucket !== "Not due").reduce((s, b) => s + b.amount, 0);
  const over60 = ageing.filter((b) => BUCKET_MAX[b.bucket] > 60).reduce((s, b) => s + b.amount, 0);

  const areas = Object.keys(UC).map((k) => {
    const fs = all.filter((f) => f.uc === k);
    const res = fs.filter(isDone);
    return {
      uc: k, name: UC[k].short,
      open: fs.filter((f) => !isDone(f)).reduce((s, f) => s + (Number(f.amount) || 0), 0),
      resolved: res.reduce((s, f) => s + (Number(f.amount) || 0), 0),
      count: fs.length, openCount: fs.length - res.length,
    };
  });

  return {
    kpi: {
      cash: (Number(inputs.cash) || 0) + tot.cash,
      receivables,
      dso: netSales90 > 0 ? (receivables / netSales90) * 90 : 0,
      overdue,
      over60,
      value: tot.saved + tot.protect,
      atStake: areas.reduce((s, a) => s + a.open, 0),
      done: done.length,
      total: all.length,
    },
    ageing,
    areas,
    tot,
  };
}

export const seedMeta = { company: seed.company, asOf: seed.asOf, monthly: seed.monthly };

// Indian number format: 41,30,388 -> "41.3 L", 2,26,08,558 -> "2.26 Cr"
export function inr(n, exact) {
  const v = Math.round(Number(n) || 0);
  if (exact) return "₹" + v.toLocaleString("en-IN");
  const a = Math.abs(v), s = v < 0 ? "-" : "";
  if (a >= 1e7) return `${s}₹${(a / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(1)} L`;
  return s + "₹" + a.toLocaleString("en-IN");
}

// ---------- additions for Overview and Analysis report ----------
export const seedFull = seed;
export const OWNER = {
  accounts_receivable: "AR / collections", credit_controller: "Credit controller", finance_head: "Finance head / CFO",
  accounts_payable: "AP head", accountant: "Accountant",
};
const SEV_RANK = { critical: 4, high: 3, medium: 2, low: 1 };
export const sevLabel = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "Cleared");

// The position if every open action were approved.
export function projected(state) {
  const all = {};
  for (const f of seed.findings) all[f.id] = state.approved[f.id] || "projected";
  return compute({ ...state, approved: all });
}

export const notDueShare = (ageing) => {
  const tot = ageing.reduce((s, b) => s + b.amount, 0);
  const nd = ageing.find((b) => b.bucket === "Not due")?.amount || 0;
  return tot ? (nd / tot) * 100 : 0;
};

const DECIDE = {
  UC1: (n, v, k) => `Approve ${n} collection action${n > 1 ? "s" : ""} on ${inr(v)} overdue; DSO now ${k.dso.toFixed(1)} days.`,
  UC2: (n, v) => `Hold or review ${n} customer${n > 1 ? "s" : ""} over their credit limit (${inr(v)}).`,
  UC3: (n, v) => `Decide dispatch holds: ${inr(v)} still going to ${n} long-overdue account${n > 1 ? "s" : ""}; release only against a payment plan.`,
  UC4: (n, v) => `Confirm ${n} suspected duplicate${n > 1 ? "s" : ""} (${inr(v)}) and recover or reverse them.`,
  UC5: (n, v) => `Review ${n} supplier payment${n > 1 ? "s" : ""} made early or late (${inr(v)}); pay on the due date.`,
  UC6: (n, v) => `Follow up ${n} GST credit item${n > 1 ? "s" : ""} (${inr(v)}) not matching GSTR-2B; hold that GST in payments.`,
  UC7: (n, v) => `Hold ${n} supplier bill${n > 1 ? "s" : ""} above the PO / goods received (${inr(v)}) and approve debit notes.`,
  UC8: (n, v) => `Correct ${n} customer invoice${n > 1 ? "s" : ""} (${inr(v)}) before sending or chasing.`,
};

// One row per use case, live with the user's edits and approvals.
export function scorecard(state, result) {
  const all = findingsOf(state);
  return Object.keys(UC).map((k) => {
    const fs = all.filter((f) => f.uc === k);
    const open = fs.filter((f) => !state.approved[f.id]);
    const v = open.reduce((s, f) => s + (Number(f.amount) || 0), 0);
    const sev = open.reduce((m, f) => (SEV_RANK[f.severity] > SEV_RANK[m] || !m ? f.severity : m), "");
    const owner = OWNER[(open[0] || fs[0] || {}).owner] || "Finance";
    return {
      uc: k, name: UC[k].name, open: open.length, total: fs.length, atStake: v, severity: sev, owner,
      decision: open.length ? DECIDE[k](open.length, v, result.kpi) : "All actions approved.",
    };
  });
}

export function topOpen(state, n = 5) {
  return findingsOf(state).filter((f) => !state.approved[f.id])
    .sort((a, b) => (SEV_RANK[b.severity] - SEV_RANK[a.severity]) || b.amount - a.amount).slice(0, n);
}

// How each check works (shown with its analysis). UC1–5 also carry the playbook from the FlowIQ run.
export const METHOD = {
  UC1: "Ages every open customer bill in Tally against its credit period, then checks each overdue party for unallocated receipts, credit notes, disputes and payment promises before choosing the reminder level.",
  UC2: "Compares each customer's outstanding in Tally with the credit limit set on the ledger, and flags customers over the limit or with no limit at all.",
  UC3: "Finds customers who were still invoiced or dispatched in the last 30 days while their older bills were already long overdue.",
  UC4: "Matches vouchers by party (including look-alike ledger names), reference number and amount to find the same bill booked or paid twice.",
  UC5: "Compares each supplier payment date with the bill's due date: early payments give up cash float, late ones risk interest and penalties.",
  UC6: "Reconciles the purchase register in Tally with GSTR-2B month by month, invoice by invoice: GST in the books vs GST the supplier reported.",
  UC7: "Matches each supplier bill with its purchase order and goods receipt note, and flags bills above the ordered or received quantity or rate.",
  UC8: "Checks customer invoices for the details customers reject on: GSTIN, place of supply, PO reference and agreed rates.",
};
export const SOURCE = {
  "Real-Tally": { label: "Tally", tone: "tally" }, "GSTR-2B": { label: "GSTR-2B", tone: "gst" },
  Real: { label: "Document", tone: "doc" }, Missing: { label: "Not available", tone: "miss" },
};
export const dropped = seed.dropped || [];
export const playbooks = seed.playbooks || {};
