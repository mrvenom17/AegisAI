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
          'Shadow-mode review of all decline decisions for under-25 applicants by a credit officer for the first 90 days post-deployment.',
        responsible_role: 'Head of Consumer Credit',
        review_cadence: 'Weekly during shadow window, monthly thereafter'
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
  // Article 13 — instructions for use
  {
    type: 'STRUCTURED_JSON',
    submitted_by: 'Maria Papadakis (Chief Compliance Officer)',
    source_system: 'documentation-system',
    observed_at: today(30),
    content: {
      claim_type: 'instructions_for_use',
      provider_identity: 'Hellenic Atlantic Bank S.A. — Model Risk Office',
      intended_purpose: 'Consumer credit decisioning for personal loans in Greece, Cyprus, Portugal, Ireland',
      performance_characteristics:
        'Population-level Gini 0.62, AUC 0.89, calibration slope 1.03 ± 0.04',
      known_limitations:
        'Reduced accuracy for thin-file applicants (<6 months credit history). Not suitable for SME lending or mortgage decisioning.',
      expected_lifetime: '24 months from deployment date, with quarterly recalibration',
      human_oversight_measures:
        'Credit officer review for declines under 25, high-disagreement routing, monthly bias review',
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

console.log('▸ Ingesting a couple of post-market monitoring signals...');
await http(
  'POST',
  '/v1/monitoring/signals',
  {
    system_version_id: sys.id,
    observed_at: today(3),
    signal_type: 'PERFORMANCE_DRIFT',
    severity: 'LOW',
    payload: {
      metric: 'Gini',
      observed: 0.6,
      baseline: 0.62,
      window: 'rolling-30d',
      note: 'Minor degradation, within tolerance'
    }
  },
  auth
);
await http(
  'POST',
  '/v1/monitoring/signals',
  {
    system_version_id: sys.id,
    observed_at: today(1),
    signal_type: 'BIAS_OBSERVED',
    severity: 'MEDIUM',
    payload: {
      protected_attribute: 'age_under_25',
      disparity_ratio: 1.21,
      threshold: 1.25,
      note: 'Approaching threshold, flagged for committee review'
    }
  },
  auth
);

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
