"""Build one company's workshop seed from a FlowIQ Automation dashboard bundle (dashboard/data.json).
Usage: python3 -I make_company_seed.py <data.json> <company_id> <out.json>

Same shape as lib/seed.json (Vardhan), plus the company's own use-case list, so the dashboard can show any
company and any use case (UC1-UC42). Drops every contact: email addresses, and the mobile numbers of the
company's contacts and action recipients. Keeps parties, amounts, analysis and message drafts."""
import json, re, sys

src, cid, out = sys.argv[1], sys.argv[2], sys.argv[3]
c = next(x for x in json.load(open(src, encoding="utf-8"))["companies"] if x["company_id"] == cid)

# Impact of an approval, by action type (anything not listed counts as "protect": exposure stopped / corrected).
#  cash -> money comes in (UC1 also reduces receivables) · saved -> cost avoided / credit secured
#  interest -> saved = amount x rate x days / 365
KIND = {
    "reminder": "cash", "allocation_request": "cash", "route_dispute": "cash", "refund_request": "cash",
    "margin_review": "cash", "advance_followup": "cash", "amazon_claim": "cash", "invoice_correction": "cash",
    "early_payment_note": "interest", "late_payment_note": "interest",
    "penalty_flag": "saved", "gst_vendor_followup": "saved", "gst_books_correction": "saved", "debit_note_request": "saved",
    "price_review": "saved", "freight_query": "saved", "tds_correction": "saved", "msme_dues": "saved",
    "gst_return_correction": "saved", "amazon_gst": "saved", "grn_unbilled": "saved",
}

# The setup package's dashboard grouping (GRP in dashboard/index.html), used when a company runs more than nine use cases.
AREAS = [["rec", "Receivables", ["UC1", "UC2", "UC3", "UC8"]],
         ["pay", "Payables", ["UC4", "UC5", "UC7", "UC18", "UC19", "UC20", "UC21", "UC22", "UC24"]],
         ["gst", "GST", ["UC6", "UC38"]],
         ["proc", "Procurement", ["UC10", "UC11", "UC12", "UC13", "UC14", "UC15", "UC16", "UC23"]],
         ["tax", "TDS & payroll", ["UC17", "UC39"]],
         ["inv", "Inventory & costing", ["UC28", "UC29", "UC30", "UC31", "UC32"]],
         ["close", "Close & reporting", ["UC25", "UC26", "UC27", "UC33", "UC34", "UC36", "UC37", "UC40", "UC41", "UC42"]],
         ["mkt", "Marketplace", ["UC9"]]]

SHORT = {"UC1": "Collections", "UC2": "Credit limits", "UC3": "Dispatch hold", "UC4": "Duplicates", "UC5": "Vendor payments",
         "UC6": "GST credit", "UC7": "Purchase match", "UC8": "Invoice checks", "UC9": "Amazon reco", "UC10": "Price variance",
         "UC11": "BOM reorder", "UC12": "Excess purchase", "UC13": "Supplier scorecard", "UC14": "QC rejections",
         "UC15": "Job work", "UC16": "Freight", "UC17": "TDS", "UC18": "MSME 45 days", "UC19": "Payment run",
         "UC20": "Supplier advances", "UC21": "Vendor bank change", "UC22": "Vendor master", "UC23": "Purchase policy",
         "UC24": "Supplier statements", "UC25": "Capex vs revenue", "UC26": "Close tracker", "UC27": "Bank reco",
         "UC28": "Production variance", "UC29": "WIP valuation", "UC30": "Inventory NRV", "UC31": "Physical stock",
         "UC32": "Overheads", "UC33": "Cut-off & accruals", "UC34": "Fixed assets", "UC36": "Suspense",
         "UC37": "Journal review", "UC38": "GST output", "UC39": "Payroll dues", "UC40": "Budget vs actual",
         "UC41": "Cash forecast", "UC42": "Audit pack"}

EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
mobiles = set()
def _collect(o):
    if isinstance(o, dict):
        for k, v in o.items():
            if isinstance(v, str) and k.lower() in ("mobile", "phone", "whatsapp", "to") and re.fullmatch(r"\+?\d[\d ]{8,14}", v.strip()):
                mobiles.add(re.sub(r"\D", "", v)[-10:])
            else:
                _collect(v)
    elif isinstance(o, list):
        for v in o: _collect(v)
_collect(c.get("contacts")); _collect(c.get("prepared")); _collect(c.get("actions"))
PHONE = re.compile("|".join(sorted(mobiles))) if mobiles else None

def clean(x):
    s = EMAIL.sub("[email]", str(x or ""))
    return (PHONE.sub("[mobile]", s) if PHONE else s).strip()

def days_of(t):
    for pat in (r"oldest (\d+) days", r"(\d+)-(\d+) days", r"(\d+)\+? days overdue", r"were (\d+)\+? days", r"by (\d+) days"):
        m = re.search(pat, t)
        if m: return int(m.groups()[-1])
    return 0

def pr(f): return c["prepared"].get(f["finding_id"]) or {}

