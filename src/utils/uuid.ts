/**
 * UUID Utilities
 * 
 * Provides UUID generation. In production, prefer UUIDv7 for time-ordered IDs.
 * Falls back to UUIDv4 if UUIDv7 is not available.
 */

import { randomUUID } from 'crypto';

/**
 * Generate a UUID.
 * In production, use UUIDv7 for time-ordered IDs.
 * For now, uses crypto.randomUUID() (UUIDv4).
 */
export function generateUUID(): string {
  return randomUUID();
}
