/**
 * Policy Engine — pure deterministic evaluation.
 *
 * Fixes vs. v0:
 * - Single evaluation pass per rule (no double-eval drift between
 *   `evaluateRule` and `evaluate`).
 * - `parameters_used` reflects the parameters actually applied to the logic.
 * - `fail_on_missing` honoured per rule. Default = true (fail-closed for
 *   regulatory red-line checks like Article 5).
 * - `required_fields` enforces that named fields exist on a claim before
 *   evaluation, preventing the "omit the field, slip past `!=`" bypass.
 */

import jsonLogic from 'json-logic-js';
type RulesLogic = Parameters<typeof jsonLogic.apply>[0];
import {
  VerifiedClaim,
  PolicyRule,
  ComplianceResult,
  ComplianceStatus,
  Warning,
  RuleResult,
  ComplianceResultSchema
} from '../domain/types.js';

export class PolicyEngine {
  evaluate(
    verifiedClaims: VerifiedClaim[],
    policyRules: PolicyRule[],
    parameters: Record<string, unknown>,
    now: () => string = () => new Date().toISOString()
  ): ComplianceResult {
    const ruleEvaluations: RuleResult[] = [];
    const warnings: Warning[] = [];
    let hasBlockingFailure = false;
    let hasNonBlockingFailure = false;

    for (const rule of policyRules) {
      // Rule-specific parameters override globals (rule wins).
      const mergedParameters: Record<string, unknown> = {
        ...parameters,
        ...rule.parameters
      };

      const missingClaims = this.missingClaimTypes(rule, verifiedClaims);
      const missingFields = this.missingRequiredFields(rule, verifiedClaims);
      const evaluatedAt = now();
      const relevantClaims = verifiedClaims.filter((c) =>
        rule.required_claims.includes(c.claim_type)
      );

      let logicResult: unknown = undefined;
      let passed = false;
      let failureReason: string | undefined;

      if (missingClaims.length > 0 || missingFields.length > 0) {
        // Fail-closed by default. A regulator-grade red-line check must
        // never silently pass on absent evidence.
        passed = !rule.fail_on_missing;
        failureReason =
          missingClaims.length > 0
            ? `Missing required claim types: ${missingClaims.join(', ')}`
            : `Missing required fields: ${missingFields.join(', ')}`;

        warnings.push({
          type: 'WARN_DATA_MISSING',
          obligation_id: rule.obligation_id,
          control_id: rule.control_id,
          message: failureReason,
          severity: rule.failure_mode === 'BLOCK' ? 'HIGH' : 'MEDIUM',
          timestamp: evaluatedAt
        });
      } else {
        const data: Record<string, unknown> = { ...mergedParameters };
        for (const claim of relevantClaims) {
          if (data[claim.claim_type] === undefined) {
            data[claim.claim_type] = claim.claim_data;
          } else if (Array.isArray(data[claim.claim_type])) {
            (data[claim.claim_type] as unknown[]).push(claim.claim_data);
          } else {
            data[claim.claim_type] = [data[claim.claim_type], claim.claim_data];
          }
        }

        try {
          logicResult = jsonLogic.apply(rule.logic as RulesLogic, data);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new Error(
            `JSON-Logic evaluation failed for rule ${rule.rule_id}: ${msg}`
          );
        }
        passed = logicResult === true;
      }

      if (!passed) {
        if (rule.failure_mode === 'BLOCK') hasBlockingFailure = true;
        else if (rule.failure_mode === 'FAIL') hasNonBlockingFailure = true;
      }

      ruleEvaluations.push({
        obligation_id: rule.obligation_id,
        control_id: rule.control_id,
        rule_id: rule.rule_id,
        passed,
        failure_mode: rule.failure_mode,
        evaluated_at: evaluatedAt,
        evidence_claim_refs: relevantClaims.map((c) => c.id),
        parameters_used: mergedParameters,
        logic_result: logicResult ?? failureReason,
        verified_claims_used: relevantClaims.map((c) => ({
          claim_id: c.id,
          claim_type: c.claim_type,
          evidence_vault_ref: c.evidence_vault_ref,
          submitted_by: c.submitted_by,
          source_system: c.source_system,
          observed_at: c.observed_at,
          claim_data: c.claim_data
        }))
      });
    }

    const finalStatus = this.determineFinalStatus(
      hasBlockingFailure,
      hasNonBlockingFailure,
      warnings
    );

    return ComplianceResultSchema.parse({
      final_status: finalStatus,
      warnings,
      rule_evaluations: ruleEvaluations,
      evaluated_at: now()
    });
  }

  private missingClaimTypes(
    rule: PolicyRule,
    claims: VerifiedClaim[]
  ): string[] {
    const present = new Set(claims.map((c) => c.claim_type));
    return rule.required_claims.filter((t) => !present.has(t));
  }

  private missingRequiredFields(
    rule: PolicyRule,
    claims: VerifiedClaim[]
  ): string[] {
    if (!rule.required_fields) return [];
    const missing: string[] = [];
    for (const [claimType, fields] of Object.entries(rule.required_fields)) {
      const claim = claims.find((c) => c.claim_type === claimType);
      if (!claim) {
        for (const f of fields) missing.push(`${claimType}.${f}`);
        continue;
      }
      for (const f of fields) {
        if (!(f in claim.claim_data) || claim.claim_data[f] === null) {
          missing.push(`${claimType}.${f}`);
        }
      }
    }
    return missing;
  }

  private determineFinalStatus(
    blocking: boolean,
    nonBlocking: boolean,
    warnings: Warning[]
  ): ComplianceStatus {
    if (blocking) return 'NON_COMPLIANT_BLOCKING';
    if (nonBlocking) return 'NON_COMPLIANT';
    if (warnings.length > 0) return 'COMPLIANT_WITH_WARNINGS';
    return 'COMPLIANT';
  }
}
