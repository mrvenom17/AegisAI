/**
 * End-to-end HTTP smoke test for the Fastify API.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { FastifyInstance } from 'fastify';

let server: FastifyInstance;
let apiKey: string;
let systemId: string;
let snapshotId: string;

beforeAll(async () => {
  process.env.AEGIS_DB = join(mkdtempSync(join(tmpdir(), 'aegis-test-')), 'db.sqlite');
  process.env.AEGIS_ADMIN_TOKEN = 'test-admin';
  process.env.AEGIS_NO_LISTEN = '1';
  process.env.LOG_LEVEL = 'silent';
  const { buildServer } = await import('../api/server.js');
  server = await buildServer();
});

describe('AegisAI API end-to-end', () => {
  it('creates an org and issues an API key', async () => {
    const res = await server.inject({
      method: 'POST', url: '/v1/orgs',
      headers: { 'x-admin-token': 'test-admin', 'content-type': 'application/json' },
      payload: { name: 'Test Bank' }
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.api_key).toMatch(/^aegis_/);
    apiKey = body.api_key;
  });

  it('registers a system', async () => {
    const res = await server.inject({
      method: 'POST', url: '/v1/systems',
      headers: { 'x-api-key': apiKey, 'content-type': 'application/json' },
      payload: {
        system_id: 'credit-scorer-v3',
        version: '3.1.0',
        model_name: 'GBM',
        model_version: 'v3.1',
        intended_purpose: 'consumer credit scoring',
        deployment: {
          environment: 'PRODUCTION',
          region: 'eu-west-1',
          deployment_date: '2026-04-01T00:00:00Z'
        }
      }
    });
    expect(res.statusCode).toBe(200);
    systemId = res.json().id;
  });

  it('classifies the system as HIGH_RISK (Annex III §5(b))', async () => {
    const res = await server.inject({
      method: 'POST', url: `/v1/systems/${systemId}/classify`,
      headers: { 'x-api-key': apiKey, 'content-type': 'application/json' },
      payload: {
        questionnaire: {
          uses_subliminal_techniques: false,
          exploits_vulnerabilities: false,
          social_scoring_by_public_authority: false,
          predictive_policing_individual: false,
          untargeted_facial_scraping: false,
          emotion_recognition_workplace_or_education: false,
          biometric_categorisation_sensitive_attributes: false,
          real_time_remote_biometric_id_public_law_enforcement: false,
          biometrics_post_remote_or_categorisation: false,
          critical_infrastructure_safety_component: false,
          education_or_vocational_training_decisions: false,
          employment_recruitment_or_management: false,
          essential_private_or_public_services: false,
          creditworthiness_or_credit_scoring: true,
          life_or_health_insurance_pricing: false,
          emergency_response_dispatch: false,
          law_enforcement_use: false,
          migration_asylum_border_control: false,
          administration_of_justice_or_democratic_processes: false,
          is_general_purpose_ai_model: false,
          generates_synthetic_content_or_deepfakes: false,
          interacts_directly_with_natural_persons: false
        }
      }
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().tier).toBe('HIGH_RISK');
  });

  it('runs a multi-pack evaluation and returns a signed snapshot', async () => {
    const evidence = [
      {
        type: 'STRUCTURED_JSON', submitted_by: 'compliance', source_system: 'crm',
        observed_at: new Date().toISOString(),
        content: {
          claim_type: 'system_classification',
          is_social_scoring: false,
          is_real_time_biometric: false,
          uses_subliminal_techniques: false,
          exploits_vulnerabilities: false,
          emotion_recognition_workplace_or_education: false,
          attestation_signed_by: 'cco@bank.example'
        }
      },
      {
        type: 'STRUCTURED_JSON', submitted_by: 'data-science', source_system: 'mlops',
        observed_at: new Date().toISOString(),
        content: { claim_type: 'accuracy_metric', accuracy: 0.97, test_dataset_size: 5000, test_date: '2026-04-01' }
      },
      {
        type: 'STRUCTURED_JSON', submitted_by: 'security', source_system: 'security-pipeline',
        observed_at: new Date().toISOString(),
        content: { claim_type: 'robustness_test_result', score: 0.92, test_type: 'adversarial', test_date: '2026-04-02' }
      },
      {
        type: 'STRUCTURED_JSON', submitted_by: 'security', source_system: 'audit',
        observed_at: new Date().toISOString(),
        content: { claim_type: 'cybersecurity_audit', passed: true, audit_date: '2026-04-03', auditor: 'KPMG' }
      }
    ];

    const res = await server.inject({
      method: 'POST', url: '/v1/evaluations',
      headers: { 'x-api-key': apiKey, 'content-type': 'application/json' },
      payload: {
        system_version_id: systemId,
        packs: ['art-5', 'art-15'],
        evidence
      }
    });
    expect(res.statusCode).toBe(200);
    const snap = res.json();
    expect(snap.final_status).toBe('COMPLIANT');
    snapshotId = snap.id;
  });

  it('verifies the snapshot signature', async () => {
    const res = await server.inject({
      method: 'GET', url: `/v1/snapshots/${snapshotId}/verify`,
      headers: { 'x-api-key': apiKey }
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it('renders a conformity binder (Annex IV HTML)', async () => {
    const res = await server.inject({
      method: 'GET', url: `/v1/binders/${snapshotId}`,
      headers: { 'x-api-key': apiKey }
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.body).toContain('Annex IV');
    expect(res.body).toContain('credit-scorer-v3');
    expect(res.body).toContain('HIGH_RISK');
  });

  it('ingests a CRITICAL monitoring signal and surfaces it as a pending incident', async () => {
    await server.inject({
      method: 'POST', url: '/v1/monitoring/signals',
      headers: { 'x-api-key': apiKey, 'content-type': 'application/json' },
      payload: {
        system_version_id: systemId,
        observed_at: new Date().toISOString(),
        signal_type: 'INCIDENT',
        payload: { description: 'model recommended decline for protected class above threshold' },
        severity: 'CRITICAL'
      }
    });
    const res = await server.inject({
      method: 'GET', url: '/v1/monitoring/incidents',
      headers: { 'x-api-key': apiKey }
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
    expect(res.json().length).toBeGreaterThanOrEqual(1);
  });

  it('exposes a hash-chained audit log', async () => {
    const res = await server.inject({
      method: 'GET', url: '/v1/audit-log',
      headers: { 'x-api-key': apiKey }
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.chain_valid).toBe(true);
    expect(body.entries.length).toBeGreaterThan(0);
  });
});
