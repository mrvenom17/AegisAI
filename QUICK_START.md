# Quick Start Guide

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn

## Installation

```bash
npm install
```

## Build

```bash
npm run build
```

## Run Example

```bash
npm run example
```

This will execute the end-to-end example demonstrating:
1. System registration
2. Evidence ingestion
3. Evidence verification
4. Policy evaluation
5. Immutable snapshot creation

## Project Structure

```
AegisAI/
├── src/
│   ├── domain/           # Core domain models (Zod schemas)
│   ├── services/         # Core services (Registry, Vault, Verifier, etc.)
│   ├── utils/            # Cryptographic utilities, UUID generation
│   └── index.ts          # Main exports
├── policies/              # Policy definitions (JSON)
├── examples/              # Example code
└── dist/                  # Compiled output (after build)
```

## Core Services

### System Registry
Registers AI systems and versions.

```typescript
const registry = new SystemRegistry();
const systemVersion = registry.registerSystemVersion(
  'system-id',
  '1.0.0',
  'ModelName',
  'v1.0',
  { environment: 'PRODUCTION', region: 'EU', deploymentDate: '2024-01-01T00:00:00Z' }
);
```

### Evidence Vault
Stores evidence with content addressing.

```typescript
const vault = new EvidenceVault();
const address = vault.storeEvidence(
  'STRUCTURED_JSON',
  { accuracy: 0.95 },
  { submitted_by: 'user', source_system: 'system' }
);
```

### Evidence Verifier
Verifies evidence and creates VerifiedClaims.

```typescript
const verifier = new EvidenceVerifier({ vault });
verifier.registerAdapter('STRUCTURED_JSON', new StructuredJSONAdapter({}, 'claim_type'));
const claim = verifier.verifyEvidence(address);
```

### Policy Engine
Evaluates policies deterministically.

```typescript
const engine = new PolicyEngine();
const result = engine.evaluate(verifiedClaims, policyRules, parameters);
```

### Orchestrator
Coordinates the full compliance evaluation flow.

```typescript
const orchestrator = new Orchestrator({ registry, vault, verifier, policyEngine, snapshotStore });
const snapshot = await orchestrator.evaluateCompliance({
  systemVersionId: systemVersion.id,
  evidenceSubmissions: [...],
  policySet: policySet,
  parameterSet: parameterSet
});
```

## Policy Format

Policies are defined in JSON:

```json
{
  "version": "1.0.0",
  "effective_date": "2024-08-01T00:00:00Z",
  "metadata": {
    "name": "Policy Name",
    "regulatory_source": "EU AI Act"
  },
  "rules": [
    {
      "obligation_id": "EU_AI_ACT_ART_15",
      "control_id": "ART_15_ACCURACY",
      "rule_id": "ART_15_ACCURACY_THRESHOLD",
      "required_claims": ["accuracy_metric"],
      "parameters": { "min_accuracy_threshold": 0.95 },
      "logic": { ">=": [{ "var": "accuracy_metric.accuracy" }, { "var": "min_accuracy_threshold" }] },
      "failure_mode": "FAIL"
    }
  ]
}
```

## Compliance Status

- `COMPLIANT`: All rules passed, no warnings
- `COMPLIANT_WITH_WARNINGS`: All rules passed, but warnings present
- `NON_COMPLIANT`: Some rules failed (non-blocking)
- `NON_COMPLIANT_BLOCKING`: Blocking rule failed

## Next Steps

1. Review `ARCHITECTURE.md` for system design
2. Review `IMPLEMENTATION_NOTES.md` for production considerations
3. Examine `examples/end-to-end-example.ts` for usage patterns
4. Customize policies in `policies/` directory
