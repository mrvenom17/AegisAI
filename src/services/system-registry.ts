/**
 * System Registry Service
 * 
 * Registers AI systems, models, versions, and deployment context.
 * Supports versioning and locking during active audit cycles.
 */

import { SystemVersion, SystemVersionSchema } from '../domain/types.js';
import { generateUUID } from '../utils/uuid.js';

export interface SystemRegistryOptions {
  // In-memory storage for now. In production, use persistent storage.
  storage?: Map<string, SystemVersion>;
}

export class SystemRegistry {
  private readonly storage: Map<string, SystemVersion>;

  constructor(options: SystemRegistryOptions = {}) {
    this.storage = options.storage ?? new Map();
  }

  /**
   * Register a new system version.
   * Returns the registered SystemVersion.
   */
  registerSystemVersion(
    systemId: string,
    version: string,
    modelName: string,
    modelVersion: string,
    deploymentContext: {
      environment: 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT';
      region: string;
      deploymentDate: string; // ISO8601 UTC
    }
  ): SystemVersion {
    const id = generateUUID();
    const now = new Date().toISOString();

    const systemVersion: SystemVersion = {
      id,
      system_id: systemId,
      version,
      model_name: modelName,
      model_version: modelVersion,
      deployment_context: {
        environment: deploymentContext.environment,
        region: deploymentContext.region,
        deployment_date: deploymentContext.deploymentDate
      },
      registered_at: now,
      locked: false
    };

    // Validate with Zod
    const validated = SystemVersionSchema.parse(systemVersion);

    // Store by ID
    this.storage.set(id, validated);

    return validated;
  }

  /**
   * Retrieve a system version by ID.
   * Throws if not found.
   */
  getSystemVersion(id: string): SystemVersion {
    const version = this.storage.get(id);
    if (!version) {
      throw new Error(`SystemVersion not found: ${id}`);
    }
    return version;
  }

  /**
   * Lock a system version during an active audit cycle.
   * Prevents modifications to the system version.
   */
  lockSystemVersion(id: string, lockedUntil: string): void {
    const version = this.getSystemVersion(id);
    const updated: SystemVersion = {
      ...version,
      locked: true,
      locked_until: lockedUntil
    };
    this.storage.set(id, updated);
  }

  /**
   * Unlock a system version after audit cycle completes.
   */
  unlockSystemVersion(id: string): void {
    const version = this.getSystemVersion(id);
    const updated: SystemVersion = {
      ...version,
      locked: false,
      locked_until: undefined
    };
    this.storage.set(id, updated);
  }

  /**
   * Check if a system version is locked.
   */
  isLocked(id: string): boolean {
    const version = this.getSystemVersion(id);
    return version.locked;
  }

  /**
   * List all system versions for a given system ID.
   */
  listSystemVersions(systemId: string): SystemVersion[] {
    return Array.from(this.storage.values()).filter(
      v => v.system_id === systemId
    );
  }
}
