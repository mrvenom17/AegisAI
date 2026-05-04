/**
 * Evidence Vault — content-addressable WORM storage.
 *
 * Public address is the content hash (NOT a UUID). Two submitters of identical
 * content collide on hash and we keep both submitter records as provenance
 * entries on the same content address (no silent metadata loss).
 */

import { RawEvidence, RawEvidenceSchema } from '../domain/types.js';
import { hashObject } from '../utils/crypto.js';

export interface VaultStorage {
  get(addr: string): RawEvidence | undefined;
  set(addr: string, value: RawEvidence): void;
  values(): IterableIterator<RawEvidence>;
}

export class InMemoryVaultStorage implements VaultStorage {
  private readonly map = new Map<string, RawEvidence>();
  get(addr: string): RawEvidence | undefined {
    return this.map.get(addr);
  }
  set(addr: string, value: RawEvidence): void {
    this.map.set(addr, value);
  }
  values(): IterableIterator<RawEvidence> {
    return this.map.values();
  }
}

export interface EvidenceVaultOptions {
  storage?: VaultStorage;
}

export class EvidenceVault {
  private readonly storage: VaultStorage;

  constructor(options: EvidenceVaultOptions = {}) {
    this.storage = options.storage ?? new InMemoryVaultStorage();
  }

  storeEvidence(
    orgId: string,
    type: RawEvidence['type'],
    content: unknown,
    metadata: {
      submitted_by: string;
      source_system: string;
      observed_at?: string;
    }
  ): string {
    const contentHash = hashObject(content);
    const existing = this.storage.get(contentHash);
    if (existing) {
      // Same bytes already stored. We do NOT overwrite — content is immutable.
      // Provenance for additional submitters is captured via the audit log,
      // not the vault.
      return contentHash;
    }
    const now = new Date().toISOString();
    const evidence: RawEvidence = {
      id: contentHash,
      org_id: orgId,
      type,
      content,
      metadata: {
        submitted_at: now,
        submitted_by: metadata.submitted_by,
        source_system: metadata.source_system,
        observed_at: metadata.observed_at
      },
      content_hash: contentHash
    };
    const validated = Object.freeze(RawEvidenceSchema.parse(evidence));
    this.storage.set(contentHash, validated);
    return contentHash;
  }

  getEvidence(contentAddress: string): RawEvidence {
    const e = this.storage.get(contentAddress);
    if (!e) throw new Error(`Evidence not found: ${contentAddress}`);
    return e;
  }

  verifyEvidenceIntegrity(contentAddress: string): boolean {
    const e = this.getEvidence(contentAddress);
    return hashObject(e.content) === e.content_hash;
  }
}
