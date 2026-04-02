/**
 * Policy Engine Service
 * 
 * Pure function that evaluates policies deterministically.
 * Uses JSON-Logic for rule evaluation.
 * NEVER guesses or infers compliance.
 */

// @ts-ignore - json-logic-js has no type definitions
import jsonLogic from 'json-logic-js';
import {
  VerifiedClaim,
  PolicyRule,
  ComplianceResult,
  ComplianceStatus,
  Warning,
  RuleResult
} from '../domain/types.js';
import { ComplianceResultSchema } from '../domain/types.js';

export interface PolicyEngineOptions {
  // No options needed - pure function
}

export class PolicyEngine {
  constructor(_options: PolicyEngineOptions = {}) {
    // Pure function - no state
  }

  /**
   * Evaluate policies against verified claims.
   * 
   * This is a PURE FUNCTION:
   * - Same inputs always produce same outputs
   * - No side effects
   * - No external dependencies beyond verified claims
   */
  evaluate(
    verifiedClaims: VerifiedClaim[],
    policyRules: PolicyRule[],
    parameters: Record<string, unknown>
  ): ComplianceResult {
    const ruleEvaluations: RuleResult[] = [];
    const warnings: Warning[] = [];
    let hasBlockingFailure = false;
    let hasNonBlockingFailure = false;

    // Evaluate each rule
    for (const rule of policyRules) {
      const evaluation = this.evaluateRule(rule, verifiedClaims, parameters);
      ruleEvaluations.push(evaluation);

      // Check for missing required claims
      const missingClaims = this.checkMissingClaims(rule, verifiedClaims);
      if (missingClaims.length > 0) {
        // Missing required data = NON_COMPLIANT or BLOCKING
        const failureMode = rule.failure_mode === 'BLOCK' ? 'BLOCK' : 'FAIL';
        
        if (failureMode === 'BLOCK') {
          hasBlockingFailure = true;
        } else {
          hasNonBlockingFailure = true;
        }

        warnings.push({
          type: 'WARN_DATA_MISSING',
          obligation_id: rule.obligation_id,
          control_id: rule.control_id,
          message: `Missing required claims: ${missingClaims.join(', ')}`,
          severity: failureMode === 'BLOCK' ? 'HIGH' : 'MEDIUM',
          timestamp: new Date().toISOString()
        });

        // If blocking, mark rule as failed
        if (failureMode === 'BLOCK') {
          evaluation.passed = false;
        }
      }

      // Evaluate rule logic if all required claims are present
      if (missingClaims.length === 0) {
        const logicResult = this.evaluateRuleLogic(rule, verifiedClaims, parameters);
        evaluation.logic_result = logicResult;
        evaluation.passed = logicResult === true;

        if (!evaluation.passed) {
          if (rule.failure_mode === 'BLOCK') {
            hasBlockingFailure = true;
          } else {
            hasNonBlockingFailure = true;
          }
        }
      } else {
        // Missing claims - rule cannot be evaluated
        evaluation.passed = false;
      }
    }

    // Determine final status
    const finalStatus = this.determineFinalStatus(
      hasBlockingFailure,
      hasNonBlockingFailure,
      warnings
    );

    const result: ComplianceResult = {
      final_status: finalStatus,
      warnings,
      rule_evaluations: ruleEvaluations,
      evaluated_at: new Date().toISOString()
    };

    // Validate with Zod
    return ComplianceResultSchema.parse(result);
  }

  /**
   * Evaluate a single rule.
   */
  private evaluateRule(
    rule: PolicyRule,
    verifiedClaims: VerifiedClaim[],
    parameters: Record<string, unknown>
  ): RuleResult {
    // Get relevant claims for this rule
    const relevantClaims = verifiedClaims.filter(claim =>
      rule.required_claims.includes(claim.claim_type)
    );

    // Merge rule parameters with global parameters (rule parameters take precedence)
    const mergedParameters = {
      ...parameters,
      ...rule.parameters
    };

    // Evaluate logic (if claims are present)
    let logicResult: unknown = undefined;
    let passed = false;

    if (relevantClaims.length > 0) {
      logicResult = this.evaluateRuleLogic(rule, verifiedClaims, mergedParameters);
      passed = logicResult === true;
    }

    return {
      obligation_id: rule.obligation_id,
      control_id: rule.control_id,
      rule_id: rule.rule_id,
      passed,
      failure_mode: rule.failure_mode,
      evaluated_at: new Date().toISOString(),
      evidence_claim_refs: relevantClaims.map(c => c.id),
      parameters_used: mergedParameters,
      logic_result: logicResult
    };
  }

  /**
   * Evaluate rule logic using JSON-Logic.
   */
  private evaluateRuleLogic(
    rule: PolicyRule,
    verifiedClaims: VerifiedClaim[],
    parameters: Record<string, unknown>
  ): unknown {
    // Build data context for JSON-Logic
    const data: Record<string, unknown> = {
      ...parameters
    };

    // Add claims to data context, keyed by claim type
    for (const claim of verifiedClaims) {
      if (rule.required_claims.includes(claim.claim_type)) {
        // If multiple claims of same type, use array
        if (data[claim.claim_type]) {
          if (Array.isArray(data[claim.claim_type])) {
            (data[claim.claim_type] as unknown[]).push(claim.claim_data);
          } else {
            data[claim.claim_type] = [data[claim.claim_type], claim.claim_data];
          }
        } else {
          data[claim.claim_type] = claim.claim_data;
        }
      }
    }

    // Evaluate JSON-Logic expression
    try {
      return jsonLogic.apply(rule.logic, data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`JSON-Logic evaluation failed for rule ${rule.rule_id}: ${errorMessage}`);
    }
  }

  /**
   * Check if required claims are missing.
   */
  private checkMissingClaims(
    rule: PolicyRule,
    verifiedClaims: VerifiedClaim[]
  ): string[] {
    const availableClaimTypes = new Set(
      verifiedClaims.map(claim => claim.claim_type)
    );

    return rule.required_claims.filter(
      requiredType => !availableClaimTypes.has(requiredType)
    );
  }

  /**
   * Determine final compliance status.
   */
  private determineFinalStatus(
    hasBlockingFailure: boolean,
    hasNonBlockingFailure: boolean,
    warnings: Warning[]
  ): ComplianceStatus {
    if (hasBlockingFailure) {
      return 'NON_COMPLIANT_BLOCKING';
    }

    if (hasNonBlockingFailure) {
      return 'NON_COMPLIANT';
    }

    if (warnings.length > 0) {
      return 'COMPLIANT_WITH_WARNINGS';
    }

    return 'COMPLIANT';
  }
}
