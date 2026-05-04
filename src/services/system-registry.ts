/**
 * System Registry
 *
 * - Multi-tenant via org_id.
 * - Locks expire automatically by checking locked_until on every isLocked() call.
 */

import {
  SystemVersion,
  SystemVersionSchema,
  RiskTier
} from '../domain/types.js';
import { generateUUID } from '../utils/uuid.js';

export interface RegistryStorage {
  get(id: string): SystemVersion | undefined;
  set(id: string, value: SystemVersion): void;
  values(): IterableIterator<SystemVersion>;
}

export class InMemoryRegistryStorage implements RegistryStorage {
  private readonly map = new Map<string, SystemVersion>();
  get(id: string): SystemVersion | undefined {
    return this.map.get(id);
  }
  set(id: string, value: SystemVersion): void {
    this.map.set(id, value);
  }
  values(): IterableIterator<SystemVersion> {
    return this.map.values();
  }
}

export interface RegisterSystemVersionInput {
  orgId: string;
  systemId: string;
  version: string;
  modelName: string;
  modelVersion: string;
  intendedPurpose: string;
  riskTier?: RiskTier;
  deploymentContext: {
    environment: 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT';
    region: string;
    deploymentDate: string;
  };
}

export class SystemRegistry {
  private readonly storage: RegistryStorage;

  constructor(options: { storage?: RegistryStorage } = {}) {
    this.storage = options.storage ?? new InMemoryRegistryStorage();
  }

  registerSystemVersion(input: RegisterSystemVersionInput): SystemVersion {
    const id = generateUUID();
    const now = new Date().toISOString();
    const sv: SystemVersion = {
      id,
      org_id: input.orgId,
      system_id: input.systemId,
      version: input.version,
      model_name: input.modelName,
      model_version: input.modelVersion,
      intended_purpose: input.intendedPurpose,
      risk_tier: input.riskTier ?? 'UNCLASSIFIED',
      deployment_context: {
        environment: input.deploymentContext.environment,
        region: input.deploymentContext.region,
        deployment_date: input.deploymentContext.deploymentDate
      },
      registered_at: now,
      locked: false
    };
    const validated = Object.freeze(SystemVersionSchema.parse(sv));
    this.storage.set(id, validated);
    return validated;
  }

  getSystemVersion(id: string, orgId?: string): SystemVersion {
    const v = this.storage.get(id);
    if (!v) throw new Error(`SystemVersion not found: ${id}`);
    if (orgId && v.org_id !== orgId) {
      throw new Error(`SystemVersion not accessible by tenant ${orgId}`);
    }
    return v;
  }

  setRiskTier(id: string, tier: RiskTier): SystemVersion {
    const v = this.getSystemVersion(id);
    const updated = Object.freeze({ ...v, risk_tier: tier });
    this.storage.set(id, updated);
    return updated;
  }

  lockSystemVersion(id: string, lockedUntil: string): void {
    const v = this.getSystemVersion(id);
    const updated = Object.freeze({
      ...v,
      locked: true,
      locked_until: lockedUntil
    });
    this.storage.set(id, updated);
  }

  unlockSystemVersion(id: string): void {
    const v = this.getSystemVersion(id);
    const updated = Object.freeze({
      ...v,
      locked: false,
      locked_until: undefined
    });
    this.storage.set(id, updated);
  }

  isLocked(id: string): boolean {
    const v = this.getSystemVersion(id);
    if (!v.locked) return false;
    if (v.locked_until && new Date(v.locked_until).getTime() < Date.now()) {
      this.unlockSystemVersion(id);
      return false;
    }
    return true;
  }

  listSystemVersions(orgId: string, systemId?: string): SystemVersion[] {
    const out: SystemVersion[] = [];
    for (const v of this.storage.values()) {
      if (v.org_id !== orgId) continue;
      if (systemId && v.system_id !== systemId) continue;
      out.push(v);
    }
    return out;
  }
}
