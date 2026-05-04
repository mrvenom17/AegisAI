-- AegisAI persistent schema. SQLite (better-sqlite3) for v0.1; the same DDL
-- runs on Postgres with trivial type swaps (TEXT -> JSONB, INTEGER -> BIGINT).

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  api_key_hash TEXT NOT NULL UNIQUE,
  signing_public_key_pem TEXT NOT NULL,
  signing_private_key_pem TEXT NOT NULL,
  signing_key_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS system_versions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  data TEXT NOT NULL  -- canonical JSON of SystemVersion
);
CREATE INDEX IF NOT EXISTS idx_sv_org ON system_versions(org_id);

CREATE TABLE IF NOT EXISTS evidence (
  content_hash TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  data TEXT NOT NULL  -- canonical JSON of RawEvidence
);
CREATE INDEX IF NOT EXISTS idx_ev_org ON evidence(org_id);

CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  system_version_ref TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  data TEXT NOT NULL  -- canonical JSON of ComplianceSnapshot
);
CREATE INDEX IF NOT EXISTS idx_snap_sys ON snapshots(org_id, system_version_ref, timestamp DESC);

CREATE TABLE IF NOT EXISTS snapshot_supersession (
  old_id TEXT PRIMARY KEY REFERENCES snapshots(id),
  new_id TEXT NOT NULL REFERENCES snapshots(id)
);

CREATE TABLE IF NOT EXISTS classifications (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  system_version_ref TEXT NOT NULL,
  classified_at TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cls_sys ON classifications(org_id, system_version_ref, classified_at DESC);

CREATE TABLE IF NOT EXISTS frias (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  system_version_ref TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fria_sys ON frias(org_id, system_version_ref);

CREATE TABLE IF NOT EXISTS monitoring_signals (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  system_version_ref TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ms_sys ON monitoring_signals(org_id, system_version_ref, observed_at DESC);

CREATE TABLE IF NOT EXISTS audit_entries (
  rowid_seq INTEGER PRIMARY KEY AUTOINCREMENT,
  seq INTEGER NOT NULL,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  data TEXT NOT NULL,
  UNIQUE (org_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_entries(org_id, seq);
