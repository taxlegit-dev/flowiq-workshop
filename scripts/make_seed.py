"""Build the workshop seed from the Vardhan FlowIQ data.json (sample company).
Usage: python3 -I make_seed.py <data.json> <out seed.json>
Drops every contact (emails, mobiles, recipients). Keeps parties, amounts and drafts."""
import json, re, sys

src, out = sys.argv[1], sys.argv[2]
c = json.load(open(src))["companies"][0]

WHAT = {"reminder": "Send payment reminder", "allocation_request": "Ask customer to allocate receipts",
        "route_dispute": "Route dispute to sales head", "credit_alert": "Hold new orders, review limit",
        "dispatch_hold": "Hold further dispatch", "credit_lapse_note": "Flag credit-control lapse",
        "refund_request": "Ask supplier for refund", "cash_limit_review": "Stop cash payments above limit",
        "early_payment_note": "Pay on due date, not early", "late_payment_note": "Pay on time, avoid interest",
        "penalty_flag": "Stop avoidable penalties", "gst_vendor_followup": "Ask supplier to file GSTR-1",
        "gst_books_correction": "Correct GST entry in Tally", "debit_note_request": "Ask supplier for debit note",
        "grn_process_note": "Enforce receipt notes", "margin_review": "Raise supplementary invoice"}

# Impact of an approval, by action type:
#  cash    -> money comes in (UC1 also reduces receivables)
#  saved   -> cost avoided / credit secured
#  protect -> exposure stopped (risk prevented)
#  interest-> saved = amount x rate x days / 365
KIND = {"reminder": "cash", "allocation_request": "cash", "route_dispute": "cash",
        "credit_alert": "protect", "dispatch_hold": "protect", "credit_lapse_note": "protect",
        "refund_request": "cash", "cash_limit_review": "protect", "early_payment_note": "interest",
        "late_payment_note": "interest", "penalty_flag": "saved", "gst_vendor_followup": "saved",
        "gst_books_correction": "saved", "debit_note_request": "saved", "grn_process_note": "protect",
        "margin_review": "cash"}

EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
PHONE = re.compile(r"\b\d{10}\b")

def days_of(f):
    t = f["title"]
    for pat in (r"oldest (\d+) days", r"(\d+)-(\d+) days", r"(\d+)\+? days overdue", r"were (\d+)\+? days"):
        m = re.search(pat, t)
        if m:
            return int(m.groups()[-1])
    return 0

findings = []
for f in c["findings"]:
    a = (c["prepared"].get(f["finding_id"]) or {}).get("action") or {}
    t = a.get("type", "")
    body = PHONE.sub("[mobile]", EMAIL.sub("[email]", a.get("body", "") or ""))
    findings.append({
        "id": f["finding_id"], "uc": f["use_case"], "party": f["party"] or "Company-wide",
        "title": f["title"], "severity": f["severity"], "type": t,
        "action": WHAT.get(t, f["recommended_action"]), "kind": KIND.get(t, "protect"),
        "amount": round(float(f["amount_at_stake"] or 0)), "days": days_of(f),
        "why": f.get("evidence_summary", "")[:300],
        "subject": a.get("subject", ""), "body": body,
    })

p = c["position"]
seed = {
    "company": c["name"], "asOf": p["as_on"],
    "inputs": {
        "cash": round(p["cash_bank"]), "receivables": round(p["receivables"]),
        "payables": round(p["payables"]),
        "netSales90": round(c["use_cases"]["UC1"]["kpi"]["net_sales_90d"]),
        "interestRate": 12,
    },
    "ageing": [{"bucket": b["bucket"], "amount": round(b["amount"])} for b in c["ageing"]["buckets"]],
    "monthly": [{"m": r["period"], "sales": round(r["sales"]), "receipts": round(r["receipts"])} for r in c["monthly"]],
    "findings": findings,
}
json.dump(seed, open(out, "w"), ensure_ascii=False, indent=1)
print(len(findings), "findings;", sum(1 for f in findings if f["body"]), "with drafts")
