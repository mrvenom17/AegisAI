/**
 * Hash-chained, append-only audit log.
 *
 * Every entry includes the hash of the previous entry, so any tamper to
 * a historical row invalidates the chain from that point forward.
 */

import { AuditEntry, AuditEntrySchema } from '../domain/types.js';
import { canonicalize, sha256 } from '../utils/crypto.js';

export interface AuditStorage {
  append(entry: AuditEntry): void;
  list(orgId: string): AuditEntry[];
  last(orgId: string): AuditEntry | undefined;
  count(orgId: string): number;
}

export class InMemoryAuditStorage implements AuditStorage {
  private readonly entries: AuditEntry[] = [];
  append(entry: AuditEntry): void {
    this.entries.push(entry);
  }
  list(orgId: string): AuditEntry[] {
    return this.entries.filter((e) => e.org_id === orgId);
  }
  last(orgId: string): AuditEntry | undefined {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      if (this.entries[i].org_id === orgId) return this.entries[i];
    }
    return undefined;
  }
  count(orgId: string): number {
    return this.list(orgId).length;
  }
}

export interface AppendArgs {
  orgId: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  payload: Record<string, unknown>;
}

export class AuditLog {
  constructor(private readonly storage: AuditStorage = new InMemoryAuditStorage()) {}

  append(args: AppendArgs): AuditEntry {
    const last = this.storage.last(args.orgId);
    const seq = last ? last.seq + 1 : 0;
    const prevHash = last ? last.entry_hash : sha256('genesis:' + args.orgId);
    const baseline = {
      seq,
      org_id: args.orgId,
      timestamp: new Date().toISOString(),
      actor: args.actor,
      action: args.action,
      target_type: args.targetType,
      target_id: args.targetId,
      payload: args.payload,
      prev_hash: prevHash
    };
    const entryHash = sha256(canonicalize(baseline));
    const entry = AuditEntrySchema.parse({ ...baseline, entry_hash: entryHash });
    this.storage.append(entry);
    return entry;
  }

  /**
   * Walks the entire chain for an org and returns the first index where
   * the chain is invalid, or -1 if the chain is sound.
   */
  verifyChain(orgId: string): number {
    const list = this.storage.list(orgId).sort((a, b) => a.seq - b.seq);
    let expectedPrev = sha256('genesis:' + orgId);
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.prev_hash !== expectedPrev) return i;
      const { entry_hash, ...rest } = e;
      const recomputed = sha256(canonicalize(rest));
      if (recomputed !== entry_hash) return i;
      expectedPrev = entry_hash;
    }
    return -1;
  }

  list(orgId: string): AuditEntry[] {
    return this.storage.list(orgId);
  }
}
