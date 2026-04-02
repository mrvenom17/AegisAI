# Implementation Notes

## Assumptions & Design Decisions

### 1. Evidence Type to Claim Type Mapping
**Current Implementation**: Evidence content includes a `claim_type` field that is extracted during verification.

**Production Recommendation**: 
- Use evidence metadata to route to claim-type-specific adapters
- Or implement a routing table: `(evidence_type, metadata) -> adapter`
- Consider evidence schema registry for automatic routing

### 2. Storage Layer
**Current Implementation**: In-memory Maps for all services.

**Production Requirements**:
- **System Registry**: PostgreSQL with versioning support
- **Evidence Vault**: Immutable object storage (S3 with versioning, IPFS, or similar)
- **Snapshot Store**: PostgreSQL with append-only table, indexed by system_version_ref
- **Verified Claims**: PostgreSQL with content-addressable indexing

### 3. Cryptographic Signing
**Current Implementation**: Uses hash as signature if no private key provided (development mode).

**Production Requirements**:
- RSA-2048 or ECDSA-P256 private keys stored in HSM or key management service
- Key rotation strategy
- Signature verification on all snapshot retrievals

### 4. UUID Generation
**Current Implementation**: Uses `crypto.randomUUID()` (UUIDv4).

**Production Recommendation**: 
- Use UUIDv7 for time-ordered IDs
- Enables efficient chronological queries
- Consider ULID as alternative

### 5. Policy Evaluation
**Current Implementation**: JSON-Logic for rule evaluation.

**Production Considerations**:
- Validate all JSON-Logic expressions during policy load
- Sandbox execution environment for untrusted policies
- Performance optimization for large claim sets
- Caching of compiled logic expressions

### 6. Missing Data Handling
**Current Implementation**: Missing required claims → NON_COMPLIANT or BLOCKING based on failure_mode.

**Production Enhancements**:
- Explicit missing data registry
- Time-based staleness checks
- Escalation workflows for missing critical evidence

### 7. Deterministic JSON Serialization
**Current Implementation**: Custom `deterministicStringify()` with sorted keys.

**Production Recommendation**:
- Use canonical JSON library (e.g., `canonical-json`)
- Ensure consistent ordering across all environments
- Validate determinism in CI/CD

### 8. Merkle Tree Implementation
**Current Implementation**: Binary tree with deterministic ordering.

**Production Considerations**:
- Optimize for large evidence sets (thousands of claims)
- Consider Merkle tree persistence for incremental updates
- Support Merkle proof generation for audit verification

## Critical Paths (No Stubs)

All critical paths are implemented:
- ✅ Evidence storage and retrieval
- ✅ Evidence verification with adapters
- ✅ Policy evaluation with JSON-Logic
- ✅ Snapshot creation and signing
- ✅ Cryptographic hashing and Merkle trees
- ✅ Deterministic evaluation logic

## Testing Requirements

### Unit Tests Needed
1. **Crypto Utilities**: Test deterministic hashing, Merkle trees, signing
2. **Policy Engine**: Test rule evaluation, missing data handling, status determination
3. **Evidence Verifier**: Test adapter pattern, validation logic
4. **Orchestrator**: Test full flow, error handling

### Integration Tests Needed
1. End-to-end compliance evaluation
2. Snapshot supersession
3. System version locking
4. Evidence integrity verification

### Determinism Tests
1. Same inputs produce same outputs
2. Snapshot signatures are consistent
3. Merkle roots are deterministic

## Security Considerations

1. **Input Validation**: All inputs validated via Zod schemas
2. **SQL Injection**: N/A (no SQL in current implementation)
3. **Code Injection**: JSON-Logic expressions validated during policy load
4. **Key Management**: Private keys must be stored securely (HSM recommended)
5. **Audit Logging**: All operations should be logged for forensic analysis

## Performance Optimizations

1. **Evidence Deduplication**: Already implemented via content addressing
2. **Policy Caching**: Cache compiled JSON-Logic expressions
3. **Batch Verification**: Verify multiple evidence items in parallel
4. **Snapshot Indexing**: Index by system_version_ref, timestamp for fast queries

## Regulatory Compliance Features

1. **Immutable Snapshots**: Cannot be modified, only superseded
2. **Chain of Custody**: Evidence Merkle root provides cryptographic proof
3. **Audit Trail**: All snapshots are timestamped and signed
4. **Policy Versioning**: Policy set version tracked in snapshots
5. **Parameter Tracking**: Parameter set hash ensures reproducibility
