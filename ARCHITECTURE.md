# AegisAI System Architecture

## Core Infrastructure

AegisAI employs a modular, service-oriented architecture written in TypeScript. Designed for a Node.js (>=18.0) environment, it focuses on deterministic, policy-driven evaluation of AI systems against regulatory frameworks (specifically the EU AI Act). The system is robust, leveraging `zod` for strict runtime schema validation, `json-logic-js` for evaluating complex declarative rules, and native `crypto` to secure the integrity of compliance evidence.

## Design Patterns

1.  **Registry Pattern (`SystemRegistry`)**: Manages the lifecycle and metadata (e.g., purpose, deployment status) of AI systems under evaluation, providing a central repository for querying systems.
2.  **Adapter Pattern (`EvidenceVerifier`, `StructuredJSONAdapter`, `DocumentAdapter`)**: Normalizes heterogeneous evidence inputs (e.g., datasets, model metrics, technical documentation) into a standardized format for evaluation. This ensures the `PolicyEngine` always operates on clean, expected data structures.
3.  **Facade/Orchestrator Pattern (`Orchestrator`)**: The central coordinator that abstracts the complex interactions between the vault, engine, and reporting services. It provides a simple entry point for executing an entire compliance audit workflow.

## Module Interactions

The core execution path is orchestrated by the `Orchestrator` service, creating a highly structured and auditable process flow:

1.  **Initialization**: 
    *   The `PolicyLoader` parses JSON rule definitions from the `policies/` directory.
    *   The AI system to be evaluated is registered or retrieved via the `SystemRegistry`.
2.  **Evidence Collection & Verification**: 
    *   Documentation, test results, and operational data are submitted to the `EvidenceVault`.
    *   The `EvidenceVerifier` ensures this data matches expected schemas (often using `zod`) and formats.
    *   The `EvidenceVault` uses utilities (like `crypto.ts` for hashing) to guarantee immutability of the submitted evidence.
3.  **Policy Evaluation**: 
    *   The `Orchestrator` triggers the `PolicyEngine`.
    *   The `PolicyEngine` inputs the verified evidence and system metadata against the loaded JSON policy rules, utilizing `json-logic-js` to determine compliance or non-compliance.
4.  **Snapshot & Reporting**: 
    *   The outcome of the evaluation, along with the exact state of the evidence and policies at that point in time, is persisted to the `SnapshotStore` for historical auditability and reproducibility.
    *   Finally, the `DocGen` service formats these results into human-readable compliance reports.

## System Principles ("Iron Laws")

1. **Determinism > Convenience**: Identical inputs produce identical outputs forever
2. **Evidence Verification > Evidence Storage**: Evidence must be type-validated before evaluation
3. **Configuration IS Interpretation**: All thresholds come from signed Parameter Sets
4. **Immutable Compliance**: Compliance is an immutable snapshot, not a boolean
5. **Explicit Uncertainty**: Missing data is a first-class signal

## Service Architecture

### 1. System Registry
**Purpose**: Registers AI systems, models, versions, and deployment context.

**Key Features**:
- Versioning support
- Lock management during audit cycles
- Immutable system version records

**Interface**:
- `registerSystemVersion()`: Create new system version
- `getSystemVersion()`: Retrieve by ID
- `lockSystemVersion()` / `unlockSystemVersion()`: Lock management
- `isLocked()`: Check lock status

### 2. Evidence Vault
**Purpose**: Write-Once-Read-Many (WORM) storage for raw evidence.

**Key Features**:
- Content-addressable storage (deduplication)
- Cryptographic content hashing
- Integrity verification

**Interface**:
- `storeEvidence()`: Store evidence, return content address
- `getEvidence()`: Retrieve by content address
- `verifyEvidenceIntegrity()`: Verify content hash

### 3. Evidence Verifier
**Purpose**: Validates evidence and emits VerifiedClaims. ONLY component allowed to mark evidence as valid.

**Key Features**:
- Adapter pattern for different evidence types
- Type A: Structured JSON (Zod schema validation)
- Type B: Documents (metadata, signature, freshness checks)
- Versioned verifier

**Interface**:
- `registerAdapter()`: Register adapter for evidence type
- `verifyEvidence()`: Verify and create VerifiedClaim
- `getVerifiedClaim()`: Retrieve verified claim

### 4. Policy Engine
**Purpose**: Pure function that evaluates policies deterministically.

**Key Features**:
- JSON-Logic for rule evaluation
- Explicit missing data handling
- Deterministic evaluation (no side effects)
- Failure mode classification (WARN, FAIL, BLOCK)

**Interface**:
- `evaluate()`: Evaluate policies against verified claims

**Evaluation Flow**:
1. Check for missing required claims → WARN/BLOCK
2. Evaluate rule logic if claims present
3. Aggregate results → final status

### 5. Snapshot Store
**Purpose**: Stores immutable ComplianceSnapshots. Acts as legal record.

**Key Features**:
- Immutable storage (no updates, only supersession)
- Cryptographic signing
- Supersession tracking
- Latest snapshot retrieval

**Interface**:
- `storeSnapshot()`: Store immutable snapshot
- `supersedeSnapshot()`: Supersede with new snapshot
- `getSnapshot()`: Retrieve by ID
- `verifySnapshotSignature()`: Verify signature
- `getLatestSnapshot()`: Get latest for system version

### 6. Orchestrator
**Purpose**: Coordinates the compliance evaluation flow.

**Flow**:
1. Validate system version (not locked)
2. Store evidence in vault
3. Verify evidence
4. Evaluate policies
5. Create immutable snapshot

**Interface**:
- `evaluateCompliance()`: Execute full evaluation flow
- `getComplianceStatus()`: Get latest snapshot
- `getComplianceHistory()`: Get all snapshots

### 7. DocGen
**Purpose**: Generates Annex IV technical documentation from snapshots.

**Key Features**:
- Uses ONLY snapshot data
- No external inputs
- Regulator-defensible format

## Data Flow

```
[System Registration]
       ↓
[Evidence Submission] → [Evidence Vault] → [Evidence Verifier] → [VerifiedClaims]
       ↓
[Policy Set + Parameter Set]
       ↓
[Policy Engine] → [ComplianceResult]
       ↓
[Snapshot Store] → [ComplianceSnapshot]
       ↓
[DocGen] → [Annex IV Documentation]
```

## Policy DSL

Policies are externalized in JSON format:

```json
{
  "version": "1.0.0",
  "effective_date": "ISO8601",
  "metadata": { ... },
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

## Cryptographic Guarantees

1. **Content Addressing**: Evidence stored by SHA-256 hash
2. **Merkle Trees**: Evidence Merkle root in snapshots
3. **Digital Signatures**: Snapshots signed with RSA-SHA256
4. **Deterministic Hashing**: Sorted keys for consistent hashing

## Compliance Status Determination

```
BLOCKING failure → NON_COMPLIANT_BLOCKING
Non-blocking failure → NON_COMPLIANT
Warnings only → COMPLIANT_WITH_WARNINGS
No issues → COMPLIANT
```

## Missing Data Handling

- **Missing required claims**: NON_COMPLIANT or BLOCKING (based on failure_mode)
- **Missing optional claims**: WARNING
- **No silent defaults**: All missing data is explicit

## Production Considerations

1. **Persistence**: Replace in-memory Maps with persistent storage
2. **UUIDv7**: Use time-ordered UUIDs for snapshots
3. **Key Management**: Secure private key storage for signing
4. **Audit Logging**: Log all operations for forensic analysis
5. **Concurrency**: Handle concurrent evaluations safely
6. **Performance**: Optimize for large evidence sets
