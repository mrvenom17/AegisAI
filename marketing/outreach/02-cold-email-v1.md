# Cold Email Template v1 — Heads of Model Risk / Compliance / AI Governance

**Use this for:** cold contacts at EU-licensed banks, insurers, lending fintechs (200–10,000 employees) — sourced from Apollo, Hunter, RocketReach.

**Send via:** Smartlead.ai (~$39/mo) or self-hosted SES with a warmed domain. **Not** from your personal Gmail in bulk.

**Setup before bulk-sending:**
1. Buy `aegisai.eu` (or `.io`) — €10/yr.
2. Configure SPF / DKIM / DMARC in Cloudflare DNS — takes 10 minutes.
3. Warm the domain for 14 days at 5–10 emails/day before scaling.
4. Send from a real human address (e.g. `firstname@aegisai.eu`), not `noreply@`.

**Volume:** 30–50/week initially → scale to 100/week once warm. Realistic conversion: 1–3% reply rate, 20–40% of replies become first calls.

---

## Subject lines (A/B test all four)

1. `Annex IV binder for {{Company}} — 8-week pilot`
2. `{{Company}} — 90 days to AI Act high-risk deadline`
3. `Question on {{Company}}'s AI Act readiness`
4. `{{Mutual_Name}} suggested I reach out` *(only when literally true)*

## Body (under 100 words — keep it brutal)

> {{first_name}} —
>
> 90 days from today, the EU AI Act high-risk obligations apply. For {{Company}}'s {{specific_AI_use_case}} systems, that means an Annex IV technical-documentation binder, FRIA under Article 27, and ISO/IEC 42001 evidence — produced in a way a supervisor would accept.
>
> I've built **AegisAI** to produce exactly this. Working system, signed deterministic snapshots, regulator-defensible.
>
> I'm running **3 free 8-week design partnerships** before the deadline. Output: a real binder for one of your AI systems, no fee, no obligation.
>
> 15-minute call this week or next?
>
> {{your_name}}
> Sample binder: [link]
> 90-second walkthrough: [Loom link]

## `{{specific_AI_use_case}}` lookup table

| If their company is a... | Use this phrase |
|---|---|
| Universal bank | "credit-decisioning and fraud-detection" |
| Retail bank | "credit scoring and AML" |
| Insurance company | "underwriting and claims-fraud" |
| Lending fintech / BNPL | "credit-decisioning" |
| Asset manager | "investment-decision-support" |
| Payments processor | "transaction-fraud-detection" |
| Don't know | "high-risk AI" *(generic — last resort)* |

## Follow-up sequence (every cold email gets all 4)

| Day | Subject | Body |
|---|---|---|
| 0 | (initial subject) | Initial email above |
| 3 | `Re: {{original subject}}` | "Bumping this. Also noticed {{one specific thing about their company — recent press, hiring, product launch}}. Worth 15 minutes?" |
| 7 | `Re: {{original subject}}` | Forward the original with one line: "Did this make it through, {{first_name}}?" |
| 12 | `{{Company}} — wrong contact?` | "Closing the loop. If model risk / AI governance isn't owned by you at {{Company}}, who would be the right person to forward this to?" |
| 21 | `Closing the design-partner slots` | "Last note — I'm closing the 3 free pilot slots next month. After that the equivalent engagement is €25k. If {{Company}} should be one of the three, here's my Calendly: [link]." |

## What to A/B test (one variable at a time)

- **Week 1–2**: subject lines. Pick the highest open-rate subject and freeze it.
- **Week 3–4**: opening sentence. Try replacing the deadline framing with a peer-pressure framing ("Klarna and {{Peer}} have both started Annex IV work. Has {{Company}}?").
- **Week 5–6**: CTA. Try Calendly link vs. "reply to schedule" vs. specific time slot proposal.

## Hard rules

- Never send to a personal email if you can find a corporate one.
- Never bcc more than 1 person.
- Never include images, attachments, or tracking pixels in the *first* email — they trigger spam filters and procurement-blocked-sender lists.
- Plain-text email beats HTML for reply rate at this seniority level.
- If you get a `Mailbox unavailable` / hard bounce, remove from list immediately. Bounce rate >3% kills your sender reputation.
