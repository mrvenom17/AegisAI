# Discovery Call Script (30 min)

**Goal:** end the call with either (a) a signed LOI commitment or (b) a clear next-step with a named buying-committee member.

**Setup before the call:**
- 5 minutes of prep — read their LinkedIn, the company's last annual report (search for the word "AI"), any public press on their model risk programme.
- Have the demo binder open in a browser tab. Have the API running locally so you can run a live evaluation if asked.
- Calendly auto-creates a Zoom / Google Meet link. Use Zoom for European buyers — they prefer it.

---

## 0:00–2:00 — Open

> "Thanks for making time, {{first_name}}. I've blocked 30 minutes — I want to spend the first 10 understanding what you're up against, then walk you through what we'd actually deliver. Mind if I take notes? Cool.
>
> Is the audio working OK?"

Tone: calm, not eager. You are evaluating *them* as a pilot fit, as much as the reverse.

## 2:00–10:00 — Discovery (you talk ≤ 30%)

Ask in this order. Do not skip.

1. **"How much time has your team put on EU AI Act readiness so far?"**
   *Reads: are they panicking, calmly executing, or asleep?*

2. **"How many AI systems are in your inventory? Roughly which would land in Annex III high-risk?"**
   *Reads: scope. If <5, they're a small shop, pricing accordingly. If >50, you're the wedge into a much bigger account.*

3. **"Who internally owns this? Risk? Compliance? Both? Where does it sit in the org chart?"**
   *Reads: the buying committee. You want to know whether you're talking to the buyer or to a champion who has to sell internally.*

4. **"Have you started Annex IV technical documentation? In what format? Where does it live today?"**
   *This is the question that separates real prospects from polite curiosity. If they say "we have it in a Confluence page", you have a deal. If they say "our Big-4 advisor is producing it for us", you have a partnership opportunity. If they say "we're using {{competitor}}", press to understand whether that solution actually outputs an Annex IV binder.*

5. **"What's your relationship with {{their national supervisor — BaFin / DNB / ACPR / Bank of Italy / etc.}}? Have they given you any signal about what they'll be asking for?"**
   *Reads: regulatory pressure level. The higher, the closer to the close.*

6. **"What's the one thing about Aug 2 that's hardest right now?"**
   *Reads: the pain. Whatever they say, that's what you tie your demo to.*

**Stop and listen.** Take notes. Resist the urge to pitch.

## 10:00–22:00 — Demo (you drive)

Open the demo binder. Walk through these in this order (≤ 2 minutes each):

1. **The classification page** — "This is what we'd produce for one of your systems. Here it's classified as HIGH_RISK against Annex III §5(b) — credit scoring. Each match cites the clause. The classification is signed and timestamped."

2. **The rule-evaluation table** — "Here's where we evaluated against Articles 5, 9, 10, 13, 14, 15 — each rule, each control, pass/fail, with the underlying evidence. Look at this — this row is the Article 14 human oversight check. It passed because their `human_oversight` evidence had a designated role with stop-override."

3. **The ISO 42001 coverage matrix** — "Every rule maps to ISO 42001 Annex A controls. So this binder doubles as your 42001 evidence — your procurement team will love that."

4. **The signature box** — "Bottom of the binder. Ed25519 signature. Anyone with our public key can verify this binder hasn't been altered. That's what a Notified Body wants."

5. **The audit log** — "Every state change captured in a hash-chained log. Tampering invalidates the chain. This is the part that makes the binder *defensible*, not just *produced*."

Pause after each. Wait for questions. Most buyers light up at #2 (rule evaluations) or #4 (signature). That tells you what to lean into.

## 22:00–28:00 — The offer + objection handling

> "I have **3 free 8-week design-partner slots**. What it takes from your side: 4 one-hour sessions across 8 weeks, access to one AI system's evidence — the same evidence you've already produced for internal model risk — and one named champion. What you get: a real binder you can hand to your auditor or supervisor. No fee. After 2 Aug 2026, the equivalent pilot is €25,000.
>
> The only thing I ask in return is that, if it works at week 8, we agree to a paid contract for the rest of your AI systems."

### Objections

| Objection | Response |
|---|---|
| "What about Credo AI / Holistic AI / OneTrust?" | "They're workflow platforms — dashboards, questionnaires, mappings. AegisAI produces the actual signed regulator-grade artefact. Several of our customers run AegisAI alongside a workflow platform; we're the part that ends up in the binder a Notified Body actually looks at." |
| "Do you have customers?" | (Honest.) "You'd be one of the first three. That's why it's free, and why I'll personally run it. The first three become reference customers and get lock-in pricing." |
| "How long have you been doing this?" | "Six months full-time on the engine. I have a working system — you've just seen it. I'm a solo founder until pilots prove the model, then I raise. The engine is what it is regardless of company stage — you can verify every binder cryptographically." |
| "We're working with Big-4 on this." | "Perfect — Big-4 advisory wants the binder; we *produce* the binder. We don't compete with their advisory practice; we make their work faster. I'd be delighted to bring them into the project." |
| "What's the catch / why free?" | "Two reasons. (1) Validating the engine against a real bank's evidence is worth more to me than the fee. (2) I'm reserving 3 slots; after 2 Aug 2026 the pilot is €25k. So this is genuinely a window." |
| "We'd need legal / procurement to look at this." | "Of course. The LOI is one page, non-binding, no fee, no data-sharing without an NDA — I can send all three today. Who on the legal side should I copy?" *(Now you have a name.)* |
| "Send me more info." | "Happy to. Two questions to send the *right* info — what's the AI system you'd want in scope, and who's the champion who'd run this from your side? That way the follow-up is concrete, not generic." |

## 28:00–30:00 — Close on a next step

You want **one** of these by the end:

1. **Best:** "Send the LOI. We'll kick off Monday." → reply with LOI within the hour.
2. **Good:** "Let me run this past {{name}}. Can we schedule a 30-min call with them next week?" → propose three times, attach the demo binder + 1-pager.
3. **OK:** "Send me everything in writing." → email within 1 hour: 1-pager + binder + LOI + Calendly link + a 3-line note. Follow up in 4 days.
4. **Bad (but useful):** "It's not for us." → "Quick last ask — who at a peer institution would you put in front of this if you were me?"

**Always end with a next-step on the calendar.** "Let me think about it" without a follow-up time = a "no" you haven't admitted to yet.

## After the call (within 30 minutes)

- Log everything in CRM.
- Send the recap email: 5 bullets summarising what they said, the offer, the next step. End with "Reply if I got any of this wrong." (Forces engagement.)
- If they said yes to the LOI, send it within an hour. Not the next day.
- Move them in the CRM stage to whatever applies.

## After the call (within 24 hours)

- Self-debrief. What surprised you? What did you fumble? Update the script.
- Send one piece of value within 24 hours — a relevant article, a paragraph from the EU AI Act FAQ, an analysis of one of their public AI systems. Demonstrates you actually understood their world.
