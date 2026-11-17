import { randomUUID } from "crypto";
import { sign } from "@/lib/session";

export const runtime = "nodejs";

const bad = (msg, status = 400) => Response.json({ error: msg }, { status });

// Saves the contact to the separate Contacts sheet (through its Apps Script web app)
// and returns a signed token for a brand-new, independent dashboard.
export async function POST(req) {
  try {
    const b = await req.json();
    const name = String(b.name || "").trim().slice(0, 80);
    const mobile = String(b.mobile || "").replace(/[^\d+]/g, "").slice(0, 15);
    const email = String(b.email || "").trim().toLowerCase().slice(0, 120);
    const company = String(b.company || "").trim().slice(0, 120);
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || mobile.replace(/\D/g, "").length < 10) {
      return bad("Please enter your name, a valid email and a 10-digit mobile number.");
    }
    if (!b.consent) return bad("Please tick the consent box to continue.");
    if (String(process.env.REGISTRATION_OPEN || "true").toLowerCase() === "false") return bad("Registration is closed.", 403);

    const url = process.env.CONTACTS_WEBHOOK_URL;
    if (!url) return bad("Contact sheet is not configured (see README, step 1).", 500);
    const id = randomUUID();
    const r = await fetch(url, {
      method: "POST", redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ secret: process.env.CONTACTS_WEBHOOK_SECRET || "", id, name, mobile, email, company, consent: "Yes" }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) {
      console.error("contacts webhook", r.status, j);
      return bad("We couldn't save your details. Please try again.", 502);
    }

    return Response.json({ token: sign({ id, name, email }), id, name, email, mobile });
  } catch (e) {
    console.error(e);
    return bad(e.message || "Something went wrong.", 500);
  }
}
