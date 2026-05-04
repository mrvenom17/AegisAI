/**
 * Post-Market Monitoring (Article 72) + Incident Reporting (Article 73).
 *
 * Ingest webhook signals from MLOps systems, persist them as evidence-grade
 * records, and surface CRITICAL signals for the 15-day Article 73 incident
 * reporting clock.
 */

import {
  MonitoringSignal,
  MonitoringSignalSchema
} from '../domain/types.js';
import { generateUUID } from '../utils/uuid.js';
import { AuditLog } from './audit-log.js';

export interface MonitoringStorage {
  set(s: MonitoringSignal): void;
  list(orgId: string, systemVersionRef?: string): MonitoringSignal[];
  get(id: string): MonitoringSignal | undefined;
  markReported(id: string): void;
}

export class InMemoryMonitoringStorage implements MonitoringStorage {
  private readonly map = new Map<string, MonitoringSignal>();
  set(s: MonitoringSignal): void {
    this.map.set(s.id, s);
  }
  list(orgId: string, systemVersionRef?: string): MonitoringSignal[] {
    return Array.from(this.map.values()).filter(
      (s) =>
        s.org_id === orgId &&
        (systemVersionRef === undefined || s.system_version_ref === systemVersionRef)
    );
  }
  get(id: string): MonitoringSignal | undefined {
    return this.map.get(id);
  }
  markReported(id: string): void {
    const cur = this.map.get(id);
    if (cur) this.map.set(id, { ...cur, reported_to_authority: true });
  }
}

export interface IngestArgs {
  orgId: string;
  systemVersionRef: string;
  observedAt: string;
  signalType: MonitoringSignal['signal_type'];
  payload: Record<string, unknown>;
  severity: MonitoringSignal['severity'];
  actor: string;
}

export class MonitoringService {
  constructor(
    private readonly storage: MonitoringStorage = new InMemoryMonitoringStorage(),
    private readonly auditLog?: AuditLog
  ) {}

  ingest(args: IngestArgs): MonitoringSignal {
    const signal: MonitoringSignal = {
      id: generateUUID(),
      org_id: args.orgId,
      system_version_ref: args.systemVersionRef,
      observed_at: args.observedAt,
      signal_type: args.signalType,
      payload: args.payload,
      severity: args.severity,
      reported_to_authority: false,
      ingested_at: new Date().toISOString()
    };
    const validated = Object.freeze(MonitoringSignalSchema.parse(signal));
    this.storage.set(validated);
    this.auditLog?.append({
      orgId: args.orgId,
      actor: args.actor,
      action: 'MONITORING_SIGNAL_INGESTED',
      targetType: 'monitoring_signal',
      targetId: validated.id,
      payload: {
        signal_type: validated.signal_type,
        severity: validated.severity,
        system_version_ref: validated.system_version_ref
      }
    });
    return validated;
  }

  /**
   * Returns CRITICAL signals not yet reported to the authority,
   * sorted oldest-first. Anything older than 15 days is overdue under
   * Article 73 and the deployer is in breach.
   */
  pendingIncidentReports(orgId: string): Array<MonitoringSignal & { overdue: boolean }> {
    const now = Date.now();
    const fifteenDaysMs = 15 * 24 * 60 * 60 * 1000;
    return this.storage
      .list(orgId)
      .filter((s) => s.severity === 'CRITICAL' && !s.reported_to_authority)
      .sort(
        (a, b) =>
          new Date(a.observed_at).getTime() - new Date(b.observed_at).getTime()
      )
      .map((s) => ({
        ...s,
        overdue: now - new Date(s.observed_at).getTime() > fifteenDaysMs
      }));
  }

  markReported(orgId: string, signalId: string, actor: string): void {
    const sig = this.storage.get(signalId);
    if (!sig || sig.org_id !== orgId) throw new Error('Signal not found');
    this.storage.markReported(signalId);
    this.auditLog?.append({
      orgId,
      actor,
      action: 'MONITORING_SIGNAL_REPORTED_TO_AUTHORITY',
      targetType: 'monitoring_signal',
      targetId: signalId,
      payload: {}
    });
  }

  list(orgId: string, systemVersionRef?: string): MonitoringSignal[] {
    return this.storage.list(orgId, systemVersionRef);
  }
}
