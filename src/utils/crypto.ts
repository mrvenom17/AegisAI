/**
 * Cryptographic Utilities
 * 
 * Provides deterministic hashing, signing, and Merkle tree operations.
 * All operations are synchronous and deterministic.
 */

import { createHash, createSign, createVerify } from 'crypto';

// ============================================================================
// Hashing
// ============================================================================

/**
 * Compute SHA-256 hash of input data.
 * Deterministic: same input always produces same output.
 */
export function sha256(data: string | Buffer): string {
  const hash = createHash('sha256');
  hash.update(data);
  return hash.digest('hex');
}

/**
 * Compute hash of a JSON-serializable object.
 * Uses deterministic JSON serialization (sorted keys).
 */
export function hashObject(obj: unknown): string {
  const serialized = deterministicStringify(obj);
  return sha256(serialized);
}

/**
 * Deterministic JSON stringification.
 * Sorts object keys to ensure consistent hashing.
 */
function deterministicStringify(obj: unknown): string {
  if (obj === null || obj === undefined) {
    return String(obj);
  }
  
  if (typeof obj === 'string') {
    return JSON.stringify(obj);
  }
  
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj);
  }
  
  if (Array.isArray(obj)) {
    return '[' + obj.map(deterministicStringify).join(',') + ']';
  }
  
  if (typeof obj === 'object') {
    const sortedKeys = Object.keys(obj).sort();
    const pairs = sortedKeys.map(key => {
      return JSON.stringify(key) + ':' + deterministicStringify((obj as Record<string, unknown>)[key]);
    });
    return '{' + pairs.join(',') + '}';
  }
  
  return String(obj);
}

// ============================================================================
// Merkle Tree
// ============================================================================

/**
 * Compute Merkle root from array of hashes.
 * Uses binary tree structure with deterministic ordering.
 */
export function computeMerkleRoot(hashes: string[]): string {
  if (hashes.length === 0) {
    return sha256('');
  }
  
  if (hashes.length === 1) {
    return hashes[0];
  }
  
  // Pair-wise hashing with deterministic ordering
  const nextLevel: string[] = [];
  
  for (let i = 0; i < hashes.length; i += 2) {
    if (i + 1 < hashes.length) {
      // Pair exists: hash(left + right)
      const pair = hashes[i] + hashes[i + 1];
      nextLevel.push(sha256(pair));
    } else {
      // Odd element: hash(element + element) to maintain tree structure
      const pair = hashes[i] + hashes[i];
      nextLevel.push(sha256(pair));
    }
  }
  
  return computeMerkleRoot(nextLevel);
}

/**
 * Compute Merkle root from array of VerifiedClaim content hashes.
 */
export function computeEvidenceMerkleRoot(claimHashes: string[]): string {
  // Sort hashes for deterministic ordering
  const sortedHashes = [...claimHashes].sort();
  return computeMerkleRoot(sortedHashes);
}

// ============================================================================
// Digital Signatures
// ============================================================================

/**
 * Sign data using RSA private key.
 * Returns base64-encoded signature.
 */
export function signData(data: string, privateKey: string): string {
  const sign = createSign('RSA-SHA256');
  sign.update(data);
  sign.end();
  return sign.sign(privateKey, 'base64');
}

/**
 * Verify signature using RSA public key.
 */
export function verifySignature(
  data: string,
  signature: string,
  publicKey: string
): boolean {
  const verify = createVerify('RSA-SHA256');
  verify.update(data);
  verify.end();
  return verify.verify(publicKey, signature, 'base64');
}

/**
 * Sign a ComplianceSnapshot.
 * Signs the snapshot data (excluding signature field).
 */
export function signSnapshot(
  snapshot: Omit<{ signature: string }, 'signature'> & Record<string, unknown>,
  privateKey: string
): string {
  // Create signable representation (exclude signature field)
  const signableData = deterministicStringify(snapshot);
  return signData(signableData, privateKey);
}

/**
 * Verify a ComplianceSnapshot signature.
 */
export function verifySnapshotSignature(
  snapshot: { signature: string } & Record<string, unknown>,
  publicKey: string
): boolean {
  // Create signable representation (exclude signature field)
  const { signature, ...signableData } = snapshot;
  const signableString = deterministicStringify(signableData);
  return verifySignature(signableString, signature, publicKey);
}
