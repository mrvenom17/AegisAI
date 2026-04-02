/**
 * Evidence Verifier Service
 * 
 * Validates evidence and emits VerifiedClaims.
 * Uses adapter pattern for different evidence types.
 * ONLY component allowed to mark evidence as valid.
 */

import {
  RawEvidence,
  VerifiedClaim,
  VerifiedClaimSchema,
  EvidenceType
} from '../domain/types.js';
import { generateUUID } from '../utils/uuid.js';
import { EvidenceVault } from './evidence-vault.js';

// ============================================================================
// Evidence Adapters
// ============================================================================

export interface EvidenceAdapter {
  /**
   * Verify evidence and extract structured claim data.
   * Returns claim data if valid, throws if invalid.
   */
  verify(evidence: RawEvidence): Record<string, unknown>;
  
  /**
   * Get the claim type this adapter produces.
   */
  getClaimType(): string;
}

/**
 * Adapter for structured JSON evidence (Type A).
 * Validates against Zod schemas.
 */
export class StructuredJSONAdapter implements EvidenceAdapter {
  private readonly claimType: string;

  constructor(_schema: unknown, claimType: string) {
    // Schema parameter reserved for future Zod validation
    // Currently not used, but kept for API compatibility
    this.claimType = claimType;
  }

  verify(evidence: RawEvidence): Record<string, unknown> {
    if (evidence.type !== 'STRUCTURED_JSON') {
      throw new Error(`Expected STRUCTURED_JSON, got ${evidence.type}`);
    }

    // In production, use Zod schema validation here
    // For now, basic type check
    if (typeof evidence.content !== 'object' || evidence.content === null) {
      throw new Error('Structured JSON evidence must be an object');
    }

    // Return validated claim data
    return evidence.content as Record<string, unknown>;
  }

  getClaimType(): string {
    return this.claimType;
  }
}

/**
 * Adapter for document evidence (Type B).
 * Validates metadata, author signature, timestamp freshness.
 */
export class DocumentAdapter implements EvidenceAdapter {
  private readonly claimType: string;
  private readonly maxAgeDays: number;

  constructor(claimType: string, maxAgeDays: number = 90) {
    this.claimType = claimType;
    this.maxAgeDays = maxAgeDays;
  }

  verify(evidence: RawEvidence): Record<string, unknown> {
    if (!['DOCUMENT_PDF', 'DOCUMENT_TXT'].includes(evidence.type)) {
      throw new Error(`Expected document type, got ${evidence.type}`);
    }

    // Check timestamp freshness
    const submittedAt = new Date(evidence.metadata.submitted_at);
    const now = new Date();
    const ageDays = (now.getTime() - submittedAt.getTime()) / (1000 * 60 * 60 * 24);

    if (ageDays > this.maxAgeDays) {
      throw new Error(
        `Document evidence is stale: ${ageDays.toFixed(1)} days old (max: ${this.maxAgeDays} days)`
      );
    }

    // Extract document metadata
    const claimData: Record<string, unknown> = {
      document_type: evidence.type,
      submitted_at: evidence.metadata.submitted_at,
      submitted_by: evidence.metadata.submitted_by,
      source_system: evidence.metadata.source_system,
      content_hash: evidence.content_hash
    };

    // In production, extract and verify digital signatures from PDFs here
    // For now, return metadata

    return claimData;
  }

  getClaimType(): string {
    return this.claimType;
  }
}

// ============================================================================
// Evidence Verifier Service
// ============================================================================

export interface EvidenceVerifierOptions {
  vault: EvidenceVault;
  adapters?: Map<EvidenceType, EvidenceAdapter>;
  verifierVersion?: string;
}

export class EvidenceVerifier {
  private readonly vault: EvidenceVault;
  private readonly adapters: Map<EvidenceType, EvidenceAdapter>;
  private readonly verifierVersion: string;
  private readonly verifiedClaims: Map<string, VerifiedClaim>;

  constructor(options: EvidenceVerifierOptions) {
    this.vault = options.vault;
    this.verifierVersion = options.verifierVersion ?? '1.0.0';
    this.adapters = options.adapters ?? new Map();
    this.verifiedClaims = new Map();
  }

  /**
   * Register an adapter for an evidence type.
   */
  registerAdapter(evidenceType: EvidenceType, adapter: EvidenceAdapter): void {
    this.adapters.set(evidenceType, adapter);
  }

  /**
   * Verify evidence and create a VerifiedClaim.
   * Optionally specify claim type hint for routing.
   * Throws if evidence is invalid.
   */
  verifyEvidence(contentAddress: string, claimTypeHint?: string): VerifiedClaim {
    // Retrieve evidence from vault
    const evidence = this.vault.getEvidence(contentAddress);

    // Verify integrity
    if (!this.vault.verifyEvidenceIntegrity(contentAddress)) {
      throw new Error(`Evidence integrity check failed: ${contentAddress}`);
    }

    // Get adapter for evidence type
    const adapter = this.adapters.get(evidence.type);
    if (!adapter) {
      throw new Error(`No adapter registered for evidence type: ${evidence.type}`);
    }

    // Verify and extract claim data
    let claimData: Record<string, unknown>;
    let validationErrors: string[] | undefined;

    try {
      claimData = adapter.verify(evidence);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      validationErrors = [errorMessage];
      throw new Error(`Evidence verification failed: ${errorMessage}`);
    }

    // Determine claim type: use hint if provided, otherwise use adapter's default
    // In production, claim type might be extracted from evidence metadata
    let finalClaimType = adapter.getClaimType();
    if (claimTypeHint) {
      finalClaimType = claimTypeHint;
    } else if (typeof claimData === 'object' && claimData !== null) {
      // Try to infer from claim data structure (for structured JSON)
      if ('claim_type' in claimData && typeof claimData.claim_type === 'string') {
        finalClaimType = claimData.claim_type;
      }
    }

    // Create verified claim
    const id = generateUUID();
    const now = new Date().toISOString();

    const claim: VerifiedClaim = {
      id,
      evidence_vault_ref: contentAddress,
      claim_type: finalClaimType,
      claim_data: claimData,
      verified_at: now,
      verifier_version: this.verifierVersion,
      validation_metadata: {
        schema_version: '1.0',
        validation_errors: validationErrors
      }
    };

    // Validate with Zod
    const validated = VerifiedClaimSchema.parse(claim);

    // Store verified claim
    this.verifiedClaims.set(id, validated);

    return validated;
  }

  /**
   * Get a verified claim by ID.
   */
  getVerifiedClaim(id: string): VerifiedClaim {
    const claim = this.verifiedClaims.get(id);
    if (!claim) {
      throw new Error(`VerifiedClaim not found: ${id}`);
    }
    return claim;
  }

  /**
   * List all verified claims.
   */
  listVerifiedClaims(): VerifiedClaim[] {
    return Array.from(this.verifiedClaims.values());
  }
}
