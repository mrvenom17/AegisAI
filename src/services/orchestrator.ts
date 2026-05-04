/**
 * Orchestrator — coordinates the full conformity evaluation flow.
 *
 * Provenance-aware Merkle root: leaves bind submitter, source_system,
 * verifier_version, claim_type, and claim_data — not just claim_data.
 */

import {
  VerifiedClaim,
  PolicySet,
  ParameterSet,
  ComplianceSnapshot
} from '../domain/types.js';
import { SystemRegistry } from './system-registry.js';
import { EvidenceVault } from './evidence-vault.js';
import { EvidenceVerifier } from './evidence-verifier.js';
import { PolicyEngine } from './policy-engine.js';
import { SnapshotStore } from './snapshot-store.js';
import { hashObject, merkleRoot } from '../utils/crypto.js';
import { AuditLog } from './audit-log.js';

export interface OrchestratorOptions {
  registry: SystemRegistry;
  vault: EvidenceVault;
  verifier: EvidenceVerifier;
  policyEngine: PolicyEngine;
  snapshotStore: SnapshotStore;
  auditLog: AuditLog;
}

export interface EvidenceSubmission {
  type:
    | 'STRUCTURED_JSON'
    | 'DOCUMENT_PDF'
    | 'DOCUMENT_TXT'
    | 'METRICS_DATASET'
    | 'MONITORING_SIGNAL';
  content: unknown;
  metadata: {
    submitted_by: string;
    source_system: string;
    observed_at?: string;
  };
  claim_type_hint?: string;
}

export interface ComplianceEvaluationRequest {
  orgId: string;
  systemVersionId: string;
  evidenceSubmissions: EvidenceSubmission[];
  policySet: PolicySet;
  parameterSet: ParameterSet;
  actor: string;
}

export class Orchestrator {
  constructor(private readonly opts: OrchestratorOptions) {}

  async evaluateCompliance(
    req: ComplianceEvaluationRequest
  ): Promise<ComplianceSnapshot> {
    const sv = this.opts.registry.getSystemVersion(
      req.systemVersionId,
      req.orgId
    );
    if (this.opts.registry.isLocked(sv.id)) {
      throw new Error(
        `System version ${sv.id} is locked and cannot be evaluated`
      );
    }

    const verifiedClaims: VerifiedClaim[] = [];
    for (const ev of req.evidenceSubmissions) {
      const addr = this.opts.vault.storeEvidence(req.orgId, ev.type, ev.content, {
        submitted_by: ev.metadata.submitted_by,
        source_system: ev.metadata.source_system,
        observed_at: ev.metadata.observed_at
      });
      const claim = this.opts.verifier.verifyEvidence(addr, ev.claim_type_hint);
      verifiedClaims.push(claim);
    }

    const result = this.opts.policyEngine.evaluate(
      verifiedClaims,
      req.policySet.rules,
      req.parameterSet.parameters
    );

    const merkle = merkleRoot(
      verifiedClaims.map((c) =>
        hashObject({
          claim_type: c.claim_type,
          claim_data: c.claim_data,
          evidence_vault_ref: c.evidence_vault_ref,
          verifier_version: c.verifier_version
        })
      )
    );

    const snapshot = this.opts.snapshotStore.storeSnapshot({
      org_id: req.orgId,
      system_version_ref: sv.id,
      policy_set_version: req.policySet.version,
      parameter_set_hash: hashObject(req.parameterSet.parameters),
      evidence_merkle_root: merkle,
      final_status: result.final_status,
      warnings: result.warnings,
      rule_evaluations: result.rule_evaluations
    });

    this.opts.auditLog.append({
      orgId: req.orgId,
      actor: req.actor,
      action: 'COMPLIANCE_EVALUATED',
      targetType: 'compliance_snapshot',
      targetId: snapshot.id,
      payload: {
        system_version_ref: sv.id,
        final_status: snapshot.final_status,
        policy_set_version: snapshot.policy_set_version
      }
    });

    return snapshot;
  }

  getComplianceStatus(
    orgId: string,
    systemVersionId: string
  ): ComplianceSnapshot | undefined {
    return this.opts.snapshotStore.getLatestSnapshot(orgId, systemVersionId);
  }

  getComplianceHistory(
    orgId: string,
    systemVersionId: string
  ): ComplianceSnapshot[] {
    return this.opts.snapshotStore.listSnapshotsForSystem(orgId, systemVersionId);
  }
}
