/**
 * Snapshot Store Service
 * 
 * Stores immutable ComplianceSnapshots.
 * Snapshots cannot be updated, only superseded.
 * Acts as the legal record.
 */

import {
  ComplianceSnapshot,
  ComplianceSnapshotSchema
} from '../domain/types.js';
import { hashObject, signSnapshot, verifySnapshotSignature } from '../utils/crypto.js';
import { generateUUID } from '../utils/uuid.js';

export interface SnapshotStoreOptions {
  storage?: Map<string, ComplianceSnapshot>;
  privateKey?: string; // For signing snapshots
}

export class SnapshotStore {
  private readonly storage: Map<string, ComplianceSnapshot>;
  private readonly privateKey: string | undefined;

  constructor(options: SnapshotStoreOptions = {}) {
    this.storage = options.storage ?? new Map();
    this.privateKey = options.privateKey;
  }

  /**
   * Store an immutable ComplianceSnapshot.
   * Snapshots cannot be updated, only superseded.
   */
  storeSnapshot(
    snapshot: Omit<ComplianceSnapshot, 'id' | 'timestamp' | 'signature'>
  ): ComplianceSnapshot {
    // Generate ID and timestamp
    const id = this.generateSnapshotId();
    const timestamp = new Date().toISOString();

    // Create snapshot without signature
    const snapshotWithoutSignature = {
      ...snapshot,
      id,
      timestamp
    };

    // Sign snapshot if private key is available
    let signature: string;
    if (this.privateKey) {
      signature = signSnapshot(snapshotWithoutSignature, this.privateKey);
    } else {
      // If no private key, use hash as signature (for development)
      signature = hashObject(snapshotWithoutSignature);
    }

    const fullSnapshot: ComplianceSnapshot = {
      ...snapshotWithoutSignature,
      signature
    };

    // Validate with Zod
    const validated = ComplianceSnapshotSchema.parse(fullSnapshot);

    // Store snapshot
    this.storage.set(id, validated);

    return validated;
  }

  /**
   * Supersede a snapshot with a new one.
   * Marks the old snapshot as superseded.
   */
  supersedeSnapshot(
    oldSnapshotId: string,
    newSnapshot: Omit<ComplianceSnapshot, 'id' | 'timestamp' | 'signature'>
  ): ComplianceSnapshot {
    // Verify old snapshot exists
    const oldSnapshot = this.getSnapshot(oldSnapshotId);

    // Create new snapshot
    const newSnapshotFull = this.storeSnapshot(newSnapshot);

    // Mark old snapshot as superseded
    const updatedOldSnapshot: ComplianceSnapshot = {
      ...oldSnapshot,
      superseded_by: newSnapshotFull.id
    };

    this.storage.set(oldSnapshotId, updatedOldSnapshot);

    return newSnapshotFull;
  }

  /**
   * Get a snapshot by ID.
   * Throws if not found.
   */
  getSnapshot(id: string): ComplianceSnapshot {
    const snapshot = this.storage.get(id);
    if (!snapshot) {
      throw new Error(`ComplianceSnapshot not found: ${id}`);
    }
    return snapshot;
  }

  /**
   * Verify snapshot signature.
   * Requires public key.
   */
  verifySnapshotSignature(
    snapshotId: string,
    publicKey: string
  ): boolean {
    const snapshot = this.getSnapshot(snapshotId);
    return verifySnapshotSignature(snapshot, publicKey);
  }

  /**
   * List all snapshots for a system version.
   */
  listSnapshotsForSystem(systemVersionRef: string): ComplianceSnapshot[] {
    return Array.from(this.storage.values()).filter(
      s => s.system_version_ref === systemVersionRef
    );
  }

  /**
   * Get the latest snapshot for a system version.
   */
  getLatestSnapshot(systemVersionRef: string): ComplianceSnapshot | undefined {
    const snapshots = this.listSnapshotsForSystem(systemVersionRef);
    if (snapshots.length === 0) {
      return undefined;
    }

    // Sort by timestamp descending
    snapshots.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return snapshots[0];
  }

  /**
   * Generate a snapshot ID.
   * In production, use UUIDv7 for time-ordered IDs.
   */
  private generateSnapshotId(): string {
    // Use UUIDv4 for now. In production, use UUIDv7 for time-ordered IDs
    return generateUUID();
  }
}
