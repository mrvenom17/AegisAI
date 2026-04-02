/**
 * Evidence Vault Service
 * 
 * Write-Once-Read-Many (WORM) storage for raw evidence.
 * Returns cryptographic content addresses for stored evidence.
 * Never mutates stored evidence.
 */

import { RawEvidence, RawEvidenceSchema } from '../domain/types.js';
import { generateUUID } from '../utils/uuid.js';
import { hashObject } from '../utils/crypto.js';

export interface EvidenceVaultOptions {
  // In-memory storage for now. In production, use immutable storage (e.g., IPFS, S3 with versioning).
  storage?: Map<string, RawEvidence>;
}

export class EvidenceVault {
  private readonly storage: Map<string, RawEvidence>;

  constructor(options: EvidenceVaultOptions = {}) {
    this.storage = options.storage ?? new Map();
  }

  /**
   * Store raw evidence and return content address.
   * Write-once: if evidence with same content hash exists, returns existing address.
   */
  storeEvidence(
    type: RawEvidence['type'],
    content: unknown,
    metadata: {
      submitted_by: string;
      source_system: string;
    }
  ): string {
    // Compute content hash
    const contentHash = hashObject(content);

    // Check if evidence with this hash already exists (deduplication)
    const existing = this.findByContentHash(contentHash);
    if (existing) {
      return existing.id; // Return existing content address
    }

    // Create new evidence record
    const id = generateUUID();
    const now = new Date().toISOString();

    const evidence: RawEvidence = {
      id,
      type,
      content,
      metadata: {
        submitted_at: now,
        submitted_by: metadata.submitted_by,
        source_system: metadata.source_system
      },
      content_hash: contentHash
    };

    // Validate with Zod
    const validated = RawEvidenceSchema.parse(evidence);

    // Store by content address (ID)
    this.storage.set(id, validated);

    return id; // Content address
  }

  /**
   * Retrieve evidence by content address.
   * Throws if not found.
   */
  getEvidence(contentAddress: string): RawEvidence {
    const evidence = this.storage.get(contentAddress);
    if (!evidence) {
      throw new Error(`Evidence not found: ${contentAddress}`);
    }
    return evidence;
  }

  /**
   * Verify evidence integrity by recomputing hash.
   * Returns true if content hash matches stored hash.
   */
  verifyEvidenceIntegrity(contentAddress: string): boolean {
    const evidence = this.getEvidence(contentAddress);
    const recomputedHash = hashObject(evidence.content);
    return recomputedHash === evidence.content_hash;
  }

  /**
   * Find evidence by content hash (for deduplication).
   */
  private findByContentHash(hash: string): RawEvidence | undefined {
    for (const evidence of this.storage.values()) {
      if (evidence.content_hash === hash) {
        return evidence;
      }
    }
    return undefined;
  }
}
