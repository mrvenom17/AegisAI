# AegisAI — Product Definition (v0.1 MVP)

## What we sell

**One-line pitch.** AegisAI turns your AI model evaluations into a regulator-defensible EU AI Act conformity binder — Annex III risk classification, Annex IV technical documentation, FRIA, post-market monitoring — with cryptographic audit trail.

**Concrete deliverable per customer.** A signed, immutable Conformity Pack per AI system per release: classification certificate + Annex IV documentation + FRIA + control evidence map (EU AI Act ↔ ISO 42001) + ongoing monitoring webhook.

## Entry vertical (single, narrow, by design)

**EU financial services — credit scoring, fraud detection, AML/KYC, insurance underwriting.**

Why this vertical first:
- Annex III §5(b) (creditworthiness/credit scoring) and §5(c) (life/health insurance pricing) are explicit high-risk categories — forced conformity work by 2 Aug 2026.
- Banks and insurers have €100k+ compliance line items and a Chief Risk Officer / Head of Model Risk who owns the budget.
- ECB and EBA already publish supervisory expectations for AI/ML model risk (overlay with EU AI Act = double the urgency).
- ISO 42001 is rapidly becoming a procurement gate for fintech vendors selling into banks — same buyer.
- Buyers are identifiable: ~300 EU banks + ~150 EU insurers + ~500 mid-market fintechs ≈ ~950 named accounts.

What we explicitly do NOT sell in v0.1:
- Healthcare AI (different regulator, MDR overlay, longer sales cycle)
- HR/recruitment AI (smaller deal sizes, fragmented buyer)
- Generative AI guardrails / red-teaming (different problem space)
- Public-sector AI (longest sales cycle of all)

## ICP and buyer

- **Primary buyer**: Head of Model Risk Management or Chief Compliance Officer at an EU-licensed bank, insurer, or BNPL/lending fintech with at least one production AI system used in credit/underwriting/fraud decisions.
- **Champion**: Lead model validator, AI/ML platform lead, or AI governance officer.
- **Decision criteria**: produces a binder a Notified Body or supervisor would accept; integrates with their existing model risk pipeline; ISO 42001 mapping; on-prem or EU-region SaaS.

## Pricing (initial)

- **Pilot**: €25,000 fixed-fee, 8-week design partnership, includes 1 AI system onboarded end-to-end. 5 pilot slots before GA.
- **Annual subscription**: €60k base + €12k per AI system in scope. Most buyers will land at €120–250k ACV.
- **Enterprise**: €250k+ with on-prem deployment, custom policy packs, SSO, audit-firm integrations.

## Deliverables in MVP (this scope)

| Capability | Status |
|---|---|
| Annex III risk classifier (Prohibited / High-Risk / Limited / Minimal) | ✅ in MVP |
| Article 9 risk management policy pack | ✅ in MVP |
| Article 10 data governance policy pack | ✅ in MVP |
| Article 13 transparency policy pack | ✅ in MVP |
| Article 14 human oversight policy pack | ✅ in MVP |
| Article 15 accuracy / robustness / cybersecurity policy pack | ✅ in MVP (rewritten) |
| Article 27 FRIA workflow | ✅ in MVP |
| Article 72 post-market monitoring webhook | ✅ in MVP |
| ISO 42001 Annex A control mapping | ✅ in MVP |
| Annex IV technical documentation generator (HTML + PDF-printable) | ✅ in MVP |
| Hash-chained append-only audit log | ✅ in MVP |
| Multi-tenant SaaS API (Fastify + SQLite/Postgres) | ✅ in MVP |
| API-key auth | ✅ in MVP |
| Docker / docker-compose | ✅ in MVP |

Out of MVP (v0.2+):
- Web UI (sell first, then design with the design partner)
- SSO / SAML
- Postgres production driver (SQLite is fine through first 5 customers)
- PDF rendering server-side (HTML → print-to-PDF in browser is enough for MVP)
- Audit-firm integrations (Deloitte, KPMG, PwC, EY)
- Continuous-monitoring connectors (MLflow, W&B, Vertex AI, Databricks)

## 90-day GTM plan

