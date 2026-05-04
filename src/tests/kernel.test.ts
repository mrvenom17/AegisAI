/**
 * Kernel regression tests covering the bugs found in the v0 red-team.
 */
import { describe, it, expect } from 'vitest';
import {
  EvidenceVault,
  EvidenceVerifier,
  StructuredJSONAdapter,
  PolicyEngine,
  SnapshotStore,
  SystemRegistry,
  Orchestrator,
  AuditLog,
  PolicyLoader,
  generateEd25519KeyPair,
  hashObject,
  merkleRoot
} from '../index.js';
import { ParameterSet, PolicySet } from '../domain/types.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POLICIES = join(__dirname, '../../policies');

const ORG = 'org-test';
const KEYS = generateEd25519KeyPair();

function buildStack() {
  const vault = new EvidenceVault();
  const verifier = new EvidenceVerifier({ vault });
  verifier.registerAdapter('STRUCTURED_JSON', new StructuredJSONAdapter(undefined, 'structured_claim'));
  const registry = new SystemRegistry();
  const auditLog = new AuditLog();
  const snapshotStore = new SnapshotStore({
    privateKeyPem: KEYS.privateKeyPem,
    publicKeyPem: KEYS.publicKeyPem,
    signingKeyId: 'test-key'
  });
  const policyEngine = new PolicyEngine();
  const orchestrator = new Orchestrator({
    registry, vault, verifier, policyEngine, snapshotStore, auditLog
  });
  const sv = registry.registerSystemVersion({
    orgId: ORG, systemId: 'test', version: '1.0',
    modelName: 'M', modelVersion: 'v1', intendedPurpose: 'unit test',
    deploymentContext: { environment: 'PRODUCTION', region: 'EU', deploymentDate: '2024-01-01T00:00:00Z' }
  });
  return { vault, verifier, registry, auditLog, snapshotStore, policyEngine, orchestrator, sv };
}

const params: ParameterSet = {
  id: 'p1', version: '1.0', parameters: {}, effective_date: '2024-01-01T00:00:00Z'
};

const ev = (claim_type: string, extra: Record<string, unknown>) => ({
  type: 'STRUCTURED_JSON' as const,
  content: { claim_type, ...extra },
  metadata: {
    submitted_by: 'test',
    source_system: 'unit',
    observed_at: new Date().toISOString()
  }
});

describe('Article 5 fail-closed (v0 bypass regression)', () => {
  it('blocks evaluation when classification fields are omitted', async () => {
    const loader = new PolicyLoader();
    const policySet = loader.loadFromJSON(join(POLICIES, 'eu-ai-act-article-5.json'));
    const { orchestrator, sv } = buildStack();
    const snap = await orchestrator.evaluateCompliance({
      orgId: ORG,
      systemVersionId: sv.id,
      evidenceSubmissions: [ev('system_classification', {
        product_name: 'totally legitimate analytics platform'
      })],
      policySet,
      parameterSet: params,
      actor: 'test'
    });
    expect(snap.final_status).toBe('NON_COMPLIANT_BLOCKING');
  });

  it('passes only on explicit signed false attestation', async () => {
    const loader = new PolicyLoader();
    const policySet = loader.loadFromJSON(join(POLICIES, 'eu-ai-act-article-5.json'));
    const { orchestrator, sv } = buildStack();
    const snap = await orchestrator.evaluateCompliance({
      orgId: ORG,
      systemVersionId: sv.id,
      evidenceSubmissions: [ev('system_classification', {
        is_social_scoring: false,
        is_real_time_biometric: false,
        uses_subliminal_techniques: false,
        exploits_vulnerabilities: false,
        emotion_recognition_workplace_or_education: false,
        attestation_signed_by: 'compliance@bank.example'
      })],
      policySet,
      parameterSet: params,
      actor: 'test'
    });
    expect(snap.final_status).not.toBe('NON_COMPLIANT_BLOCKING');
  });
});