def table_of(a):
    t = a.get("table") or {}
    if not t.get("columns"): return None
    return {"columns": [clean(x) for x in t["columns"]], "rows": [[clean(x) for x in r] for r in t.get("rows", [])][:25]}

def evidence_of(p):
    e = p.get("evidence") or {}
    return {"label": e.get("label") or "", "found": {k: v[:6] for k, v in (e.get("real") or {}).items()}, "missing": e.get("missing") or []}

findings = []
for f in c["findings"]:
    p = pr(f); a = p.get("action") or {}; t = a.get("type", "")
    findings.append({
        "id": f["finding_id"], "uc": f["use_case"], "party": f.get("party") or "Company-wide",
        "title": clean(f["title"]), "severity": f.get("severity") or "low", "type": t,
        "action": clean(a.get("type_label")) or clean(f.get("recommended_action")), "kind": KIND.get(t, "protect"),
        "amount": round(float(f.get("amount_at_stake") or 0)), "days": days_of(f["title"]),
        "why": clean(f.get("evidence_summary"))[:300], "subject": clean(a.get("subject")), "body": clean(a.get("body")),
        "owner": f.get("owner_role") or "", "root": clean(f.get("root_cause_hypothesis")), "rule": f.get("rule_id_triggered") or "",
        "refs": clean(f.get("voucher_refs")), "sla": int(float(f.get("sla_days") or 0)),
        "checks": [{"check": clean(i.get("check")), "result": clean(i.get("result")), "source": i.get("source") or ""}
                   for i in (p.get("investigation") or [])],
        "table": table_of(a), "review": clean(((p.get("review") or {}).get("reason")) or ""), "evidence": evidence_of(p),
        "after": clean(a.get("after")), "closure": clean(a.get("closure")), "automation": clean(a.get("automation")),
        "followup": a.get("followup_days") or 0, "label": clean(a.get("type_label")),
    })

# Use cases: every enabled one, in catalogue order, with its name, short label, description and area.
names = c.get("uc_names") or {}
rules = c.get("rules_use_cases") or {}
applic = c.get("applicability") or {}
enabled = c.get("enabled_use_cases") or sorted({f["uc"] for f in findings}, key=lambda k: int(k[2:]))
area_of = {u: a[0] for a in AREAS for u in a[2]}
ucs = [{"uc": k, "name": names.get(k) or (rules.get(k) or {}).get("name") or k, "short": SHORT.get(k, k),
        "method": clean((rules.get(k) or {}).get("description")), "area": area_of.get(k, "more"),
        "na": clean(applic.get(k)) if applic.get(k) else ""} for k in enabled]

p = c["position"]; k1 = ((c.get("use_cases") or {}).get("UC1") or {}).get("kpi") or {}
ls = (c.get("sync") or {}).get("last_success") or {}
vouchers = next((int(str(x.get("detail", "0")).split()[0]) for x in (c.get("health") or {}).get("checks", [])
                 if x.get("check") == "row_count_vouchers"), 0)
seed = {
    "id": cid, "company": c["name"], "asOf": p.get("as_on") or c.get("books_as_of"),
    "inputs": {"cash": round(p["cash_bank"]), "receivables": round(p["receivables"]), "payables": round(p["payables"]),
               "netSales90": round(k1.get("net_sales_90d") or (p["revenue"] / max(p.get("days") or 1, 1) * 90)),
               "interestRate": 12},
    "ageing": [{"bucket": b["bucket"], "amount": round(b["amount"])} for b in (c.get("ageing") or {}).get("buckets", [])],
    "monthly": [{"m": r["period"], "sales": round(r["sales"]), "receipts": round(r["receipts"]),
                 "purchases": round(r.get("purchase") or 0), "payments": round(r.get("payments") or 0)} for r in c.get("monthly") or []],
    "position": {k: (round(p[k], 1) if k in ("dso", "dpo", "ccc") else round(p[k])) for k in
                 ("revenue", "receivables", "payables", "advances_to_vendors", "cash_bank", "duties_taxes_net",
                  "working_capital", "dso", "dpo", "ccc") if k in p} | {"period_from": p.get("period_from"), "days": p.get("days")},
    "sync": {"date": (ls.get("finished_at") or "")[:10] or (c.get("health") or {}).get("sync_date", ""), "vouchers": vouchers,
             "health": (c.get("health") or {}).get("score")},
    "findings": findings,
    "dropped": [{"uc": d["use_case"], "title": clean(d.get("title")), "reason": clean(d.get("reason")), "amount": round(float(d.get("amount") or 0))}
                for d in (c.get("review") or {}).get("dropped", [])],
    "playbooks": {k: {"name": v.get("name", ""), "steps": [clean(x) for x in v.get("investigate", [])], "verify": clean(v.get("verify"))}
                  for k, v in (c.get("playbooks") or {}).items()},
    "ucs": ucs,
    "areas": [[a[0], a[1]] for a in AREAS] + [["more", "More checks"]],
}
json.dump(seed, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(cid, len(findings), "findings,", len(ucs), "use cases,", len(mobiles), "contact numbers removed")
