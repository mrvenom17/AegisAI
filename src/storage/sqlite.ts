/**
 * SQLite-backed storage adapters. Synchronous (better-sqlite3) which fits
 * the synchronous API style of the in-memory implementations.
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  RawEvidence,
  RawEvidenceSchema,
  SystemVersion,
  SystemVersionSchema,
  ComplianceSnapshot,
  ComplianceSnapshotSchema,
  FRIA,
  FRIASchema,
  MonitoringSignal,
  MonitoringSignalSchema,
  AuditEntry,
  AuditEntrySchema,
  ManualAttestation,
  ManualAttestationSchema
} from '../domain/types.js';
import { VaultStorage } from '../services/evidence-vault.js';
import { RegistryStorage } from '../services/system-registry.js';
import { SnapshotStorage } from '../services/snapshot-store.js';
import { FRIAStorage } from '../services/fria.js';
import { MonitoringStorage } from '../services/monitoring.js';
import { AuditStorage } from '../services/audit-log.js';
import { AttestationStorage } from '../services/attestations.js';

export interface DbHandle {
  db: Database.Database;
}

export function openDatabase(file: string): DbHandle {
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const schemaPath = join(
    dirname(fileURLToPath(import.meta.url)),
    'schema.sql'
  );
  const schema = readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
  return { db };
}

export class SqliteVaultStorage implements VaultStorage {
  constructor(private readonly h: DbHandle) {}
  get(addr: string): RawEvidence | undefined {
    const row = this.h.db
      .prepare('SELECT data FROM evidence WHERE content_hash = ?')
      .get(addr) as { data: string } | undefined;
    return row ? RawEvidenceSchema.parse(JSON.parse(row.data)) : undefined;
  }
  set(addr: string, value: RawEvidence): void {
    this.h.db
      .prepare(
        'INSERT OR IGNORE INTO evidence (content_hash, org_id, data) VALUES (?, ?, ?)'
      )
      .run(addr, value.org_id, JSON.stringify(value));
  }
  *values(): IterableIterator<RawEvidence> {
    const rows = this.h.db.prepare('SELECT data FROM evidence').all() as Array<{
      data: string;
    }>;
    for (const r of rows) yield RawEvidenceSchema.parse(JSON.parse(r.data));
  }
}

export class SqliteRegistryStorage implements RegistryStorage {
  constructor(private readonly h: DbHandle) {}
  get(id: string): SystemVersion | undefined {
    const row = this.h.db
      .prepare('SELECT data FROM system_versions WHERE id = ?')
      .get(id) as { data: string } | undefined;
    return row ? SystemVersionSchema.parse(JSON.parse(row.data)) : undefined;
  }
  set(id: string, value: SystemVersion): void {
    this.h.db
      .prepare(
        `INSERT INTO system_versions (id, org_id, data) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data`
      )
      .run(id, value.org_id, JSON.stringify(value));
  }
  *values(): IterableIterator<SystemVersion> {
    const rows = this.h.db.prepare('SELECT data FROM system_versions').all() as Array<{
      data: string;
    }>;
    for (const r of rows) yield SystemVersionSchema.parse(JSON.parse(r.data));
  }
}

export class SqliteSnapshotStorage implements SnapshotStorage {
  constructor(private readonly h: DbHandle) {}
  get(id: string): ComplianceSnapshot | undefined {
    const row = this.h.db
      .prepare('SELECT data FROM snapshots WHERE id = ?')
      .get(id) as { data: string } | undefined;
    return row ? ComplianceSnapshotSchema.parse(JSON.parse(row.data)) : undefined;
  }
  set(id: string, value: ComplianceSnapshot): void {
    const existing = this.get(id);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(value)) {
        throw new Error(`Refusing to overwrite snapshot ${id} with different content`);
      }
      return;
    }
    this.h.db
      .prepare(
        `INSERT INTO snapshots (id, org_id, system_version_ref, timestamp, data)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(id, value.org_id, value.system_version_ref, value.timestamp, JSON.stringify(value));
  }
  *values(): IterableIterator<ComplianceSnapshot> {
    const rows = this.h.db.prepare('SELECT data FROM snapshots').all() as Array<{
      data: string;
    }>;
    for (const r of rows) yield ComplianceSnapshotSchema.parse(JSON.parse(r.data));
  }
  setSupersession(oldId: string, newId: string): void {
    this.h.db
      .prepare(
        `INSERT INTO snapshot_supersession (old_id, new_id) VALUES (?, ?)
         ON CONFLICT(old_id) DO UPDATE SET new_id = excluded.new_id`
      )
      .run(oldId, newId);
  }
  getSupersession(oldId: string): string | undefined {
    const row = this.h.db
      .prepare('SELECT new_id FROM snapshot_supersession WHERE old_id = ?')
      .get(oldId) as { new_id: string } | undefined;
    return row?.new_id;
  }
}

export class SqliteFRIAStorage implements FRIAStorage {
  constructor(private readonly h: DbHandle) {}
  get(id: string): FRIA | undefined {
    const row = this.h.db
      .prepare('SELECT data FROM frias WHERE id = ?')
      .get(id) as { data: string } | undefined;
    return row ? FRIASchema.parse(JSON.parse(row.data)) : undefined;
  }
  set(id: string, value: FRIA): void {
    this.h.db
      .prepare(
        `INSERT INTO frias (id, org_id, system_version_ref, data) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data`
      )
      .run(id, value.org_id, value.system_version_ref, JSON.stringify(value));
  }
  list(orgId: string): FRIA[] {
    const rows = this.h.db
      .prepare('SELECT data FROM frias WHERE org_id = ?')
      .all(orgId) as Array<{ data: string }>;
    return rows.map((r) => FRIASchema.parse(JSON.parse(r.data)));
  }
}

export class SqliteMonitoringStorage implements MonitoringStorage {
  constructor(private readonly h: DbHandle) {}
  set(s: MonitoringSignal): void {
    this.h.db
      .prepare(
        `INSERT INTO monitoring_signals (id, org_id, system_version_ref, observed_at, data)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data`
      )
      .run(s.id, s.org_id, s.system_version_ref, s.observed_at, JSON.stringify(s));
  }
  list(orgId: string, systemVersionRef?: string): MonitoringSignal[] {
    const rows = systemVersionRef
      ? (this.h.db
          .prepare(
            'SELECT data FROM monitoring_signals WHERE org_id = ? AND system_version_ref = ? ORDER BY observed_at DESC'
          )
          .all(orgId, systemVersionRef) as Array<{ data: string }>)
      : (this.h.db
          .prepare(
            'SELECT data FROM monitoring_signals WHERE org_id = ? ORDER BY observed_at DESC'
          )
          .all(orgId) as Array<{ data: string }>);
    return rows.map((r) => MonitoringSignalSchema.parse(JSON.parse(r.data)));
  }
  get(id: string): MonitoringSignal | undefined {
    const row = this.h.db
      .prepare('SELECT data FROM monitoring_signals WHERE id = ?')
      .get(id) as { data: string } | undefined;
    return row ? MonitoringSignalSchema.parse(JSON.parse(row.data)) : undefined;
  }
  markReported(id: string): void {
    const cur = this.get(id);
    if (!cur) return;
    const updated = { ...cur, reported_to_authority: true };
    this.h.db
      .prepare('UPDATE monitoring_signals SET data = ? WHERE id = ?')
      .run(JSON.stringify(updated), id);
  }
}

export class SqliteAttestationStorage implements AttestationStorage {
  constructor(private readonly h: DbHandle) {}
  set(att: ManualAttestation): void {
    this.h.db
      .prepare(
        `INSERT INTO manual_attestations (id, org_id, system_version_ref, control_id, attested_at, data)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(org_id, system_version_ref, control_id)
         DO UPDATE SET id = excluded.id, attested_at = excluded.attested_at, data = excluded.data`
      )
      .run(att.id, att.org_id, att.system_version_ref, att.control_id, att.attested_at, JSON.stringify(att));
  }
  list(orgId: string, systemVersionRef: string): ManualAttestation[] {
    const rows = this.h.db
      .prepare(
        'SELECT data FROM manual_attestations WHERE org_id = ? AND system_version_ref = ? ORDER BY control_id ASC'
      )
      .all(orgId, systemVersionRef) as Array<{ data: string }>;
    return rows.map((r) => ManualAttestationSchema.parse(JSON.parse(r.data)));
  }
  get(orgId: string, systemVersionRef: string, controlId: string): ManualAttestation | undefined {
    const row = this.h.db
      .prepare(
        'SELECT data FROM manual_attestations WHERE org_id = ? AND system_version_ref = ? AND control_id = ?'
      )
      .get(orgId, systemVersionRef, controlId) as { data: string } | undefined;
    return row ? ManualAttestationSchema.parse(JSON.parse(row.data)) : undefined;
  }
}

export class SqliteAuditStorage implements AuditStorage {
  constructor(private readonly h: DbHandle) {}
  append(entry: AuditEntry): void {
    this.h.db
      .prepare(
        'INSERT INTO audit_entries (seq, org_id, data) VALUES (?, ?, ?)'
      )
      .run(entry.seq, entry.org_id, JSON.stringify(entry));
  }
  list(orgId: string): AuditEntry[] {
    const rows = this.h.db
      .prepare('SELECT data FROM audit_entries WHERE org_id = ? ORDER BY seq ASC')
      .all(orgId) as Array<{ data: string }>;
    return rows.map((r) => AuditEntrySchema.parse(JSON.parse(r.data)));
  }
  last(orgId: string): AuditEntry | undefined {
    const row = this.h.db
      .prepare(
        'SELECT data FROM audit_entries WHERE org_id = ? ORDER BY seq DESC LIMIT 1'
      )
      .get(orgId) as { data: string } | undefined;
    return row ? AuditEntrySchema.parse(JSON.parse(row.data)) : undefined;
  }
  count(orgId: string): number {
    const row = this.h.db
      .prepare('SELECT COUNT(*) AS c FROM audit_entries WHERE org_id = ?')
      .get(orgId) as { c: number };
    return row.c;
  }
}
