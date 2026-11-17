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
