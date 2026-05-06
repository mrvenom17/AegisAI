#!/usr/bin/env node
/**
 * Generate a realistic Annex IV binder for a fictional EU bank,
 * using the live AegisAI API in-process via Fastify.inject.
 *
 * Output: marketing/demo-binder.html (open in a browser → Cmd-P → Save as PDF)
 *
 * Usage:
 *   npm run build && node scripts/generate-demo-binder.mjs
 *
 * Environment:
 *   AEGIS_DB         (optional)  defaults to ./demo.db (deleted at start)
 *   DEMO_OUT         (optional)  defaults to marketing/demo-binder.html
 */

import { mkdirSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Use a throwaway DB so the demo is repeatable.
const DB = resolve(ROOT, 'demo.db');
process.env.AEGIS_DB = DB;
process.env.AEGIS_ADMIN_TOKEN = 'demo-admin';
process.env.AEGIS_NO_LISTEN = '1';
process.env.LOG_LEVEL = 'silent';
if (existsSync(DB)) unlinkSync(DB);

const OUT = process.env.DEMO_OUT
  ? resolve(process.env.DEMO_OUT)
  : resolve(ROOT, 'marketing', 'demo-binder.html');

const { buildServer } = await import('../dist/api/server.js');
const server = await buildServer();

async function http(method, url, payload, headers = {}) {
  const res = await server.inject({
    method,
    url,
    headers: { 'content-type': 'application/json', ...headers },
    payload: payload === undefined ? undefined : JSON.stringify(payload)
  });
  if (res.statusCode >= 400) {
    throw new Error(`${method} ${url} → ${res.statusCode}: ${res.body}`);
  }
  const ct = res.headers['content-type'] ?? '';
  return ct.includes('application/json') ? res.json() : res.body;
}

function today(offsetDays = 0) {
  return new Date(Date.now() - offsetDays * 86_400_000).toISOString();
}

console.log('▸ Creating fictional bank tenant...');
const orgRes = await http(
  'POST',
  '/v1/orgs',
  { name: 'Hellenic Atlantic Bank S.A. (DEMO)' },
  { 'x-admin-token': 'demo-admin' }
);
const apiKey = orgRes.api_key;
const auth = { 'x-api-key': apiKey };

console.log('▸ Registering AI system: AtlantisCredit-v3 (consumer credit decisioning)');
const sys = await http(
  'POST',
  '/v1/systems',
  {
    system_id: 'atlantis-credit-v3',
    version: '3.4.2',
    model_name: 'AtlantisCredit-GBM',
    model_version: 'v3.4.2',
    intended_purpose:
      'Consumer credit decisioning for unsecured personal loans (€500–€50,000). Used by the bank to approve, decline, or refer loan applications across retail channels in Greece, Cyprus, Portugal, and Ireland.',
    deployment: {
      environment: 'PRODUCTION',
      region: 'eu-west-1',
      deployment_date: '2025-09-01T00:00:00Z'
    }
  },
  auth
);

console.log('▸ Running Annex III classifier...');
const classification = await http(
  'POST',
  `/v1/systems/${sys.id}/classify`,
  {
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
  },
  auth
);
console.log('  → tier:', classification.tier);

console.log('▸ Drafting FRIA (Article 27)...');
const fria = await http(
  'POST',
  '/v1/fria',
  {
    system_version_id: sys.id,
    deployer_organization: 'Hellenic Atlantic Bank S.A.',
    intended_purpose:
      'Approve, decline, or refer consumer credit applications for personal loans up to €50,000.',
    affected_categories: [
      'Consumer credit applicants in Greece, Cyprus, Portugal, and Ireland',
      'Applicants flagged as protected categories under EU non-discrimination law'
    ],
    usage_period: {
      start: '2025-09-01T00:00:00Z'
    },
    risks_identified: [
      {
        risk: 'Disparate impact on younger applicants (<25) due to thin-file bias.',
        likelihood: 'MEDIUM',
        severity: 'MEDIUM',
        affected_rights: ['Non-discrimination', 'Right to economic participation']
      },
      {
        risk: 'Decline-explainability gap when ensemble disagreement is high.',
        likelihood: 'MEDIUM',
        severity: 'HIGH',
        affected_rights: ['Right to explanation under GDPR Art. 22']
      },
      {
        risk: 'Cross-border data transfer in event of branch failover.',
        likelihood: 'LOW',
        severity: 'MEDIUM',
        affected_rights: ['Data protection']
      }
    ],
    mitigations: [
      {
        mitigation:
          'Shadow-mode review of all decline decisions for under-25 applicants by a credit officer for the first 12 months of deployment.',
        responsible_role: 'Head of Consumer Credit',
        review_cadence: 'Weekly during shadow window, monthly thereafter',
        effective_from: '2025-09-01T00:00:00Z',
        duration_days: 365
      },
      {
        mitigation:
          'High-disagreement decisions (model variance > 0.15) routed to human credit officer.',
        responsible_role: 'Model Risk Manager',
        review_cadence: 'Continuous'
      },
      {
        mitigation:
          'GDPR Article 22 explanation generated and delivered with every adverse decision.',
        responsible_role: 'Data Protection Officer',
        review_cadence: 'Quarterly audit'
      }
    ],
    human_oversight_measures: [
      'Designated credit officer per region with stop-decision authority within 4 hours of any flagged case.',
      'Daily monitoring dashboard of approval/decline distributions vs. baseline.',
      'Mandatory automation-bias training for credit officers, refreshed annually.',
      'Weekly review of complaints lodged against AI-driven decisions.'
    ]
  },
  auth
);
await http('POST', `/v1/fria/${fria.id}/submit`, {}, auth);
await http(
  'POST',
  `/v1/fria/${fria.id}/approve`,
  { approver_email: 'cco@hellenic-atlantic.example' },
  auth
);

console.log('▸ Submitting evidence + running multi-pack evaluation...');
const evidence = [
  // Article 5 — explicit signed false attestation (the only way past fail-closed rules)
  {
    type: 'STRUCTURED_JSON',
    submitted_by: 'Maria Papadakis (Chief Compliance Officer)',
    source_system: 'compliance-attestation-system',
    observed_at: today(2),
    content: {
      claim_type: 'system_classification',
      is_social_scoring: false,
      is_real_time_biometric: false,
      uses_subliminal_techniques: false,
      exploits_vulnerabilities: false,
      emotion_recognition_workplace_or_education: false,
      attestation_signed_by: 'cco@hellenic-atlantic.example'
    }
  },
  // Article 9 — risk management
  {
    type: 'STRUCTURED_JSON',
    submitted_by: 'Dimitris Stavrakis (Head of Model Risk)',
    source_system: 'mrm-platform',
    observed_at: today(7),
    content: {
      claim_type: 'risk_management_system',
      documented_at: today(60),
      process_owner: 'Head of Model Risk Management',
      review_cadence_months: 6
    }
  },
  {
    type: 'STRUCTURED_JSON',
    submitted_by: 'Dimitris Stavrakis (Head of Model Risk)',
    source_system: 'mrm-platform',
    observed_at: today(7),
    content: {
      claim_type: 'risk_register',
      entry_count: 23,
      last_updated_at: today(7),
      covers_foreseeable_misuse: true
    }
  },
  {
    type: 'STRUCTURED_JSON',
    submitted_by: 'Dimitris Stavrakis (Head of Model Risk)',
    source_system: 'mrm-platform',
    observed_at: today(14),
    content: {
      claim_type: 'residual_risk_assessment',
      overall_residual_risk_score: 0.27,
      approver: 'Chief Risk Officer'
    }
  },
  // Article 10 — data governance
  {
    type: 'STRUCTURED_JSON',
    submitted_by: 'Aikaterini Vlachou (Lead Data Scientist)',
    source_system: 'feature-store',
    observed_at: today(21),
    content: {
      claim_type: 'data_governance_record',
      training_dataset_id: 'ds-credit-train-2024Q4',
      validation_dataset_id: 'ds-credit-val-2024Q4',
      test_dataset_id: 'ds-credit-test-2024Q4',
      design_choices_documented: true,
      data_sources_documented: true,
      preprocessing_documented: true
    }
  },
  {
    type: 'STRUCTURED_JSON',
    submitted_by: 'Aikaterini Vlachou (Lead Data Scientist)',
    source_system: 'fairness-pipeline',
    observed_at: today(21),
    content: {
      claim_type: 'bias_assessment',
      examined_protected_attributes: ['age', 'gender', 'nationality_eu_non_eu'],
      max_disparity_ratio: 1.18,
      assessed_at: today(21)
    }
  },
  {
    type: 'STRUCTURED_JSON',
    submitted_by: 'Aikaterini Vlachou (Lead Data Scientist)',
    source_system: 'data-quality-pipeline',
    observed_at: today(21),
    content: {
      claim_type: 'data_quality_metrics',
      completeness: 0.991,
      label_error_rate: 0.014
    }
  },
  // Article 13 — instructions for use (full content reproduced in §7 of the binder)
  {
    type: 'STRUCTURED_JSON',
    submitted_by: 'Maria Papadakis (Chief Compliance Officer)',
    source_system: 'documentation-system',
    observed_at: today(30),
    content: {
      claim_type: 'instructions_for_use',
      provider_identity:
        'Hellenic Atlantic Bank S.A. — Model Risk Office, 12 Vasilissis Sofias Avenue, 10674 Athens, Greece',
      intended_purpose:
        'Consumer credit decisioning for unsecured personal loans (€500–€50,000) for resident retail customers in Greece, Cyprus, Portugal, and Ireland.',
      performance_characteristics:
        'Population-level Gini 0.62, AUC 0.89, calibration slope 1.03 ± 0.04 on the 2024-Q4 holdout (28,500 records). Demographic-parity ratio: 1.18 across age, gender, and EU/non-EU nationality buckets.',
      known_limitations:
        'Reduced accuracy for thin-file applicants (<6 months credit history). Not validated for SME lending, mortgage decisioning, or non-resident applicants. Prediction reliability degrades after 90 days without recalibration.',
      expected_lifetime:
        '24 months from deployment date (2025-09-01), with mandatory quarterly recalibration and an annual bias review.',
      human_oversight_measures:
        'Credit officer review for all declines for applicants under 25; high-disagreement routing (model variance > 0.15) to a human officer; monthly bias review by Model Risk Management; daily distribution monitoring against baseline.',
      input_specifications:
        '37 features: 12 bureau, 18 transactional, 7 customer-profile. All inputs validated against the deployment-time feature schema; out-of-range or missing inputs trigger a hard reject and a rule for human review.',
      output_specifications:
        'Three-class output: APPROVE, REFER (human review), DECLINE. Each output carries a probability score (0–1) and a top-3 contributing-feature list (Article 13 transparency).',
      training_data_summary:
        'Training corpus: 412,000 closed loans 2018–2023 across the four target jurisdictions. Excluded: bankruptcy cohort, customers with active fraud markers, applicants under 18 at origination.',
      version: '3.4.2'
    }
  },
  // Article 14 — human oversight
  {
    type: 'STRUCTURED_JSON',
    submitted_by: 'Konstantinos Doukas (Head of Consumer Credit)',
    source_system: 'oversight-control-system',
    observed_at: today(7),
    content: {
      claim_type: 'human_oversight',
      designated_role: 'Regional Credit Officer',
      stop_or_override_available: true,
      training_completed: true,
      monitoring_dashboards: ['Decision-distribution', 'Disparity-by-region', 'Disagreement-routing'],
      automation_bias_training_completed_at: today(120),
      automation_bias_training_in_period: true
    }
  },
  // Article 15 — accuracy / robustness / cybersecurity
  {
    type: 'STRUCTURED_JSON',
    submitted_by: 'Aikaterini Vlachou (Lead Data Scientist)',
    source_system: 'mlops-evaluation-pipeline',
    observed_at: today(14),
    content: {
      claim_type: 'accuracy_metric',
      accuracy: 0.962,
      test_dataset_size: 28_500,
      test_date: today(14)
    }
  },
  {
    type: 'STRUCTURED_JSON',
    submitted_by: 'Sofia Andreadis (Security Architect)',
    source_system: 'robustness-test-framework',
    observed_at: today(21),
    content: {
      claim_type: 'robustness_test_result',
      score: 0.93,
      test_type: 'adversarial-and-out-of-distribution',
      test_date: today(21)
    }
  },
  {
    type: 'STRUCTURED_JSON',
    submitted_by: 'Sofia Andreadis (Security Architect)',
    source_system: 'security-audit-system',
    observed_at: today(28),
    content: {
      claim_type: 'cybersecurity_audit',
      passed: true,
      audit_date: today(28),
      auditor: 'KPMG Greece — Financial Services Cyber Audit',
      findings: []
    }
  }
];

console.log('▸ Ingesting a HIGH-severity bias incident from earlier in the quarter...');
const earlyIncident = await http(
  'POST',
  '/v1/monitoring/signals',
  {
    system_version_id: sys.id,
    observed_at: today(45),
    signal_type: 'BIAS_OBSERVED',
    severity: 'HIGH',
    payload: {
      protected_attribute: 'age_under_25',
      disparity_ratio: 1.32,
      threshold: 1.25,
      affected_window: '2026-03-15 → 2026-03-22',
      remediation: 'Thin-file decisioning suspended for 48 hours; bureau-side patch applied 2026-03-23; model itself unchanged (no substantial modification under EU AI Act). Independent re-validation against 2026-Q1 data confirmed disparity returned to 1.18.',
      note: 'Threshold breach detected by routine fairness monitoring; root cause traced to a third-party credit-bureau outage that returned biased thin-file scores. Resolution did not require model retraining.'
    }
  },
  auth
);
console.log('▸ Reporting the incident to the supervisory authority (Article 73, 15-day clock)...');
await http('POST', `/v1/monitoring/signals/${earlyIncident.id}/report`, {}, auth);

const snap = await http(
  'POST',
  '/v1/evaluations',
  {
    system_version_id: sys.id,
    packs: ['art-5', 'art-9', 'art-10', 'art-13', 'art-14', 'art-15'],
    parameters: {},
    evidence
  },
  auth
);
console.log('  → final_status:', snap.final_status);
console.log('  → snapshot id:', snap.id);

console.log('▸ Operational telemetry since the snapshot...');
const postSnapshot = (offsetSeconds) =>
  new Date(new Date(snap.timestamp).getTime() + offsetSeconds * 1000).toISOString();
await http(
  'POST',
  '/v1/monitoring/signals',
  {
    system_version_id: sys.id,
    observed_at: postSnapshot(60),
    signal_type: 'PERFORMANCE_DRIFT',
    severity: 'LOW',
    payload: {
      metric: 'Gini',
      observed: 0.6,
      baseline: 0.62,
      window: 'rolling-30d',
      note: 'Minor degradation within tolerance band; no action required.'
    }
  },
  auth
);
await http(
  'POST',
  '/v1/monitoring/signals',
  {
    system_version_id: sys.id,
    observed_at: postSnapshot(180),
    signal_type: 'INPUT_DRIFT',
    severity: 'LOW',
    payload: {
      feature: 'months_since_first_credit',
      psi: 0.06,
      threshold: 0.10,
      note: 'Population shift, sub-threshold, will be folded into next quarterly re-evaluation.'
    }
  },
  auth
);

console.log('▸ Attaching signed manual attestations for ISO 42001 controls without automated rules...');
const attestations = [
  ['A.2.3', 'Alignment with other organizational policies',
    'AI Risk Policy v2.1 reviewed against the Group Operational Risk Policy (BAS-OP-2025-04) and Information Security Policy (BAS-IS-2025-09). No conflicts identified; alignment confirmed by Group Risk Committee 2026-02-12.',
    'risk-policy-2025-04.pdf'],
  ['A.3.3', 'Reporting of concerns',
    'Concerns about AI systems are reported via the Group Whistleblowing channel (BAS-WB-001) and a dedicated AI ethics inbox (ai-ethics@hellenic-atlantic.example). Annual disclosure included in the Audit Committee report.',
    'reporting-of-concerns-procedure-v3.pdf'],
  ['A.4.2', 'Resources for AI systems',
    '€2.4M annual budget allocated to AI Model Risk Management (Model Risk Office, 9 FTE). Three-year forward plan approved by the Board Risk Committee 2025-12-08.',
    'budget-mrm-2026.pdf'],
  ['A.4.3', 'Tooling resources',
    'Approved AI tooling stack: Databricks 14.x for training, MLflow 2.10 for experiment tracking, AegisAI for compliance binder, internal Robustness-Test-Framework 1.4 for adversarial validation. Inventory reviewed quarterly by the AI Platform Lead.',
    'ai-tooling-inventory-2026q2.pdf'],
  ['A.4.4', 'System and computing resources',
    'Production inference runs on a dedicated VPC in eu-west-1 (Frankfurt). Capacity reviewed monthly; current p99 latency 142ms, headroom 4×. DR failover validated 2026-04-15.',
    'capacity-review-2026q1.pdf'],
  ['A.4.6', 'Data resources',
    'Training, validation, and test datasets registered in the bank-wide Data Catalog (record IDs: ds-credit-train-2024Q4, ds-credit-val-2024Q4, ds-credit-test-2024Q4) with documented lineage, retention policy, and access controls.',
    'data-catalog-credit-models.pdf'],
  ['A.6.1.2', 'Objectives for responsible AI development',
    'Responsible-AI objectives codified in the AI Development Charter: (1) demographic parity within 1.25 ratio; (2) AUC ≥ 0.85 on holdout; (3) full Article 13 transparency to deployers; (4) no use of protected attributes as direct features. Reviewed annually.',
    'ai-development-charter-2026.pdf'],
  ['A.6.2.2', 'AI system requirements and specification',
    'Functional and non-functional requirements documented in PRD-CREDIT-AI-V3 (version 3.4.2). Requirements traced to test cases via Jira link; 100% coverage at last release sign-off.',
    'prd-credit-ai-v3.pdf'],
  ['A.6.2.3', 'Documentation of AI system design and development',
    'Design Document DD-CREDIT-V3 covers feature engineering, model architecture (gradient-boosted trees with 800 estimators), hyperparameter search space, and ensembling strategy. Reviewed and signed off by Head of Model Risk.',
    'design-doc-credit-v3.pdf'],
  ['A.6.2.5', 'AI system deployment',
    'Deployment runbook RB-DEPLOY-AI-001 covers CI/CD gates (unit tests, fairness gate, performance gate), blue/green rollout, and rollback procedure. Last rehearsed 2026-03-30.',
    'deploy-runbook-ai-001.pdf'],
  ['A.6.2.7', 'AI system technical documentation',
    'Annex IV technical documentation maintained in this AegisAI binder, supplemented by internal artefacts (PRD, Design Document, Validation Report, Bias Audit Report, Cybersecurity Audit). Aggregated dossier handed to Internal Audit quarterly.',
    'annex-iv-dossier-index.pdf'],
  ['A.6.2.8', 'AI system event logs',
    'All inference requests logged to immutable audit store (CloudWatch + S3 Object Lock, 7-year retention). Schema: request_id, model_version, input_hash, output, latency_ms, requester_id. Sampled review monthly by Internal Audit.',
    'event-log-schema-v4.pdf'],
  ['A.8.3', 'External reporting',
    'External reporting cadence: (1) annual AI Risk Disclosure in the bank Pillar 3 report; (2) ad-hoc supervisory communication via the ECB AnaCredit channel; (3) Article 73 incident reporting via the National Supervisory Authority portal (CY/EL/PT/IE).',
    'external-reporting-policy-v2.pdf'],
  ['A.8.4', 'Communication of incidents',
    'AI incidents are routed via the Group Incident Management Process (GIMP-AI). Severity HIGH/CRITICAL escalated to the CRO within 4 hours; supervisor notification within 15 days per Article 73. Incident BAS-INC-2026-031 (March 2026 bureau outage) closed with this process.',
    'gimp-ai-runbook-v3.pdf'],
  ['A.9.3', 'Objectives for responsible use of AI systems',
    'Responsible-use objectives for credit decisioning: (1) no decisions without human-officer review for declines under 25; (2) every adverse decision accompanied by GDPR Article 22 explanation; (3) appeals path documented in the customer T&Cs.',
    'responsible-use-objectives-credit.pdf'],
  ['A.10.2', 'Allocating responsibilities for AI third parties',
    'RACI matrix for third-party AI components: bureau data provider (Provider, accountable for SLA + bias monitoring), cloud provider (Operator, infrastructure SLA), AegisAI (Compliance attestation tool). Reviewed at vendor onboarding and annually.',
    'third-party-raci-2026.pdf'],
  ['A.10.3', 'Suppliers',
    'Active AI suppliers (3): credit bureau (Experian Greece, contract BAS-EXP-2024-12), cloud (AWS Frankfurt, BAS-AWS-2023-04), AegisAI (BAS-AGS-2026-01). Each contract includes data-protection addendum, audit-right clause, and 90-day exit plan.',
    'supplier-register-ai-2026.pdf'],
  ['A.10.4', 'Customers',
    'Customer-facing communication of AI use complies with the Bank Customer Agreement v8 (clauses 14.3–14.7) and the GDPR Article 22 disclosure standard. Plain-language explanation provided with every adverse credit decision.',
    'customer-disclosure-credit-ai-v8.pdf']
];
for (const [controlId, _name, attestation, doc] of attestations) {
  await http(
    'POST',
    `/v1/systems/${sys.id}/attestations`,
    {
      control_id: controlId,
      framework: 'ISO_42001',
      attestation,
      attested_by: 'cco@hellenic-atlantic.example',
      document_ref: doc
    },
    auth
  );
}
console.log(`  → ${attestations.length} attestations on file.`);

console.log('▸ Verifying snapshot signature...');
const verify = await http('GET', `/v1/snapshots/${snap.id}/verify`, undefined, auth);
console.log('  → signature valid:', verify.ok);

console.log('▸ Rendering Annex IV binder...');
const html = await http('GET', `/v1/binders/${snap.id}`, undefined, auth);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html, 'utf-8');
console.log(`\n✅ Demo binder written to: ${OUT}`);
console.log(`   Open in a browser, then Cmd-P → "Save as PDF" for your sales asset.`);
console.log(`   Verifying public key (for the binder's signature) is on the org record.\n`);

await server.close();
if (existsSync(DB)) unlinkSync(DB);
