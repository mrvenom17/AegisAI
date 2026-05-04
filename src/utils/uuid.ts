import { randomUUID, createHash } from 'crypto';

/**
 * Random UUIDv4. Use only when a record has no canonical content to derive ID from.
 */
export function generateUUID(): string {
  return randomUUID();
}

/**
 * Deterministic UUID derived from a canonical string.
 * Layout matches UUIDv5 (RFC 4122 §4.3) but uses SHA-256 truncated to 16 bytes.
 * Same input always produces same UUID — used to make snapshots reproducible.
 */
export function deterministicUUID(canonical: string): string {
  const digest = createHash('sha256').update(canonical).digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return (
    hex.substring(0, 8) +
    '-' +
    hex.substring(8, 12) +
    '-' +
    hex.substring(12, 16) +
    '-' +
    hex.substring(16, 20) +
    '-' +
    hex.substring(20, 32)
  );
}
