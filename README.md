# AegisAI

**EU AI Act conformity, in a single API call.**

AegisAI turns your existing model evaluations, fairness tests, and audit artefacts into a regulator-defensible **Annex IV technical documentation binder** — with cryptographically signed snapshots, Annex III risk classification, FRIA workflow (Article 27), post-market monitoring (Article 72), and ISO/IEC 42001 control coverage.

Built for EU banks, insurers, and lending fintechs deploying high-risk AI systems for credit, underwriting, and fraud — under the 2 Aug 2026 high-risk obligations deadline.

> Status: v0.1 MVP. Production-grade kernel + REST API + Docker. Web UI ships with v0.2.

## Why this exists

- The EU AI Act high-risk regime applies from **2 Aug 2026**. Penalties up to **€35M or 7% of global turnover**.
- Internal teams keep a hundred eval reports in a hundred Notion pages and call it compliance. A regulator wants **one signed binder, mapped to each obligation, reproducible from primary evidence.**
- That's what AegisAI produces.

## What you get

| Capability | Endpoint | Output |
|---|---|---|
| Annex III classification (Articles 5–7) | `POST /v1/systems/:id/classify` | Signed `RiskClassification` (PROHIBITED / HIGH_RISK / LIMITED_RISK / MINIMAL_RISK / GPAI) |
| Conformity evaluation (Articles 5, 9, 10, 13, 14, 15) | `POST /v1/evaluations` | Signed `ComplianceSnapshot` with rule-by-rule outcomes |
| FRIA workflow (Article 27) | `POST /v1/fria` etc. | DRAFT → IN_REVIEW → APPROVED state machine |
| Post-market monitoring (Article 72) | `POST /v1/monitoring/signals` | Webhook ingestion + 15-day Article 73 incident clock |
| ISO/IEC 42001 control coverage | bundled in binder | Annex A control-by-control PASS/PARTIAL/FAIL |
| Annex IV technical documentation | `GET /v1/binders/:snapshotId` | Print-to-PDF HTML, deterministic, signature-verifiable |
| Hash-chained audit log | `GET /v1/audit-log` | Tamper-evident chain across every state change |

Every record is scoped to your tenant and signed with your tenant's Ed25519 key. The signature on a snapshot covers its rule evaluations, evidence Merkle root (which itself binds submitter and verifier provenance, not just data), policy version, and parameter-set hash. Verification is one HTTP call.

## Run it

```bash
docker compose up -d
# Create a tenant (returns API key once — store it)
curl -X POST http://localhost:8080/v1/orgs \
  -H 'x-admin-token: change-me' \
  -H 'content-type: application/json' \
  -d '{"name": "Example Bank"}'
```

Or natively:

```bash
npm install
npm run build
AEGIS_ADMIN_TOKEN=change-me npm start
```

## End-to-end example

```bash
API_KEY="aegis_..."   # from /v1/orgs response
BASE=http://localhost:8080

# 1. Register your AI system
SYSTEM_ID=$(curl -s -X POST $BASE/v1/systems \
  -H "x-api-key: $API_KEY" -H 'content-type: application/json' \
  -d '{
    "system_id": "credit-scorer-v3",
    "version": "3.1.0",
    "model_name": "GBM",
    "model_version": "v3.1",
    "intended_purpose": "consumer credit scoring",
    "deployment": {"environment":"PRODUCTION","region":"eu-west-1","deployment_date":"2026-04-01T00:00:00Z"}
  }' | jq -r .id)

# 2. Classify it (Annex III)
curl -s -X POST $BASE/v1/systems/$SYSTEM_ID/classify \
  -H "x-api-key: $API_KEY" -H 'content-type: application/json' \
  -d '{ "questionnaire": { "creditworthiness_or_credit_scoring": true, ... } }'
# → {"tier":"HIGH_RISK", ...}

# 3. Run a multi-pack conformity evaluation
SNAP=$(curl -s -X POST $BASE/v1/evaluations \
  -H "x-api-key: $API_KEY" -H 'content-type: application/json' \
  -d @evidence-bundle.json | jq -r .id)

# 4. Generate the Annex IV binder
curl -s "$BASE/v1/binders/$SNAP" -H "x-api-key: $API_KEY" > binder.html
open binder.html  # print to PDF for your Notified Body
```

## Architecture (one diagram)

```
            ┌──────────────────────────────────────────────────────┐
HTTP API ──▶│  Risk Classifier  ┐                                  │
            │  Evidence Vault  ─┼─▶ Policy Engine ─▶ Snapshot Store│──▶ DocGen ──▶ Annex IV HTML
            │  Verifier        ─┘  (deterministic,  (Ed25519 sigs, │
            │                       JSON-Logic)      append-only)  │
            │  FRIA Service ─┐                                     │
            │  Monitoring   ─┴──▶ Audit Log (hash-chained)         │
            └──────────────────────────────────────────────────────┘
                                    │
                              SQLite (v0.1) / Postgres (v0.2)
```

- **Pure deterministic policy kernel.** Same evidence + same policy + same parameters → same Merkle root, same parameter hash, same final status. Snapshot ID is derived from the canonical inputs.
- **Provenance-bound Merkle tree.** Leaves bind submitter, source system, verifier version — not just claim data — so an audit can prove who said what.
- **Ed25519 signatures.** Per-tenant signing keys. No fallback "hash-as-signature" in any mode.
- **Append-only, hash-chained audit log.** Tampering with any historical row invalidates the chain from that point forward.
- **Multi-tenant by construction.** Every record carries `org_id`. Every API key authorises exactly one tenant. Tenant isolation is enforced at the storage layer.

## Policy packs included

- `art-5` — Article 5 prohibited practices (BLOCKING, fail-closed)
- `art-9` — Article 9 risk management system
- `art-10` — Article 10 data and data governance
- `art-13` — Article 13 transparency to deployers
- `art-14` — Article 14 human oversight
- `art-15` — Article 15 accuracy / robustness / cybersecurity

Each rule maps to ISO/IEC 42001 Annex A controls (`iso_42001_controls` field) so the conformity binder doubles as your ISO 42001 evidence pack.

## What's NOT in v0.1

- Web UI (sell first, build with the design partner — coming in v0.2)
- SSO / SAML
- Postgres driver (SQLite is fine through your first ~5 tenants)
- Server-side PDF rendering (HTML → browser print is sufficient for now)
- Audit-firm export connectors

## Development

```bash
npm install
npm run type-check
npm test
npm run build
```

## License

UNLICENSED — Internal Use Only.
For commercial licensing or design-partnership inquiries: see `PRODUCT.md`.
