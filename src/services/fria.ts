/**
 * FRIA (Fundamental Rights Impact Assessment) — EU AI Act Article 27.
 *
 * Required for deployers of high-risk AI systems that are public authorities
 * or providers of essential services. Implemented as a state machine:
 *   DRAFT -> IN_REVIEW -> APPROVED | REJECTED
 *
 * The approved FRIA is included in the conformity binder and is the input
 * deployers send to the national supervisory authority.
 */

import { FRIA, FRIASchema } from '../domain/types.js';
import { generateUUID } from '../utils/uuid.js';
import { AuditLog } from './audit-log.js';

export interface FRIAStorage {
  get(id: string): FRIA | undefined;
  set(id: string, value: FRIA): void;
  list(orgId: string): FRIA[];
}

export class InMemoryFRIAStorage implements FRIAStorage {
  private readonly map = new Map<string, FRIA>();
  get(id: string): FRIA | undefined {
    return this.map.get(id);
  }
  set(id: string, value: FRIA): void {
    this.map.set(id, value);
  }
  list(orgId: string): FRIA[] {
    return Array.from(this.map.values()).filter((f) => f.org_id === orgId);
  }
}

export interface CreateFRIAArgs {
  orgId: string;
  systemVersionRef: string;
  deployerOrganization: string;
  intendedPurpose: string;
  affectedCategories: string[];
  usagePeriod: { start: string; end?: string };
  risksIdentified: FRIA['risks_identified'];
  mitigations: FRIA['mitigations'];
  humanOversightMeasures: string[];
  actor: string;
}

export class FRIAService {
  constructor(
    private readonly storage: FRIAStorage = new InMemoryFRIAStorage(),
    private readonly auditLog?: AuditLog
  ) {}

  create(args: CreateFRIAArgs): FRIA {
    const fria: FRIA = {
      id: generateUUID(),
      org_id: args.orgId,
      system_version_ref: args.systemVersionRef,
      status: 'DRAFT',
      deployer_organization: args.deployerOrganization,
      intended_purpose: args.intendedPurpose,
      affected_categories: args.affectedCategories,
      usage_period: args.usagePeriod,
      risks_identified: args.risksIdentified,
      mitigations: args.mitigations,
      human_oversight_measures: args.humanOversightMeasures,
      created_at: new Date().toISOString()
    };
    const validated = Object.freeze(FRIASchema.parse(fria));
    this.storage.set(validated.id, validated);
    this.auditLog?.append({
      orgId: args.orgId,
      actor: args.actor,
      action: 'FRIA_CREATED',
      targetType: 'fria',
      targetId: validated.id,
      payload: { system_version_ref: args.systemVersionRef }
    });
    return validated;
  }

  submitForReview(id: string, actor: string): FRIA {
    return this.transition(id, actor, 'DRAFT', 'IN_REVIEW', {});
  }

  approve(id: string, approverEmail: string): FRIA {
    return this.transition(id, approverEmail, 'IN_REVIEW', 'APPROVED', {
      approved_at: new Date().toISOString(),
      approved_by: approverEmail
    });
  }

  reject(id: string, actor: string): FRIA {
    return this.transition(id, actor, 'IN_REVIEW', 'REJECTED', {});
  }

  get(id: string, orgId: string): FRIA {
    const f = this.storage.get(id);
    if (!f) throw new Error(`FRIA not found: ${id}`);
    if (f.org_id !== orgId) throw new Error('FRIA not accessible by tenant');
    return f;
  }

  list(orgId: string): FRIA[] {
    return this.storage.list(orgId);
  }

  private transition(
    id: string,
    actor: string,
    expectedStatus: FRIA['status'],
    nextStatus: FRIA['status'],
    extra: Partial<FRIA>
  ): FRIA {
    const current = this.storage.get(id);
    if (!current) throw new Error(`FRIA not found: ${id}`);
    if (current.status !== expectedStatus) {
      throw new Error(
        `Invalid transition: status is ${current.status}, expected ${expectedStatus}`
      );
    }
    const updated = Object.freeze(
      FRIASchema.parse({ ...current, ...extra, status: nextStatus })
    );
    this.storage.set(id, updated);
    this.auditLog?.append({
      orgId: updated.org_id,
      actor,
      action: `FRIA_${nextStatus}`,
      targetType: 'fria',
      targetId: id,
      payload: { from: expectedStatus, to: nextStatus }
    });
    return updated;
  }
}
