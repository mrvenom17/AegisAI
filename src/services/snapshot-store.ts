/**
 * Snapshot Store — append-only, deterministically identified, properly signed.
 *
 * - ID = UUIDv5-style derivation over the canonical inputs (deterministic).
 * - Signing requires an actual private key. The dev fallback hash-as-signature
 *   from v0 is removed.
 * - Supersession does not mutate prior records. The supersession edge is held
 *   in a separate index, so prior snapshots remain bit-identical and their
 *   signatures continue to verify.
 */

import {
  ComplianceSnapshot,
  ComplianceSnapshotSchema
} from '../domain/types.js';
import {
  canonicalize,
  signSnapshot,
  verifySnapshotSignature
} from '../utils/crypto.js';
import { deterministicUUID } from '../utils/uuid.js';

export interface SnapshotStorage {
  get(id: string): ComplianceSnapshot | undefined;
  set(id: string, value: ComplianceSnapshot): void;
  values(): IterableIterator<ComplianceSnapshot>;
  setSupersession(oldId: string, newId: string): void;
  getSupersession(oldId: string): string | undefined;
}

export class InMemorySnapshotStorage implements SnapshotStorage {
  private readonly map = new Map<string, ComplianceSnapshot>();
  private readonly supers = new Map<string, string>();
  get(id: string): ComplianceSnapshot | undefined {
    return this.map.get(id);
  }
  set(id: string, value: ComplianceSnapshot): void {
    if (this.map.has(id)) {
      // Idempotent re-write of identical record is permitted; otherwise reject.
      const prev = this.map.get(id)!;
      if (canonicalize(prev) !== canonicalize(value)) {
        throw new Error(`Refusing to overwrite snapshot ${id} with different content`);
      }
      return;
    }
    this.map.set(id, value);
  }
  values(): IterableIterator<ComplianceSnapshot> {
    return this.map.values();
  }
  setSupersession(oldId: string, newId: string): void {
    this.supers.set(oldId, newId);
  }
  getSupersession(oldId: string): string | undefined {
    return this.supers.get(oldId);
  }
}

export interface SnapshotStoreOptions {
  storage?: SnapshotStorage;
  privateKeyPem: string;
  publicKeyPem: string;
  signingKeyId: string;
}

export type SnapshotInput = Omit<
  ComplianceSnapshot,
  'id' | 'timestamp' | 'signature' | 'signing_key_id' | 'superseded_by'
> & { timestamp?: string };

export class SnapshotStore {
  private readonly storage: SnapshotStorage;
  private readonly privateKeyPem: string;
  private readonly publicKeyPem: string;
  private readonly signingKeyId: string;

  constructor(options: SnapshotStoreOptions) {
    this.storage = options.storage ?? new InMemorySnapshotStorage();
    this.privateKeyPem = options.privateKeyPem;
    this.publicKeyPem = options.publicKeyPem;
    this.signingKeyId = options.signingKeyId;
  }

  storeSnapshot(input: SnapshotInput): ComplianceSnapshot {
    const timestamp = input.timestamp ?? new Date().toISOString();
    const idMaterial = canonicalize({
      org_id: input.org_id,
      system_version_ref: input.system_version_ref,
      policy_set_version: input.policy_set_version,
      parameter_set_hash: input.parameter_set_hash,
      evidence_merkle_root: input.evidence_merkle_root,
      final_status: input.final_status,
      rule_evaluations: input.rule_evaluations,
      warnings: input.warnings,
      timestamp
    });
    const id = deterministicUUID(idMaterial);
    const unsigned = {
      id,
      org_id: input.org_id,
      timestamp,
      system_version_ref: input.system_version_ref,
      policy_set_version: input.policy_set_version,
      parameter_set_hash: input.parameter_set_hash,
      evidence_merkle_root: input.evidence_merkle_root,
      final_status: input.final_status,
      warnings: input.warnings,
      rule_evaluations: input.rule_evaluations,
      signing_key_id: this.signingKeyId
    };
    const signature = signSnapshot(unsigned, this.privateKeyPem);
    const signed = Object.freeze(
      ComplianceSnapshotSchema.parse({ ...unsigned, signature })
    );
    this.storage.set(id, signed);
    return signed;
  }

  supersedeSnapshot(oldSnapshotId: string, input: SnapshotInput): ComplianceSnapshot {
    this.getSnapshot(oldSnapshotId);
    const next = this.storeSnapshot(input);
    this.storage.setSupersession(oldSnapshotId, next.id);
    return next;
  }

  getSnapshot(id: string, orgId?: string): ComplianceSnapshot {
    const s = this.storage.get(id);
    if (!s) throw new Error(`ComplianceSnapshot not found: ${id}`);
    if (orgId && s.org_id !== orgId) {
      throw new Error(`Snapshot not accessible by tenant ${orgId}`);
    }
    const supersededBy = this.storage.getSupersession(id);
    return supersededBy ? Object.freeze({ ...s, superseded_by: supersededBy }) : s;
  }

  verifySignature(id: string): boolean {
    const stored = this.storage.get(id);
    if (!stored) throw new Error(`ComplianceSnapshot not found: ${id}`);
    return verifySnapshotSignature(
      stored as unknown as Record<string, unknown> & { signature: string },
      this.publicKeyPem
    );
  }

  listSnapshotsForSystem(
    orgId: string,
    systemVersionRef: string
  ): ComplianceSnapshot[] {
    return Array.from(this.storage.values())
      .filter((s) => s.org_id === orgId && s.system_version_ref === systemVersionRef)
      .map((s) => {
        const sup = this.storage.getSupersession(s.id);
        return sup ? Object.freeze({ ...s, superseded_by: sup }) : s;
      });
  }

  getLatestSnapshot(
    orgId: string,
    systemVersionRef: string
  ): ComplianceSnapshot | undefined {
    const all = this.listSnapshotsForSystem(orgId, systemVersionRef);
    if (all.length === 0) return undefined;
    return all.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )[0];
  }
}
