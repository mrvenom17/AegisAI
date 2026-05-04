/**
 * Core domain types. Validated with Zod, no implicit coercion.
 */

import { z } from 'zod';

// ============================================================================
// Compliance status + warnings
// ============================================================================

export const ComplianceStatusSchema = z.enum([
  'COMPLIANT',
  'COMPLIANT_WITH_WARNINGS',
  'NON_COMPLIANT',
  'NON_COMPLIANT_BLOCKING'
]);
export type ComplianceStatus = z.infer<typeof ComplianceStatusSchema>;

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
  timestamp: z.string()
});
export type Warning = z.infer<typeof WarningSchema>;

// ============================================================================
// Rule evaluations
// ============================================================================

export const RuleResultSchema = z.object({
  obligation_id: z.string(),
  control_id: z.string(),
  rule_id: z.string(),
  passed: z.boolean(),
  failure_mode: z.enum(['WARN', 'FAIL', 'BLOCK']),
  evaluated_at: z.string(),
  evidence_claim_refs: z.array(z.string()),
  parameters_used: z.record(z.unknown()),
  logic_result: z.unknown().optional()
});
export type RuleResult = z.infer<typeof RuleResultSchema>;

// ============================================================================
// Compliance snapshot — immutable, signed, deterministically identified
// ============================================================================

export const ComplianceSnapshotSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string(),
  timestamp: z.string(),
  system_version_ref: z.string(),
  policy_set_version: z.string(),
  parameter_set_hash: z.string(),
  evidence_merkle_root: z.string(),
  final_status: ComplianceStatusSchema,
  warnings: z.array(WarningSchema),
  rule_evaluations: z.array(RuleResultSchema),
  signature: z.string(),
  signing_key_id: z.string(),
  superseded_by: z.string().uuid().optional()
});
export type ComplianceSnapshot = z.infer<typeof ComplianceSnapshotSchema>;

// ============================================================================
// System registry
// ============================================================================

export const RiskTierSchema = z.enum([
  'PROHIBITED',
  'HIGH_RISK',
  'LIMITED_RISK',
  'MINIMAL_RISK',
  'GPAI',
  'UNCLASSIFIED'
]);
export type RiskTier = z.infer<typeof RiskTierSchema>;

export const SystemVersionSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string(),
  system_id: z.string(),
  version: z.string(),
  model_name: z.string(),
  model_version: z.string(),
  intended_purpose: z.string(),
  risk_tier: RiskTierSchema.default('UNCLASSIFIED'),
  deployment_context: z.object({
    environment: z.enum(['PRODUCTION', 'STAGING', 'DEVELOPMENT']),
    region: z.string(),
    deployment_date: z.string()
  }),
  registered_at: z.string(),
  locked: z.boolean(),
  locked_until: z.string().optional()
});
export type SystemVersion = z.infer<typeof SystemVersionSchema>;

// ============================================================================
// Evidence
// ============================================================================

export const EvidenceTypeSchema = z.enum([
  'STRUCTURED_JSON',
  'DOCUMENT_PDF',
  'DOCUMENT_TXT',
  'METRICS_DATASET',
  'MONITORING_SIGNAL'
]);
export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;

export const RawEvidenceSchema = z.object({
  id: z.string(),
  org_id: z.string(),
  type: EvidenceTypeSchema,
  content: z.unknown(),
  metadata: z.object({
    submitted_at: z.string(),
    submitted_by: z.string(),
    source_system: z.string(),
    observed_at: z.string().optional()
  }),
  content_hash: z.string()
});
export type RawEvidence = z.infer<typeof RawEvidenceSchema>;

export const VerifiedClaimSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string(),
  evidence_vault_ref: z.string(),
  claim_type: z.string(),
  claim_data: z.record(z.unknown()),
  verified_at: z.string(),
  verifier_version: z.string(),
  validation_metadata: z.object({
    schema_version: z.string(),
    validation_errors: z.array(z.string()).optional()
  })
});
export type VerifiedClaim = z.infer<typeof VerifiedClaimSchema>;

// ============================================================================
// Policy DSL
// ============================================================================

