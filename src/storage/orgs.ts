/**
 * Organization (tenant) management. Each org has its own signing key and
 * API key. Tenant isolation is enforced by every service through org_id.
 */

import Database from 'better-sqlite3';
import { generateUUID } from '../utils/uuid.js';
import { sha256, generateEd25519KeyPair } from '../utils/crypto.js';

export interface Organization {
  id: string;
  name: string;
  api_key_hash: string;
  signing_public_key_pem: string;
  signing_private_key_pem: string;
  signing_key_id: string;
  created_at: string;
}

export interface CreatedOrganization {
  org: Organization;
  api_key_plaintext: string;
}

export class OrgStore {
  constructor(private readonly db: Database.Database) {}

  create(name: string): CreatedOrganization {
    const id = generateUUID();
    const apiKey = 'aegis_' + generateUUID().replace(/-/g, '');
    const apiKeyHash = sha256(apiKey);
    const keys = generateEd25519KeyPair();
    const signingKeyId = sha256(keys.publicKeyPem).slice(0, 16);
    const created_at = new Date().toISOString();
    const org: Organization = {
      id,
      name,
      api_key_hash: apiKeyHash,
      signing_public_key_pem: keys.publicKeyPem,
      signing_private_key_pem: keys.privateKeyPem,
      signing_key_id: signingKeyId,
      created_at
    };
    this.db
      .prepare(
        `INSERT INTO organizations
         (id, name, api_key_hash, signing_public_key_pem, signing_private_key_pem, signing_key_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        org.id,
        org.name,
        org.api_key_hash,
        org.signing_public_key_pem,
        org.signing_private_key_pem,
        org.signing_key_id,
        org.created_at
      );
    return { org, api_key_plaintext: apiKey };
  }

  authenticate(apiKey: string): Organization | undefined {
    const hash = sha256(apiKey);
    const row = this.db
      .prepare('SELECT * FROM organizations WHERE api_key_hash = ?')
      .get(hash) as Organization | undefined;
    return row;
  }

  get(id: string): Organization | undefined {
    return this.db.prepare('SELECT * FROM organizations WHERE id = ?').get(id) as
      | Organization
      | undefined;
  }
}
