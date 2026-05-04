/**
 * Cryptographic primitives.
 *
 * - Deterministic JSON canonicalization (sorted keys, no insignificant whitespace).
 * - SHA-256 hashing.
 * - Merkle root over leaves that bind provenance, not just data.
 * - Ed25519 signing (default) or RSA-PSS via PEM (fallback).
 */

import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  KeyObject,
  sign as cryptoSign,
  verify as cryptoVerify
} from 'crypto';

export function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

export function canonicalize(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Cannot canonicalize non-finite number');
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']';
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return (
      '{' +
      keys
        .map(
          (k) =>
            JSON.stringify(k) +
            ':' +
            canonicalize((value as Record<string, unknown>)[k])
        )
        .join(',') +
      '}'
    );
  }
  throw new Error(`Cannot canonicalize value of type ${typeof value}`);
}

export function hashObject(obj: unknown): string {
  return sha256(canonicalize(obj));
}

/**
 * Merkle root that binds provenance per leaf.
 * Each leaf is hashed as canonical JSON of the *full* claim, not just claim_data.
 */
export function merkleRoot(leaves: string[]): string {
  if (leaves.length === 0) return sha256('');
  const sorted = [...leaves].sort();
  let level = sorted;
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : level[i];
      next.push(sha256(left + right));
    }
    level = next;
  }
  return level[0];
}

// ============================================================================
// Signing
// ============================================================================

export interface KeyPair {
  privateKeyPem: string;
  publicKeyPem: string;
  algorithm: 'ed25519';
}

export function generateEd25519KeyPair(): KeyPair {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }) as string,
    algorithm: 'ed25519'
  };
}

function loadPrivateKey(pem: string): KeyObject {
  return createPrivateKey(pem);
}

function loadPublicKey(pem: string): KeyObject {
  return createPublicKey(pem);
}

export function signBytes(message: string, privateKeyPem: string): string {
  const key = loadPrivateKey(privateKeyPem);
  const signature = cryptoSign(null, Buffer.from(message, 'utf8'), key);
  return signature.toString('base64');
}

export function verifyBytes(
  message: string,
  signatureB64: string,
  publicKeyPem: string
): boolean {
  try {
    const key = loadPublicKey(publicKeyPem);
    return cryptoVerify(
      null,
      Buffer.from(message, 'utf8'),
      key,
      Buffer.from(signatureB64, 'base64')
    );
  } catch {
    return false;
  }
}

/**
 * Sign a snapshot-shaped object. Excludes the `signature` field from the
 * canonical input so signatures are stable across produce/verify roundtrips.
 */
export function signSnapshot(
  snapshot: Record<string, unknown>,
  privateKeyPem: string
): string {
  const { signature: _ignored, ...rest } = snapshot as Record<string, unknown> & {
    signature?: unknown;
  };
  void _ignored;
  return signBytes(canonicalize(rest), privateKeyPem);
}

export function verifySnapshotSignature(
  snapshot: Record<string, unknown> & { signature: string },
  publicKeyPem: string
): boolean {
  const { signature, ...rest } = snapshot;
  return verifyBytes(canonicalize(rest), signature, publicKeyPem);
}
