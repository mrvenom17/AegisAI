/**
 * AegisAI HTTP API.
 *
 * Endpoints (all multi-tenant via X-API-Key):
 *   POST /v1/orgs                     — create tenant (admin-only via env token)
 *   POST /v1/systems                  — register an AI system version
 *   GET  /v1/systems                  — list systems for tenant
 *   POST /v1/systems/:id/classify     — Annex III classification
 *   POST /v1/evaluations              — run a compliance evaluation
 *   GET  /v1/snapshots/:id            — fetch a snapshot
 *   GET  /v1/snapshots/:id/verify     — verify the cryptographic signature
 *   POST /v1/fria                     — create a FRIA
 *   POST /v1/fria/:id/submit          — DRAFT -> IN_REVIEW
 *   POST /v1/fria/:id/approve         — IN_REVIEW -> APPROVED
 *   POST /v1/monitoring/signals       — ingest monitoring/incident webhook
 *   GET  /v1/monitoring/incidents     — pending Article 73 incident reports
 *   GET  /v1/binders/:snapshotId      — Annex IV HTML binder for a snapshot
 *   GET  /v1/audit-log                — list + verify the org audit chain
 */

import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { createAppContext, createTenantContext, TenantContext } from './context.js';
import { PolicyLoader } from '../services/policy-loader.js';
import { ParameterSet, PolicySet } from '../domain/types.js';
import { hashObject } from '../utils/crypto.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.AEGIS_DB ?? join(__dirname, '../../aegis.db');
const ADMIN_TOKEN = process.env.AEGIS_ADMIN_TOKEN ?? 'admin-dev-token';
const PORT = Number(process.env.PORT ?? 8080);

const app = createAppContext(DB_PATH);
const policyLoader = new PolicyLoader();

const POLICIES_DIR = join(__dirname, '../../policies');
const policyCache = new Map<string, PolicySet>();
function loadPack(filename: string): PolicySet {
  const cached = policyCache.get(filename);
  if (cached) return cached;
  const ps = policyLoader.loadFromJSON(join(POLICIES_DIR, filename));
  policyCache.set(filename, ps);
  return ps;
}

const PACK_REGISTRY: Record<string, string> = {
  'art-5': 'eu-ai-act-article-5.json',
  'art-9': 'eu-ai-act-article-9.json',
  'art-10': 'eu-ai-act-article-10.json',
  'art-13': 'eu-ai-act-article-13.json',
  'art-14': 'eu-ai-act-article-14.json',
  'art-15': 'eu-ai-act-article-15.json'
};

