/**
 * Manual attestations — signed evidence for controls AegisAI's automated
 * rule library does not (yet) cover.
 *
 * Each attestation is scoped to a system version + control, signed by the
 * tenant's Ed25519 key, and bound to a (control_id, attestation, attested_by,
 * attested_at, document_ref?, document_hash?) tuple. Tampering breaks the
 * signature.
 *
 * Without these, a binder with MANUAL_EVIDENCE_REQUIRED gaps is structurally
 * incomplete — and the effective conformity status reflects that.
 */

import {
  ManualAttestation,
  ManualAttestationSchema
} from '../domain/types.js';
import { canonicalize, signSnapshot, verifySnapshotSignature } from '../utils/crypto.js';
import { generateUUID } from '../utils/uuid.js';
import { AuditLog } from './audit-log.js';

export interface AttestationStorage {
  set(att: ManualAttestation): void;
  list(orgId: string, systemVersionRef: string): ManualAttestation[];
  get(orgId: string, systemVersionRef: string, controlId: string): ManualAttestation | undefined;
}

export class InMemoryAttestationStorage implements AttestationStorage {
  private readonly map = new Map<string, ManualAttestation>();
  private key(orgId: string, sv: string, c: string) {
    return `${orgId}:${sv}:${c}`;
  }
  set(att: ManualAttestation): void {
    this.map.set(this.key(att.org_id, att.system_version_ref, att.control_id), att);
  }
  list(orgId: string, sv: string): ManualAttestation[] {
    return Array.from(this.map.values()).filter(
      (a) => a.org_id === orgId && a.system_version_ref === sv
    );
  }
  get(orgId: string, sv: string, c: string): ManualAttestation | undefined {
    return this.map.get(this.key(orgId, sv, c));
  }
}

export interface AttestationServiceOptions {
  storage: AttestationStorage;
  privateKeyPem: string;
  publicKeyPem: string;
  signingKeyId: string;
  auditLog?: AuditLog;
}

export interface CreateAttestationArgs {
  orgId: string;
  systemVersionRef: string;
  controlId: string;
  framework?: ManualAttestation['framework'];
  attestation: string;
  attestedBy: string;
  documentRef?: string;
  documentHash?: string;
  expiresAt?: string;
  actor: string;
}

export class AttestationService {
  constructor(private readonly opts: AttestationServiceOptions) {}

  create(args: CreateAttestationArgs): ManualAttestation {
    const attestedAt = new Date().toISOString();
    const unsigned = {
      id: generateUUID(),
      org_id: args.orgId,
      system_version_ref: args.systemVersionRef,
      control_id: args.controlId,
      framework: args.framework ?? 'ISO_42001',
      attestation: args.attestation,
      attested_by: args.attestedBy,
      attested_at: attestedAt,
      document_ref: args.documentRef,
      document_hash: args.documentHash,
      expires_at: args.expiresAt,
      signing_key_id: this.opts.signingKeyId
    };
    const signature = signSnapshot(unsigned, this.opts.privateKeyPem);
    const signed = Object.freeze(
      ManualAttestationSchema.parse({ ...unsigned, signature })
    );
    this.opts.storage.set(signed);
    this.opts.auditLog?.append({
      orgId: args.orgId,
      actor: args.actor,
      action: 'ATTESTATION_CREATED',
      targetType: 'manual_attestation',
      targetId: signed.id,
      payload: {
        control_id: args.controlId,
        attested_by: args.attestedBy,
        system_version_ref: args.systemVersionRef
      }
    });
    return signed;
  }

  list(orgId: string, systemVersionRef: string): ManualAttestation[] {
    return this.opts.storage.list(orgId, systemVersionRef);
  }

  verify(att: ManualAttestation): boolean {
    return verifySnapshotSignature(
      att as unknown as Record<string, unknown> & { signature: string },
      this.opts.publicKeyPem
    );
  }

  /**
   * Returns true if attestation is currently in force (not expired) at the
   * given reference time.
   */
  isActive(att: ManualAttestation, asOf: string): boolean {
    if (!att.expires_at) return true;
    return Date.parse(asOf) <= Date.parse(att.expires_at);
  }
}

/**
 * Useful when the orchestrator/binder needs to canonicalize an attestation
 * for hashing, but we don't currently expose that elsewhere.
 */
export function attestationCanonical(att: ManualAttestation): string {
  return canonicalize(att);
}
