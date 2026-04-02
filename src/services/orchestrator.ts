/**
 * Orchestrator Service
 * 
 * Coordinates the compliance evaluation flow:
 * Registry → Vault → Verifier → Policy Engine → Snapshot Store
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
import { computeEvidenceMerkleRoot, hashObject } from '../utils/crypto.js';

export interface OrchestratorOptions {
  registry: SystemRegistry;
  vault: EvidenceVault;
  verifier: EvidenceVerifier;
  policyEngine: PolicyEngine;
  snapshotStore: SnapshotStore;
}

export interface EvidenceSubmission {
  type: 'STRUCTURED_JSON' | 'DOCUMENT_PDF' | 'DOCUMENT_TXT' | 'METRICS_DATASET';
  content: unknown;
  metadata: {
    submitted_by: string;
    source_system: string;
  };
}

export interface ComplianceEvaluationRequest {
  systemVersionId: string;
  evidenceSubmissions: EvidenceSubmission[];
  policySet: PolicySet;
  parameterSet: ParameterSet;
}

export class Orchestrator {
  private readonly registry: SystemRegistry;
  private readonly vault: EvidenceVault;
  private readonly verifier: EvidenceVerifier;
  private readonly policyEngine: PolicyEngine;
  private readonly snapshotStore: SnapshotStore;

  constructor(options: OrchestratorOptions) {
    this.registry = options.registry;
    this.vault = options.vault;
    this.verifier = options.verifier;
    this.policyEngine = options.policyEngine;
    this.snapshotStore = options.snapshotStore;
  }

  /**
   * Execute full compliance evaluation flow.
   * 
   * Flow:
   * 1. Validate system version exists and is not locked
   * 2. Store all evidence in vault
   * 3. Verify all evidence
   * 4. Evaluate policies
   * 5. Create immutable snapshot
   * 
   * This is the MAIN ENTRY POINT for compliance evaluation.
   */
  async evaluateCompliance(
    request: ComplianceEvaluationRequest
  ): Promise<ComplianceSnapshot> {
    // Step 1: Validate system version
    const systemVersion = this.registry.getSystemVersion(request.systemVersionId);
    
    if (systemVersion.locked) {
      throw new Error(
        `System version ${request.systemVersionId} is locked and cannot be evaluated`
      );
    }

    // Step 2: Store evidence in vault
    const evidenceAddresses: string[] = [];
    for (const evidence of request.evidenceSubmissions) {
      const address = this.vault.storeEvidence(
        evidence.type,
        evidence.content,
        evidence.metadata
      );
      evidenceAddresses.push(address);
    }

    // Step 3: Verify evidence
    const verifiedClaims: VerifiedClaim[] = [];
    for (const address of evidenceAddresses) {
      try {
        const claim = this.verifier.verifyEvidence(address);
        verifiedClaims.push(claim);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Evidence verification failed for ${address}: ${errorMessage}`
        );
      }
    }

    // Step 4: Evaluate policies
    const complianceResult = this.policyEngine.evaluate(
      verifiedClaims,
      request.policySet.rules,
      request.parameterSet.parameters
    );

    // Step 5: Compute evidence Merkle root
    const claimHashes = verifiedClaims.map(claim => 
      hashObject(claim.claim_data)
    );
    const evidenceMerkleRoot = computeEvidenceMerkleRoot(claimHashes);

    // Step 6: Compute parameter set hash
    const parameterSetHash = hashObject(request.parameterSet.parameters);

    // Step 7: Create immutable snapshot
    const snapshot = this.snapshotStore.storeSnapshot({
      system_version_ref: request.systemVersionId,
      policy_set_version: request.policySet.version,
      parameter_set_hash: parameterSetHash,
      evidence_merkle_root: evidenceMerkleRoot,
      final_status: complianceResult.final_status,
      warnings: complianceResult.warnings,
      rule_evaluations: complianceResult.rule_evaluations
    });

    return snapshot;
  }

  /**
   * Get compliance status for a system version.
   * Returns the latest snapshot.
   */
  getComplianceStatus(systemVersionId: string): ComplianceSnapshot | undefined {
    return this.snapshotStore.getLatestSnapshot(systemVersionId);
  }

  /**
   * Get all compliance snapshots for a system version.
   */
  getComplianceHistory(systemVersionId: string): ComplianceSnapshot[] {
    return this.snapshotStore.listSnapshotsForSystem(systemVersionId);
  }
}