export async function buildServer() {
  const server = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });
  await server.register(sensible);

  server.setErrorHandler((err, _req, reply) => {
    if (err.validation) {
      reply.status(400).send({ error: 'validation_error', details: err.message });
      return;
    }
    server.log.error({ err }, 'unhandled');
    reply.status(err.statusCode ?? 500).send({
      error: err.name ?? 'internal_error',
      message: err.message
    });
  });

  // ----- Admin: create org (returns API key once) -----
  server.post('/v1/orgs', async (req, reply) => {
    const adminToken = req.headers['x-admin-token'];
    if (adminToken !== ADMIN_TOKEN) return reply.unauthorized('admin token required');
    const body = z.object({ name: z.string().min(1) }).parse(req.body);
    const created = app.orgStore.create(body.name);
    return reply.send({
      org_id: created.org.id,
      name: created.org.name,
      api_key: created.api_key_plaintext,
      signing_key_id: created.org.signing_key_id,
      signing_public_key_pem: created.org.signing_public_key_pem
    });
  });

  // ----- Tenant authentication hook -----
  server.decorateRequest('tenant', null);
  server.addHook('preHandler', async (req, reply) => {
    if (req.url.startsWith('/v1/orgs')) return;
    if (req.url === '/health') return;
    const apiKey = req.headers['x-api-key'];
    if (typeof apiKey !== 'string') return reply.unauthorized('X-API-Key required');
    const org = app.orgStore.authenticate(apiKey);
    if (!org) return reply.unauthorized('invalid api key');
    (req as unknown as { tenant: TenantContext }).tenant = createTenantContext(app, org);
  });

  server.get('/health', async () => ({ ok: true, version: pkgVersion() }));

  // ----- Systems -----
  server.post('/v1/systems', async (req, reply) => {
    const t = tenant(req);
    const body = z.object({
      system_id: z.string(),
      version: z.string(),
      model_name: z.string(),
      model_version: z.string(),
      intended_purpose: z.string(),
      deployment: z.object({
        environment: z.enum(['PRODUCTION', 'STAGING', 'DEVELOPMENT']),
        region: z.string(),
        deployment_date: z.string()
      })
    }).parse(req.body);
    const sv = t.registry.registerSystemVersion({
      orgId: t.org.id,
      systemId: body.system_id,
      version: body.version,
      modelName: body.model_name,
      modelVersion: body.model_version,
      intendedPurpose: body.intended_purpose,
      deploymentContext: {
        environment: body.deployment.environment,
        region: body.deployment.region,
        deploymentDate: body.deployment.deployment_date
      }
    });
    t.auditLog.append({
      orgId: t.org.id,
      actor: 'api',
      action: 'SYSTEM_REGISTERED',
      targetType: 'system_version',
      targetId: sv.id,
      payload: { system_id: sv.system_id, version: sv.version }
    });
    reply.send(sv);
  });

  server.get('/v1/systems', async (req) => {
    const t = tenant(req);
    return t.registry.listSystemVersions(t.org.id);
  });

  // ----- Annex III classification -----
  server.post('/v1/systems/:id/classify', async (req, reply) => {
    const t = tenant(req);
    const params = z.object({ id: z.string() }).parse(req.params);
    const body = z.object({ questionnaire: z.record(z.unknown()) }).parse(req.body);
    const sv = t.registry.getSystemVersion(params.id, t.org.id);
    const cls = t.classifier.classify({
      orgId: t.org.id,
      systemVersionRef: sv.id,
      questionnaire: body.questionnaire,
      signingPrivateKeyPem: t.org.signing_private_key_pem
    });
    t.registry.setRiskTier(sv.id, cls.tier);
    app.handle.db
      .prepare(
        `INSERT INTO classifications (id, org_id, system_version_ref, classified_at, data)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(cls.id, cls.org_id, cls.system_version_ref, cls.classified_at, JSON.stringify(cls));
    t.auditLog.append({
      orgId: t.org.id,
      actor: 'api',
      action: 'SYSTEM_CLASSIFIED',
      targetType: 'classification',
      targetId: cls.id,
      payload: { tier: cls.tier, system_version_ref: sv.id }
    });
    reply.send(cls);
  });

  // ----- Compliance evaluation -----
  server.post('/v1/evaluations', async (req, reply) => {
    const t = tenant(req);
    const body = z.object({
      system_version_id: z.string(),
      packs: z.array(z.string()).min(1),
      parameters: z.record(z.unknown()).default({}),
      evidence: z.array(
        z.object({
          type: z.enum(['STRUCTURED_JSON', 'DOCUMENT_PDF', 'DOCUMENT_TXT', 'METRICS_DATASET', 'MONITORING_SIGNAL']),
          content: z.unknown(),
          claim_type_hint: z.string().optional(),
          submitted_by: z.string(),
          source_system: z.string(),
          observed_at: z.string().optional()
        })
      )
    }).parse(req.body);

    const policySets = body.packs.map((p) => {
      const file = PACK_REGISTRY[p];
      if (!file) throw new Error(`Unknown policy pack: ${p}`);
      return loadPack(file);
    });

    const merged: PolicySet = {
      version: policySets.map((p) => p.version).join('+'),
      effective_date: policySets[0].effective_date,
      metadata: {
        name: 'composite',
        regulatory_source: policySets.map((p) => p.metadata.regulatory_source).join('; ')
      },
      rules: policySets.flatMap((p) => p.rules)
    };

    const parameterSet: ParameterSet = {
      id: hashObject(body.parameters),
      version: '1.0',
      parameters: body.parameters,
      effective_date: new Date().toISOString()
    };

    const snap = await t.orchestrator.evaluateCompliance({
      orgId: t.org.id,
      systemVersionId: body.system_version_id,
      evidenceSubmissions: body.evidence.map((e) => ({
        type: e.type,
        content: e.content,
        claim_type_hint: e.claim_type_hint,
        metadata: {
          submitted_by: e.submitted_by,
          source_system: e.source_system,
          observed_at: e.observed_at
        }
      })),
      policySet: merged,
      parameterSet,
      actor: 'api'
    });
    reply.send(snap);
  });

  server.get('/v1/snapshots/:id', async (req) => {
    const t = tenant(req);
    const { id } = z.object({ id: z.string() }).parse(req.params);
    return t.snapshotStore.getSnapshot(id, t.org.id);
  });

  server.get('/v1/snapshots/:id/verify', async (req) => {
    const t = tenant(req);
    const { id } = z.object({ id: z.string() }).parse(req.params);
    return { ok: t.snapshotStore.verifySignature(id) };
  });

  // ----- FRIA -----
  server.post('/v1/fria', async (req, reply) => {
    const t = tenant(req);
    const body = z.object({
      system_version_id: z.string(),
      deployer_organization: z.string(),
      intended_purpose: z.string(),
      affected_categories: z.array(z.string()),
      usage_period: z.object({ start: z.string(), end: z.string().optional() }),
      risks_identified: z.array(z.object({
        risk: z.string(),
        likelihood: z.enum(['LOW','MEDIUM','HIGH']),
        severity: z.enum(['LOW','MEDIUM','HIGH']),
        affected_rights: z.array(z.string())
      })),
      mitigations: z.array(z.object({
        mitigation: z.string(),
        responsible_role: z.string(),
        review_cadence: z.string()
      })),
      human_oversight_measures: z.array(z.string())
    }).parse(req.body);
    const fria = t.fria.create({
      orgId: t.org.id,
      systemVersionRef: body.system_version_id,
      deployerOrganization: body.deployer_organization,
      intendedPurpose: body.intended_purpose,
      affectedCategories: body.affected_categories,
      usagePeriod: body.usage_period,
      risksIdentified: body.risks_identified,
      mitigations: body.mitigations,
      humanOversightMeasures: body.human_oversight_measures,
      actor: 'api'
    });
    reply.send(fria);
  });

  server.post('/v1/fria/:id/submit', async (req) => {
    const t = tenant(req);
    const { id } = z.object({ id: z.string() }).parse(req.params);
    return t.fria.submitForReview(id, 'api');
  });
  server.post('/v1/fria/:id/approve', async (req) => {
    const t = tenant(req);
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z.object({ approver_email: z.string().email() }).parse(req.body);
    return t.fria.approve(id, body.approver_email);
  });

  // ----- Monitoring & incidents -----
  server.post('/v1/monitoring/signals', async (req, reply) => {
    const t = tenant(req);
    const body = z.object({
      system_version_id: z.string(),
      observed_at: z.string(),
      signal_type: z.enum([
        'PERFORMANCE_DRIFT','INPUT_DRIFT','INCIDENT','NEAR_MISS','USER_FEEDBACK','BIAS_OBSERVED'
      ]),
      payload: z.record(z.unknown()),
      severity: z.enum(['LOW','MEDIUM','HIGH','CRITICAL'])
    }).parse(req.body);
    const sig = t.monitoring.ingest({
      orgId: t.org.id,
      systemVersionRef: body.system_version_id,
      observedAt: body.observed_at,
      signalType: body.signal_type,
      payload: body.payload,
      severity: body.severity,
      actor: 'api'
    });
    reply.send(sig);
  });

  server.get('/v1/monitoring/incidents', async (req) => {
    const t = tenant(req);
    return t.monitoring.pendingIncidentReports(t.org.id);
  });

  server.post('/v1/monitoring/signals/:id/report', async (req) => {
    const t = tenant(req);
    const { id } = z.object({ id: z.string() }).parse(req.params);
    t.monitoring.markReported(t.org.id, id, 'api');
    return { ok: true };
  });

  // ----- Conformity binder (Annex IV) -----
  server.get('/v1/binders/:snapshotId', async (req, reply) => {
    const t = tenant(req);
    const { snapshotId } = z.object({ snapshotId: z.string() }).parse(req.params);
    const snap = t.snapshotStore.getSnapshot(snapshotId, t.org.id);
    const sys = t.registry.getSystemVersion(snap.system_version_ref, t.org.id);
    // Pick the latest classification for this system, if any
    const clsRow = app.handle.db
      .prepare(
        `SELECT data FROM classifications
         WHERE org_id = ? AND system_version_ref = ?
         ORDER BY classified_at DESC LIMIT 1`
      )
      .get(t.org.id, sys.id) as { data: string } | undefined;
    if (!clsRow) return reply.notFound('No risk classification on file. Run /v1/systems/:id/classify first.');
    const classification = JSON.parse(clsRow.data);
    const fria = t.fria.list(t.org.id).find((f) => f.system_version_ref === sys.id);

    const policySets = Object.entries(PACK_REGISTRY).map(([, file]) => loadPack(file));
    const isoCoverage = app.isoMapper.coverage(snap, {
      ...policySets[0],
      rules: policySets.flatMap((p) => p.rules)
    });
    const recentSignals = t.monitoring.list(t.org.id, sys.id).slice(0, 50);

    const html = t.docGen.generateAnnexIV({
      system: sys, classification, snapshot: snap,
      policySets, fria, isoCoverage, recentSignals
    });
    reply.type('text/html').send(html);
  });

  // ----- Audit log -----
  server.get('/v1/audit-log', async (req) => {
    const t = tenant(req);
    const entries = t.auditLog.list(t.org.id);
    const tamperedAt = t.auditLog.verifyChain(t.org.id);
    return { chain_valid: tamperedAt === -1, tampered_at_index: tamperedAt, entries };
  });

  return server;
}

function tenant(req: unknown): TenantContext {
  const t = (req as { tenant?: TenantContext }).tenant;
  if (!t) throw new Error('tenant not initialised');
  return t;
}

function pkgVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));
    return pkg.version;
  } catch {
    return 'unknown';
  }
}

if (process.env.AEGIS_NO_LISTEN !== '1') {
  const server = await buildServer();
  await server.listen({ port: PORT, host: '0.0.0.0' });
}
