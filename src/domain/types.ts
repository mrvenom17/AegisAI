/**
 * Core Domain Types for AegisAI Compliance Engine
 * 
 * All types are immutable and validated via Zod schemas.
 * No implicit coercion, no `any` types.
 */

import { z } from 'zod';

// ============================================================================
// Compliance Status (Deterministic Outcome)
// ============================================================================

export const ComplianceStatusSchema = z.enum([
  'COMPLIANT',
  'COMPLIANT_WITH_WARNINGS',
  'NON_COMPLIANT',
  'NON_COMPLIANT_BLOCKING'
]);

export type ComplianceStatus = z.infer<typeof ComplianceStatusSchema>;

// ============================================================================
// Warning Taxonomy (Explicit Uncertainty)
// ============================================================================

export const WarningTypeSchema = z.enum([
  'WARN_DATA_MISSING',
  'WARN_THRESHOLD_NEAR',
  'WARN_POLICY_DEPRECATED',
  'WARN_EVIDENCE_STALE',
  'WARN_PARAMETER_OUT_OF_RANGE'
]);

export type WarningType = z.infer<typeof WarningTypeSchema>;

export const WarningSchema = z.object({
  type: WarningTypeSchema,
  obligation_id: z.string(),
  control_id: z.string().optional(),
  message: z.string(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  timestamp: z.string() // ISO8601 UTC
});

export type Warning = z.infer<typeof WarningSchema>;

// ============================================================================
// Rule Evaluation Result
// ============================================================================

export const RuleResultSchema = z.object({
  obligation_id: z.string(),
  control_id: z.string(),
  rule_id: z.string(),
  passed: z.boolean(),
  failure_mode: z.enum(['WARN', 'FAIL', 'BLOCK']),
  evaluated_at: z.string(), // ISO8601 UTC
  evidence_claim_refs: z.array(z.string()), // References to VerifiedClaim IDs
  parameters_used: z.record(z.unknown()), // Parameters from ParameterSet
  logic_result: z.unknown().optional() // Raw JSON-Logic result
});

export type RuleResult = z.infer<typeof RuleResultSchema>;

// ============================================================================
// Immutable Compliance Snapshot
// ============================================================================

export const ComplianceSnapshotSchema = z.object({
  id: z.string().uuid(), // UUIDv7 preferred, but UUIDv4 acceptable
  timestamp: z.string(), // ISO8601 UTC
  system_version_ref: z.string(), // Reference to SystemVersion
  policy_set_version: z.string(), // Semantic version or hash
  parameter_set_hash: z.string(), // SHA-256 hash of ParameterSet
  evidence_merkle_root: z.string(), // Merkle root of all VerifiedClaims
  final_status: ComplianceStatusSchema,
  warnings: z.array(WarningSchema),
  rule_evaluations: z.array(RuleResultSchema),
  signature: z.string(), // Cryptographic signature (base64 encoded)
  superseded_by: z.string().uuid().optional() // If this snapshot was superseded
});

export type ComplianceSnapshot = z.infer<typeof ComplianceSnapshotSchema>;

// ============================================================================
// System Registry Types
// ============================================================================

export const SystemVersionSchema = z.object({
  id: z.string().uuid(),
  system_id: z.string(),
  version: z.string(), // Semantic version
  model_name: z.string(),
  model_version: z.string(),
  deployment_context: z.object({
    environment: z.enum(['PRODUCTION', 'STAGING', 'DEVELOPMENT']),
    region: z.string(),
    deployment_date: z.string() // ISO8601 UTC
  }),
  registered_at: z.string(), // ISO8601 UTC
  locked: z.boolean(), // Locked during active audit cycles
  locked_until: z.string().optional() // ISO8601 UTC
});

export type SystemVersion = z.infer<typeof SystemVersionSchema>;

// ============================================================================
// Evidence Types
// ============================================================================

export const EvidenceTypeSchema = z.enum([
  'STRUCTURED_JSON',
  'DOCUMENT_PDF',
  'DOCUMENT_TXT',
  'METRICS_DATASET'
]);

export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;

export const RawEvidenceSchema = z.object({
  id: z.string().uuid(),
  type: EvidenceTypeSchema,
  content: z.unknown(), // Type-specific content
  metadata: z.object({
    submitted_at: z.string(), // ISO8601 UTC
    submitted_by: z.string(),
    source_system: z.string()
  }),
  content_hash: z.string() // SHA-256 hash of content
});

export type RawEvidence = z.infer<typeof RawEvidenceSchema>;

// ============================================================================
// Verified Claims (Post-Verification)
// ============================================================================

export const VerifiedClaimSchema = z.object({
  id: z.string().uuid(),
  evidence_vault_ref: z.string(), // Content address from Evidence Vault
  claim_type: z.string(), // e.g., "accuracy_metric", "bias_test_result"
  claim_data: z.record(z.unknown()), // Validated, structured claim data
  verified_at: z.string(), // ISO8601 UTC
  verifier_version: z.string(), // Version of verifier that validated this
  validation_metadata: z.object({
    schema_version: z.string(),
    validation_errors: z.array(z.string()).optional()
  })
});

export type VerifiedClaim = z.infer<typeof VerifiedClaimSchema>;

// ============================================================================
// Policy DSL Types
// ============================================================================

export const PolicyRuleSchema = z.object({
  obligation_id: z.string(), // e.g., "EU_AI_ACT_ART_15"
  control_id: z.string(),
  rule_id: z.string(),
  required_claims: z.array(z.string()), // Claim types required for evaluation
  parameters: z.record(z.unknown()), // Parameter definitions with defaults
  logic: z.unknown(), // JSON-Logic expression
  failure_mode: z.enum(['WARN', 'FAIL', 'BLOCK']),
  description: z.string().optional()
});

export type PolicyRule = z.infer<typeof PolicyRuleSchema>;

export const PolicySetSchema = z.object({
  version: z.string(),
  effective_date: z.string(), // ISO8601 UTC
  rules: z.array(PolicyRuleSchema),
  metadata: z.object({
    name: z.string(),
    description: z.string().optional(),
    regulatory_source: z.string()
  })
});

export type PolicySet = z.infer<typeof PolicySetSchema>;

// ============================================================================
// Parameter Set
// ============================================================================

export const ParameterSetSchema = z.object({
  id: z.string().uuid(),
  version: z.string(),
  parameters: z.record(z.unknown()), // Key-value pairs for policy evaluation
  effective_date: z.string(), // ISO8601 UTC
  signed_by: z.string().optional(),
  signature: z.string().optional()
});

export type ParameterSet = z.infer<typeof ParameterSetSchema>;

// ============================================================================
// Policy Engine Input/Output
// ============================================================================

export const PolicyEvaluationInputSchema = z.object({
  verified_claims: z.array(VerifiedClaimSchema),
  policy_rules: z.array(PolicyRuleSchema),
  parameters: z.record(z.unknown())
});

export type PolicyEvaluationInput = z.infer<typeof PolicyEvaluationInputSchema>;

export const ComplianceResultSchema = z.object({
  final_status: ComplianceStatusSchema,
  warnings: z.array(WarningSchema),
  rule_evaluations: z.array(RuleResultSchema),
  evaluated_at: z.string() // ISO8601 UTC
});

export type ComplianceResult = z.infer<typeof ComplianceResultSchema>;
