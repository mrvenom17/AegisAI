# Day-1 Checklist

This is the *exact* sequence to execute on your first working evening. Everything here takes 3.5–4 hours. Do nothing else tonight.

## Hour 1 — Domain + landing page (60 min)

- [ ] Buy `aegisai.eu` (or `.io`) on **Namecheap** or **Porkbun**. ~€10/yr. Pick `.eu` if you can — buyers' procurement teams treat EU domains slightly more seriously.
- [ ] Create a free **Cloudflare** account, point the domain's nameservers at Cloudflare. Wait for propagation (5–10 min).
- [ ] In Cloudflare → DNS, add SPF, DKIM (placeholder), DMARC TXT records. Use [easydmarc.com](https://easydmarc.com) for the exact strings.
- [ ] Push this repo to a **private GitHub** repo if it isn't already. Create a separate **public** repo `aegisai-site` for the landing page.
- [ ] Copy `marketing/index.html` to `aegisai-site/index.html`. Replace `[Your Name]` and the LinkedIn URL.
- [ ] Connect `aegisai-site` to **Cloudflare Pages** (5-min setup). Custom domain `aegisai.eu`. Verify it's live.

## Hour 2 — Demo binder + Loom (60 min)

- [ ] In this repo: `npm install && npm run demo:binder`. The output is `marketing/demo-binder.html`.
- [ ] Open `marketing/demo-binder.html` in **Chrome**. Cmd-P → Destination "Save as PDF" → A4 → Save as `demo-binder.pdf`.
- [ ] Upload `demo-binder.pdf` to the `aegisai-site` repo (in `/public/demo-binder.pdf`) and update the `<a href="./demo-binder.html">` link in `index.html` to also offer the PDF.
- [ ] Sign up for **Loom** (free tier: 5 min/video, 25 videos). Install desktop app.
- [ ] Record a **90-second walkthrough**. Script:
  - "Hi, I'm [Name]. I'm building AegisAI — EU AI Act conformity for high-risk AI systems."
  - "This is the binder we generate." [Scroll through binder, 30 seconds]
  - "Annex III classification — HIGH_RISK, with rationale." [3 seconds]
  - "Article-by-article rule evaluation against Articles 5, 9, 10, 13, 14, 15." [5 seconds]
  - "FRIA workflow under Article 27." [3 seconds]
  - "ISO 42001 control coverage matrix — your procurement team will love that." [3 seconds]
  - "Signed Ed25519. Anyone with our public key can verify the binder hasn't been altered. That's what a Notified Body wants." [5 seconds]
  - "I'm running 3 free 8-week design partnerships before Aug 2 2026. Email me — link in description."
- [ ] Copy the Loom share URL. Update `marketing/index.html` to link to it.

## Hour 3 — LinkedIn + 1-pager + LOI (60 min)

- [ ] Rewrite your LinkedIn headline to: *"Building AegisAI — EU AI Act conformity binders for high-risk AI systems. Free pilots open until 2 Aug 2026."*
- [ ] Rewrite the "About" section per `marketing/index.html`'s lede + the pricing table summary.
- [ ] Set the LinkedIn banner to a screenshot of the demo binder's first page.
- [ ] Pin your first post (write it now, post tomorrow): *"I've spent the last six months building AegisAI: deterministic EU AI Act conformity binders for high-risk AI systems. With 90 days to the Aug 2 high-risk deadline, I'm opening **3 free 8-week design partnerships** for EU banks, insurers, and lending fintechs. Sample binder + 90s walkthrough + how to apply: [aegisai.eu]. Tagging the people I'd most want to put in front of this — reply / DM if you'd value a 15-min walkthrough."*
- [ ] Open `marketing/one-pager.html` in Chrome. Save as PDF → `one-pager.pdf`. Upload to `aegisai-site/public/`.
- [ ] Open `marketing/pilot-loi.md`. Fill in the placeholder `[Your Name]`, `[your address]`, `[your email]`, `[England and Wales / Republic of Ireland / your preferred EU jurisdiction]`. Save as a Google Doc + export to PDF — that's your DocuSign-able LOI.

## Hour 4 — CRM + first 5 names (45 min)

- [ ] Sign up for **Airtable** (free tier) or use Notion if you prefer. Create a workspace `AegisAI Pipeline`.
- [ ] Import `marketing/crm-template.csv` as a new table.
- [ ] Open LinkedIn. Filter your connections (Search → People → My connections → Industry: Banking / Insurance / Financial Services).
- [ ] Add 5 names to the CRM tonight. Tag with current_stage = `Tier-1 Warm`. For each, fill in `last_contact_context` (must be specific — "her panel at Sibos 2025" not "we connected").
- [ ] Schedule tomorrow's first DM block (7:00–7:30pm IST). Pick the easiest 1 of the 5 to start with — the relationship that feels warmest. Open the LinkedIn-warm-intro template (`marketing/outreach/01-linkedin-warm-intro.md`). Personalise. Send. Log in CRM as `dm-sent` with timestamp.

## End-of-night review (15 min)

- [ ] Confirm `aegisai.eu` resolves to your landing page on a phone (not just your laptop — phone view is what your buyers will see when they click your LinkedIn link in a meeting).
- [ ] Confirm the Loom link plays without sign-in.
- [ ] Confirm the demo-binder PDF opens to the binder you just generated, with `Hellenic Atlantic Bank` and `HIGH_RISK` visible above the fold.
- [ ] Tomorrow's plan: 5 more LinkedIn DMs at 7pm, first content post at 9pm.

---

## Tomorrow (Day 2) — start the rhythm

Per `soft-launching-walrus.md` Daily Rhythm:

- 7:00–7:30pm — 5 LinkedIn DMs, manual, personalised.
- 7:30–8:30pm — Reply to today's DMs. Comment on 3 posts by Tier-1 contacts.
- 8:30–9:30pm — First LinkedIn content post (use Monday-Insight template from `outreach/04-linkedin-content-calendar.md`).
- 9:30–10:30pm — Build the next 25 names in CRM. Start drafting your cold-email list for next week.
- 10:30–11:00pm — CRM update. Plan tomorrow.

---

## What absolutely must NOT happen on Day 1

- Don't tweak the product. The product is enough for the next 8 weeks. Tonight is sales-asset night.
- Don't write a pitch deck. The 1-pager + binder + Loom replace it.
- Don't email 50 cold contacts. Cold outreach starts in Phase 2, after the warm-intro engine is running. Emailing tonight burns goodwill on a half-warmed domain.
- Don't apply to YC tonight. YC W27 application opens August. You apply with pilots, not with a checklist.
- Don't register a company tonight. No procurement document = no incorporation. You're optimising for first-conversation, not first-invoice.