**Weeks 1–2 (now)**: Ship MVP. Cut a tagged v0.1 release. Set up landing page.
**Weeks 3–4**: 5 cold emails/day to Heads of Model Risk at named EU banks/insurers/fintechs with one screenshot, one example binder, and a "free 8-week pilot" offer. Goal: 1 design partner.
**Weeks 5–12**: Run 1–2 pilots. Iterate weekly. Deliver one production-grade Conformity Binder.
**Day 90**: Convert pilot to paid contract OR pivot positioning based on what they actually paid attention to. Apply to YC W27 or Seedcamp / EQT Ventures with the signed pilot as proof.

## Why this is fundable

- **Forced buying event**: 2 Aug 2026 high-risk deadline. Nothing accelerates B2B sales like a regulator-imposed date.
- **Brussels Effect**: EU AI Act is becoming the global default — same product sells into UK, APAC, Brazil over 24 months.
- **Defensible wedge**: deterministic policy kernel + signed artifact pipeline is the *audit-defensible* layer competitors blur into dashboards.
- **Compounding policy library**: every customer expands the rule library — moat thickens with usage.

## Step-by-Step Workflow: How to Run and Use AegisAI

This workflow describes how to initialize the AegisAI engine, register an AI system, and generate a regulatory-defensible Annex IV conformity binder.

### Phase 1: Setup & Initialization

1. **Start the Application Server**
   You can run AegisAI natively or via Docker.
   *Using Docker (Recommended for quick start):*
   ```bash
   docker compose up -d
   ```
   *Using Node natively:*
   ```bash
   npm install
   npm run build
   AEGIS_ADMIN_TOKEN=change-me npm start
   ```

2. **Register a Tenant (Organization)**
   Create a tenant to isolate your records and generate a unique API key for cryptographic signatures.
   ```bash
   curl -X POST http://localhost:8080/v1/orgs \
     -H 'x-admin-token: change-me' \
     -H 'content-type: application/json' \
     -d '{"name": "Example Bank"}'
   ```
   *Note:* Save the returned `API_KEY`. It is required for all subsequent API calls.

### Phase 2: Core Usage & Conformity Workflow

1. **Register the AI System**
   Define the AI model, its purpose, and deployment environment.
   ```bash
   SYSTEM_ID=$(curl -s -X POST http://localhost:8080/v1/systems \
     -H "x-api-key: $API_KEY" -H 'content-type: application/json' \
     -d '{
       "system_id": "credit-scorer-v3",
       "version": "3.1.0",
       "model_name": "GBM",
       "model_version": "v3.1",
       "intended_purpose": "consumer credit scoring",
       "deployment": {"environment":"PRODUCTION","region":"eu-west-1","deployment_date":"2026-04-01T00:00:00Z"}
     }' | jq -r .id)
   ```

2. **Classify the AI System (Annex III)**
   Run the classification endpoint to determine the risk tier under the EU AI Act (e.g., HIGH_RISK vs MINIMAL_RISK).
   ```bash
   curl -s -X POST http://localhost:8080/v1/systems/$SYSTEM_ID/classify \
     -H "x-api-key: $API_KEY" -H 'content-type: application/json' \
     -d '{ "questionnaire": { "creditworthiness_or_credit_scoring": true } }'
   ```

3. **Run Conformity Evaluation**
   Submit an evidence bundle. The deterministic policy engine will evaluate it against the EU AI Act (Articles 5, 9, 10, etc.) and ISO 42001 controls.
   ```bash
   SNAP_ID=$(jq ".system_version_id = \"$SYSTEM_ID\"" evidence-bundle.json | \
     curl -s -X POST http://localhost:8080/v1/evaluations \
     -H "x-api-key: $API_KEY" -H 'content-type: application/json' \
     -d @- | jq -r .id)
   ```

4. **Generate the Annex IV Binder**
   Fetch the cryptographically signed HTML technical documentation.
   ```bash
   curl -s "http://localhost:8080/v1/binders/$SNAP_ID" -H "x-api-key: $API_KEY" > binder.html
   open binder.html
   ```

### Phase 3: Sales & Demo Execution (GTM)

For marketing and GTM purposes, you can instantly generate a demo Annex IV binder for a fictional bank without running the full API lifecycle.
```bash
npm run demo:binder
```
This produces `marketing/demo-binder.html` which you can print to PDF and attach to sales emails or share with design partners.
