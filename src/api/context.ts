/**
 * Per-tenant service container. Each request resolves an org and attaches
 * a fresh container scoped to that org's signing keys.
 */

import { openDatabase, DbHandle, SqliteVaultStorage, SqliteRegistryStorage,
  SqliteSnapshotStorage, SqliteFRIAStorage, SqliteMonitoringStorage,
  SqliteAuditStorage } from '../storage/sqlite.js';
import { OrgStore, Organization } from '../storage/orgs.js';
import { EvidenceVault } from '../services/evidence-vault.js';
import { EvidenceVerifier, StructuredJSONAdapter, DocumentAdapter,
  MonitoringSignalAdapter } from '../services/evidence-verifier.js';
import { SystemRegistry } from '../services/system-registry.js';
import { PolicyEngine } from '../services/policy-engine.js';
import { SnapshotStore } from '../services/snapshot-store.js';
import { Orchestrator } from '../services/orchestrator.js';
import { FRIAService } from '../services/fria.js';
import { MonitoringService } from '../services/monitoring.js';
import { AuditLog } from '../services/audit-log.js';
import { RiskClassifier } from '../services/risk-classifier.js';
import { ISO42001Mapper } from '../services/iso-42001-mapper.js';
import { DocGen } from '../services/docgen.js';

export interface AppContext {
  handle: DbHandle;
  orgStore: OrgStore;
  isoMapper: ISO42001Mapper;
}

export function createAppContext(dbPath: string): AppContext {
  const handle = openDatabase(dbPath);
  return {
    handle,
    orgStore: new OrgStore(handle.db),
    isoMapper: new ISO42001Mapper()
  };
}

export interface TenantContext {
  org: Organization;
  vault: EvidenceVault;
  verifier: EvidenceVerifier;
  registry: SystemRegistry;
  snapshotStore: SnapshotStore;
  policyEngine: PolicyEngine;
  orchestrator: Orchestrator;
  fria: FRIAService;
  monitoring: MonitoringService;
  auditLog: AuditLog;
  classifier: RiskClassifier;
  docGen: DocGen;
}

export function createTenantContext(app: AppContext, org: Organization): TenantContext {
  const vault = new EvidenceVault({ storage: new SqliteVaultStorage(app.handle) });
  const verifier = new EvidenceVerifier({ vault });
  verifier.registerAdapter('STRUCTURED_JSON', new StructuredJSONAdapter(undefined, 'structured_claim'));
  verifier.registerAdapter('METRICS_DATASET', new StructuredJSONAdapter(undefined, 'metrics_dataset'));
  verifier.registerAdapter('DOCUMENT_PDF', new DocumentAdapter('document'));
  verifier.registerAdapter('DOCUMENT_TXT', new DocumentAdapter('document'));
  verifier.registerAdapter('MONITORING_SIGNAL', new MonitoringSignalAdapter('monitoring_signal'));

  const registry = new SystemRegistry({ storage: new SqliteRegistryStorage(app.handle) });
  const auditLog = new AuditLog(new SqliteAuditStorage(app.handle));
  const snapshotStore = new SnapshotStore({
    storage: new SqliteSnapshotStorage(app.handle),
    privateKeyPem: org.signing_private_key_pem,
    publicKeyPem: org.signing_public_key_pem,
    signingKeyId: org.signing_key_id
  });
  const policyEngine = new PolicyEngine();
  const orchestrator = new Orchestrator({
    registry, vault, verifier, policyEngine, snapshotStore, auditLog
  });
  const fria = new FRIAService(new SqliteFRIAStorage(app.handle), auditLog);
  const monitoring = new MonitoringService(
    new SqliteMonitoringStorage(app.handle), auditLog
  );
  const classifier = new RiskClassifier();
  const docGen = new DocGen();

  return {
    org, vault, verifier, registry, snapshotStore, policyEngine,
    orchestrator, fria, monitoring, auditLog, classifier, docGen
  };
}