export const PolicyRuleSchema = z.object({
  obligation_id: z.string(),
  control_id: z.string(),
  rule_id: z.string(),
  required_claims: z.array(z.string()),
  required_fields: z.record(z.array(z.string())).optional(),
  parameters: z.record(z.unknown()),
  logic: z.unknown(),
  failure_mode: z.enum(['WARN', 'FAIL', 'BLOCK']),
  fail_on_missing: z.boolean().default(true),
  iso_42001_controls: z.array(z.string()).optional(),
  description: z.string().optional()
});
export type PolicyRule = z.infer<typeof PolicyRuleSchema>;

export const PolicySetSchema = z.object({
  version: z.string(),
  effective_date: z.string(),
  rules: z.array(PolicyRuleSchema),
  metadata: z.object({
    name: z.string(),
    description: z.string().optional(),
    regulatory_source: z.string()
  })
});
export type PolicySet = z.infer<typeof PolicySetSchema>;

export const ParameterSetSchema = z.object({
  id: z.string(),
  version: z.string(),
  parameters: z.record(z.unknown()),
  effective_date: z.string(),
  signed_by: z.string().optional(),
  signature: z.string().optional()
});
export type ParameterSet = z.infer<typeof ParameterSetSchema>;

// ============================================================================
// Engine I/O
// ============================================================================

export const ComplianceResultSchema = z.object({
  final_status: ComplianceStatusSchema,
  warnings: z.array(WarningSchema),
  rule_evaluations: z.array(RuleResultSchema),
  evaluated_at: z.string()
});
export type ComplianceResult = z.infer<typeof ComplianceResultSchema>;

// ============================================================================
// Annex III risk classification
// ============================================================================

export const RiskClassificationSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string(),
  system_version_ref: z.string(),
  tier: RiskTierSchema,
  rationale: z.array(
    z.object({
      annex_iii_clause: z.string().optional(),
      article: z.string().optional(),
      matched: z.boolean(),
      explanation: z.string()
    })
  ),
  questionnaire: z.record(z.unknown()),
  classified_at: z.string(),
  signature: z.string()
});
export type RiskClassification = z.infer<typeof RiskClassificationSchema>;

// ============================================================================
// FRIA (Article 27)
// ============================================================================

export const FRIASchema = z.object({
  id: z.string().uuid(),
  org_id: z.string(),
  system_version_ref: z.string(),
  status: z.enum(['DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED']),
  deployer_organization: z.string(),
  intended_purpose: z.string(),
  affected_categories: z.array(z.string()),
  usage_period: z.object({
    start: z.string(),
    end: z.string().optional()
  }),
  risks_identified: z.array(
    z.object({
      risk: z.string(),
      likelihood: z.enum(['LOW', 'MEDIUM', 'HIGH']),
      severity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
      affected_rights: z.array(z.string())
    })
  ),
  mitigations: z.array(
    z.object({
      mitigation: z.string(),
      responsible_role: z.string(),
      review_cadence: z.string()
    })
  ),
  human_oversight_measures: z.array(z.string()),
  created_at: z.string(),
  approved_at: z.string().optional(),
  approved_by: z.string().optional()
});
export type FRIA = z.infer<typeof FRIASchema>;

// ============================================================================
// Post-market monitoring (Article 72)
// ============================================================================

export const MonitoringSignalSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string(),
  system_version_ref: z.string(),
  observed_at: z.string(),
  signal_type: z.enum([
    'PERFORMANCE_DRIFT',
    'INPUT_DRIFT',
    'INCIDENT',
    'NEAR_MISS',
    'USER_FEEDBACK',
    'BIAS_OBSERVED'
  ]),
  payload: z.record(z.unknown()),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  reported_to_authority: z.boolean().default(false),
  ingested_at: z.string()
});
export type MonitoringSignal = z.infer<typeof MonitoringSignalSchema>;

// ============================================================================
// Audit log
// ============================================================================

export const AuditEntrySchema = z.object({
  seq: z.number().int().nonnegative(),
  org_id: z.string(),
  timestamp: z.string(),
  actor: z.string(),
  action: z.string(),
  target_type: z.string(),
  target_id: z.string(),
  payload: z.record(z.unknown()),
  prev_hash: z.string(),
  entry_hash: z.string()
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;
