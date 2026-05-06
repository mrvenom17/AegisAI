/**
 * Evidence Verifier
 *
 * - Adapter pattern per evidence type.
 * - Mandatory freshness check on every adapter (configurable).
 * - StructuredJSONAdapter validates against a Zod schema if one is provided.
 * - Returns frozen VerifiedClaim records.
 */

import { z, ZodTypeAny } from 'zod';
import {
  RawEvidence,
  VerifiedClaim,
  VerifiedClaimSchema,
  EvidenceType
} from '../domain/types.js';
import { generateUUID } from '../utils/uuid.js';
import { EvidenceVault } from './evidence-vault.js';

export interface EvidenceAdapter {
  verify(evidence: RawEvidence): Record<string, unknown>;
  defaultClaimType(): string;
}

export class StructuredJSONAdapter implements EvidenceAdapter {
  constructor(
    private readonly schema: ZodTypeAny | undefined,
    private readonly claimType: string,
    private readonly maxAgeDays = 365
  ) {}

  verify(evidence: RawEvidence): Record<string, unknown> {
    if (evidence.type !== 'STRUCTURED_JSON' && evidence.type !== 'METRICS_DATASET') {
      throw new Error(`Expected STRUCTURED_JSON or METRICS_DATASET, got ${evidence.type}`);
    }
    if (typeof evidence.content !== 'object' || evidence.content === null) {
      throw new Error('Structured JSON evidence must be an object');
    }
    enforceFreshness(evidence, this.maxAgeDays);
    if (this.schema) {
      const parsed = this.schema.safeParse(evidence.content);
      if (!parsed.success) {
        throw new Error(
          `Schema validation failed: ${parsed.error.errors
            .map((e) => `${e.path.join('.')}: ${e.message}`)
            .join('; ')}`
        );
      }
      return parsed.data as Record<string, unknown>;
    }
    return evidence.content as Record<string, unknown>;
  }

  defaultClaimType(): string {
    return this.claimType;
  }
}

export class DocumentAdapter implements EvidenceAdapter {
  constructor(
    private readonly claimType: string,
    private readonly maxAgeDays = 90
  ) {}

  verify(evidence: RawEvidence): Record<string, unknown> {
    if (!['DOCUMENT_PDF', 'DOCUMENT_TXT'].includes(evidence.type)) {
      throw new Error(`Expected document type, got ${evidence.type}`);
    }
    enforceFreshness(evidence, this.maxAgeDays);
    return {
      document_type: evidence.type,
      submitted_at: evidence.metadata.submitted_at,
      submitted_by: evidence.metadata.submitted_by,
      source_system: evidence.metadata.source_system,
      content_hash: evidence.content_hash
    };
  }

  defaultClaimType(): string {
    return this.claimType;
  }
}

export class MonitoringSignalAdapter implements EvidenceAdapter {
  constructor(
    private readonly claimType: string,
    private readonly maxAgeDays = 30
  ) {}

  verify(evidence: RawEvidence): Record<string, unknown> {
    if (evidence.type !== 'MONITORING_SIGNAL') {
      throw new Error(`Expected MONITORING_SIGNAL, got ${evidence.type}`);
    }
    enforceFreshness(evidence, this.maxAgeDays);
    if (typeof evidence.content !== 'object' || evidence.content === null) {
      throw new Error('Monitoring signal must be an object');
    }
    return evidence.content as Record<string, unknown>;
  }

  defaultClaimType(): string {
    return this.claimType;
  }
}

function enforceFreshness(evidence: RawEvidence, maxAgeDays: number): void {
  const reference =
    evidence.metadata.observed_at ?? evidence.metadata.submitted_at;
  const observed = new Date(reference);
  if (Number.isNaN(observed.getTime())) {
    throw new Error(`Invalid observed/submitted timestamp: ${reference}`);
  }
  const ageDays = (Date.now() - observed.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays > maxAgeDays) {
    throw new Error(
      `Evidence is stale: ${ageDays.toFixed(1)} days old (max: ${maxAgeDays} days)`
    );
  }
}

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
    this.verifierVersion = options.verifierVersion ?? '0.1.0';
    this.adapters = options.adapters ?? new Map();
    this.verifiedClaims = new Map();
  }

  registerAdapter(type: EvidenceType, adapter: EvidenceAdapter): void {
    this.adapters.set(type, adapter);
  }

  verifyEvidence(contentAddress: string, claimTypeHint?: string): VerifiedClaim {
    const evidence = this.vault.getEvidence(contentAddress);
    if (!this.vault.verifyEvidenceIntegrity(contentAddress)) {
      throw new Error(`Evidence integrity check failed: ${contentAddress}`);
    }
    const adapter = this.adapters.get(evidence.type);
    if (!adapter) {
      throw new Error(`No adapter registered for evidence type: ${evidence.type}`);
    }

    const claimData = adapter.verify(evidence);
    const claimType =
      claimTypeHint ??
      (typeof claimData === 'object' &&
      claimData !== null &&
      typeof (claimData as Record<string, unknown>).claim_type === 'string'
        ? ((claimData as Record<string, unknown>).claim_type as string)
        : adapter.defaultClaimType());

    const claim: VerifiedClaim = {
      id: generateUUID(),
      org_id: evidence.org_id,
      evidence_vault_ref: contentAddress,
      claim_type: claimType,
      claim_data: claimData,
      verified_at: new Date().toISOString(),
      verifier_version: this.verifierVersion,
      validation_metadata: { schema_version: '0.1' },
      submitted_by: evidence.metadata.submitted_by,
      source_system: evidence.metadata.source_system,
      observed_at: evidence.metadata.observed_at
    };

    const validated = Object.freeze(VerifiedClaimSchema.parse(claim));
    this.verifiedClaims.set(validated.id, validated);
    return validated;
  }

  getVerifiedClaim(id: string): VerifiedClaim {
    const claim = this.verifiedClaims.get(id);
    if (!claim) throw new Error(`VerifiedClaim not found: ${id}`);
    return claim;
  }

  listVerifiedClaims(): VerifiedClaim[] {
    return Array.from(this.verifiedClaims.values());
  }
}

export const ZodSchemas = { z };
