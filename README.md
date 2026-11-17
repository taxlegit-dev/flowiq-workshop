# FlowIQ Automation · Workshop app (Next.js)

- **/** Welcome page and form. Each submission is saved to the **FlowIQ Workshop Contacts** Google Sheet through that sheet's own Apps Script web app.
- **/dashboard** All 8 use cases on Vardhan Home & Industrial sample data. It has editable numbers, live KPIs and charts, approvals that show their impact, test copies, and **Send MIS report** by email (Brevo).
- **/dashboard?demo=1** Rehearsal mode. No sign-in, and no emails are sent.

**Each user is isolated.** Every registration gets its own user ID and its own dashboard. Edited values, approvals and charts are stored only in that user's browser, under that ID, so nothing is shared between users. Two people registering on the same laptop also get separate dashboards; use **Sign out** between them. Emails go only to the address the user registered with, which is guaranteed by a signed session token. Each user can send up to 15 emails.

## 1. Contacts sheet + Apps Script (about 5 minutes)

The sheet already exists: **FlowIQ Workshop Contacts**, with a `Contacts` tab and the columns Registered at, Name, Mobile, Email, Company, Consent, User ID.

1. Open the sheet and go to **Extensions → Apps Script**.
2. Replace `Code.gs` with `apps-script/Code.gs` from this project and save.
3. Go to **Project Settings (gear icon) → Script properties → Add script property**. Name it `SHARED_SECRET` and give it a long random value. Use the same value for `CONTACTS_WEBHOOK_SECRET` in Vercel.
4. Go to **Deploy → New deployment → Web app**, set Execute as **Me** and Who has access **Anyone**, then click **Deploy** and **Allow**.
5. Copy the URL that ends in `/exec`. This is `CONTACTS_WEBHOOK_URL`.

"Anyone" is safe here. The script only appends a row when the secret matches, and it never returns data.

## 2. Brevo (about 3 minutes)

1. In Brevo, go to **Senders, Domains & Dedicated IPs → Senders** and add and verify the sender address (for example 121@taxlegit.com). For best delivery, also authenticate the taxlegit.com domain there (DKIM/DMARC).
2. Go to **Settings → SMTP & API → API keys → Generate a new API key**. This is `BREVO_API_KEY`.
3. Check your plan's daily limit. The free plan sends **300 emails a day**. For 100 attendees each sending the MIS report plus a few test copies, use a paid plan on workshop day, or lower the email cap (`MAX_EMAILS` in `app/dashboard/page.js`).

The key lives only in Vercel's environment variables, never in the code.

## 3. Run locally

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev                  # http://localhost:3000
```

## 4. GitHub → Vercel

```bash
git init && git add . && git commit -m "FlowIQ workshop app"
git branch -M main
git remote add origin https://github.com/<you>/flowiq-workshop.git
git push -u origin main
```

1. In Vercel, go to **Add New → Project**, import the repo and keep the defaults (Next.js).
2. Under **Environment Variables**, add everything from `.env.example`: `CONTACTS_WEBHOOK_URL`, `CONTACTS_WEBHOOK_SECRET`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `BREVO_REPLY_TO`, `SESSION_SECRET`, and optionally `REGISTRATION_OPEN`.
3. Click **Deploy**. You can add a domain such as `workshop.taxlegit.com` under **Settings → Domains**.

To close registration after the workshop, set `REGISTRATION_OPEN=false` and redeploy.

## How approvals move the numbers

| Use case | Approving does this |
|---|---|
| UC1 Collections | Cash goes up, receivables go down, overdue buckets shrink from the oldest bill, and DSO is recalculated |
| UC4 Duplicate refund, UC8 Invoice correction | Cash goes up |
| UC6 GST credit, UC7 Debit notes, UC5 Penalties | Adds to "Saved" |
| UC5 Early / late payments | Saves amount × interest rate × days ÷ 365 (the rate is editable) |
| UC2 Credit limits, UC3 Dispatch hold, cash-limit and GRN checks | Adds to "Risk stopped" |

DSO = receivables ÷ net sales of the last 90 days × 90. All inputs can be changed under **Edit numbers**, and every amount can be edited in its row.

## Data

`lib/seed.json` is built from the Vardhan FlowIQ output, with every contact removed. To use another company, rebuild it with `scripts/make_seed.py <data.json> lib/seed.json`.