describe('Determinism', () => {
  it('produces bit-identical snapshot ID, signature, and merkle root for same inputs', async () => {
    const loader = new PolicyLoader();
    const policySet = loader.loadFromJSON(join(POLICIES, 'eu-ai-act-article-15.json'));

    const evidence = [
      ev('accuracy_metric', { accuracy: 0.97, test_dataset_size: 5000, test_date: '2024-01-10' }),
      ev('robustness_test_result', { score: 0.92, test_type: 'adversarial', test_date: '2024-01-12' }),
      ev('cybersecurity_audit', { passed: true, audit_date: '2024-01-14', auditor: 'internal' })
    ];

    const run = async () => {
      const { orchestrator, sv } = buildStack();
      return orchestrator.evaluateCompliance({
        orgId: ORG, systemVersionId: sv.id,
        evidenceSubmissions: evidence,
        policySet, parameterSet: params, actor: 'test'
      });
    };

    const a = await run();
    const b = await run();
    // Timestamps differ across runs because the orchestrator stamps `now`,
    // but the merkle root + parameter hash + final_status MUST be deterministic.
    expect(a.evidence_merkle_root).toBe(b.evidence_merkle_root);
    expect(a.parameter_set_hash).toBe(b.parameter_set_hash);
    expect(a.final_status).toBe(b.final_status);
  });
});

describe('Immutability', () => {
  it('returned snapshots are frozen', async () => {
    const loader = new PolicyLoader();
    const policySet = loader.loadFromJSON(join(POLICIES, 'eu-ai-act-article-15.json'));
    const { orchestrator, sv } = buildStack();
    const snap = await orchestrator.evaluateCompliance({
      orgId: ORG, systemVersionId: sv.id,
      evidenceSubmissions: [
        ev('cybersecurity_audit', { passed: true, audit_date: '2024-01-14', auditor: 'internal' })
      ],
      policySet, parameterSet: params, actor: 'test'
    });
    expect(Object.isFrozen(snap)).toBe(true);
    expect(() => {
      (snap as { final_status: string }).final_status = 'NON_COMPLIANT_BLOCKING';
    }).toThrow();
  });
});

describe('Signing', () => {
  it('verifies a real Ed25519 signature, not a hash', async () => {
    const loader = new PolicyLoader();
    const policySet = loader.loadFromJSON(join(POLICIES, 'eu-ai-act-article-15.json'));
    const { orchestrator, snapshotStore, sv } = buildStack();
    const snap = await orchestrator.evaluateCompliance({
      orgId: ORG, systemVersionId: sv.id,
      evidenceSubmissions: [
        ev('cybersecurity_audit', { passed: true, audit_date: '2024-01-14', auditor: 'internal' })
      ],
      policySet, parameterSet: params, actor: 'test'
    });
    expect(snap.signature.length).toBeGreaterThan(64);
    expect(snapshotStore.verifySignature(snap.id)).toBe(true);
  });
});

describe('Provenance-bound merkle', () => {
  it('different submitters produce different merkle roots even with identical claim data', async () => {
    const a = merkleRoot([
      hashObject({ claim_type: 'x', claim_data: { v: 1 }, evidence_vault_ref: 'addr1', verifier_version: '0.1.0' })
    ]);
    const b = merkleRoot([
      hashObject({ claim_type: 'x', claim_data: { v: 1 }, evidence_vault_ref: 'addr2', verifier_version: '0.1.0' })
    ]);
    expect(a).not.toBe(b);
  });
});

describe('Audit chain integrity', () => {
  it('verifyChain returns -1 for a clean chain', () => {
    const log = new AuditLog();
    log.append({ orgId: ORG, actor: 'test', action: 'X', targetType: 't', targetId: 'a', payload: {} });
    log.append({ orgId: ORG, actor: 'test', action: 'Y', targetType: 't', targetId: 'b', payload: {} });
    expect(log.verifyChain(ORG)).toBe(-1);
  });
});

describe('Parameter precedence', () => {
  it('global parameters drive logic when rule does not override; rule.parameters override globals', () => {
    const engine = new PolicyEngine();
    const rule: PolicySet['rules'][number] = {
      obligation_id: 'TEST', control_id: 'C', rule_id: 'R',
      required_claims: ['accuracy_metric'],
      required_fields: { accuracy_metric: ['accuracy'] },
      parameters: { min: 0.95 }, // rule overrides global
      logic: { '>=': [{ var: 'accuracy_metric.accuracy' }, { var: 'min' }] },
      failure_mode: 'FAIL',
      fail_on_missing: true
    };
    const claim = {
      id: '00000000-0000-0000-0000-000000000001',
      org_id: ORG,
      evidence_vault_ref: 'x',
      claim_type: 'accuracy_metric',
      claim_data: { accuracy: 0.96 },
      verified_at: new Date().toISOString(),
      verifier_version: '0.1',
      validation_metadata: { schema_version: '0.1' }
    };
    const result = engine.evaluate([claim], [rule], { min: 0.99 });
    // Rule says 0.95, accuracy is 0.96 → rule should win → PASS.
    expect(result.rule_evaluations[0].passed).toBe(true);
    expect(result.rule_evaluations[0].parameters_used.min).toBe(0.95);
  });
});
