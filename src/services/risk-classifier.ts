/**
 * Annex III Risk Classifier (EU AI Act Articles 5–7, Annex III).
 *
 * Decision tree:
 *   1. Article 5 prohibited practices -> PROHIBITED
 *   2. Annex III high-risk categories -> HIGH_RISK
 *   3. GPAI (Article 51) -> GPAI
 *   4. Article 50 transparency-only obligations -> LIMITED_RISK
 *   5. Otherwise -> MINIMAL_RISK
 *
 * Output is a signed RiskClassification that becomes part of the
 * conformity binder.
 */

import { z } from 'zod';
import {
  RiskClassification,
  RiskClassificationSchema,
  RiskTier
} from '../domain/types.js';
import { signBytes, canonicalize } from '../utils/crypto.js';
import { deterministicUUID } from '../utils/uuid.js';

export const QuestionnaireSchema = z.object({
  // Article 5 prohibited
  uses_subliminal_techniques: z.boolean(),
  exploits_vulnerabilities: z.boolean(),
  social_scoring_by_public_authority: z.boolean(),
  predictive_policing_individual: z.boolean(),
  untargeted_facial_scraping: z.boolean(),
  emotion_recognition_workplace_or_education: z.boolean(),
  biometric_categorisation_sensitive_attributes: z.boolean(),
  real_time_remote_biometric_id_public_law_enforcement: z.boolean(),

  // Annex III categories
  biometrics_post_remote_or_categorisation: z.boolean(),
  critical_infrastructure_safety_component: z.boolean(),
  education_or_vocational_training_decisions: z.boolean(),
  employment_recruitment_or_management: z.boolean(),
  essential_private_or_public_services: z.boolean(),
  creditworthiness_or_credit_scoring: z.boolean(),
  life_or_health_insurance_pricing: z.boolean(),
  emergency_response_dispatch: z.boolean(),
  law_enforcement_use: z.boolean(),
  migration_asylum_border_control: z.boolean(),
  administration_of_justice_or_democratic_processes: z.boolean(),

  // GPAI / transparency
  is_general_purpose_ai_model: z.boolean(),
  generates_synthetic_content_or_deepfakes: z.boolean(),
  interacts_directly_with_natural_persons: z.boolean(),

  // Article 6(3) override — high-risk by default unless deployer
  // demonstrates the system is purely accessory and does not influence
  // the decision outcome.
  performs_only_narrow_procedural_task: z.boolean().default(false),
  improves_result_of_previously_completed_human_activity: z.boolean().default(false),
  detects_decision_patterns_without_replacing_human: z.boolean().default(false),
  preparatory_task_only: z.boolean().default(false)
});

export type Questionnaire = z.infer<typeof QuestionnaireSchema>;

export interface ClassifyArgs {
  orgId: string;
  systemVersionRef: string;
  questionnaire: unknown;
  signingPrivateKeyPem: string;
}

interface RationaleEntry {
  annex_iii_clause?: string;
  article?: string;
  matched: boolean;
  explanation: string;
}

export class RiskClassifier {
  classify(args: ClassifyArgs): RiskClassification {
    const q = QuestionnaireSchema.parse(args.questionnaire);
    const rationale: RationaleEntry[] = [];

    // 1. Article 5 prohibited practices
    const art5 = checkArticle5(q, rationale);
    if (art5) {
      return this.signedClassification(args, q, 'PROHIBITED', rationale);
    }

    // 2. Annex III high-risk
    const isAnnexIII = checkAnnexIII(q, rationale);
    if (isAnnexIII) {
      const accessoryOverride =
        q.performs_only_narrow_procedural_task ||
        q.improves_result_of_previously_completed_human_activity ||
        q.detects_decision_patterns_without_replacing_human ||
        q.preparatory_task_only;
      if (accessoryOverride) {
        rationale.push({
          article: 'Article 6(3)',
          matched: true,
          explanation:
            'Annex III category matched, but Article 6(3) accessory-task ' +
            'override has been claimed. This MUST be documented and substantiated ' +
            'by the deployer; if challenged, the system reverts to HIGH_RISK.'
        });
        return this.signedClassification(args, q, 'LIMITED_RISK', rationale);
      }
      return this.signedClassification(args, q, 'HIGH_RISK', rationale);
    }

    // 3. GPAI
    if (q.is_general_purpose_ai_model) {
      rationale.push({
        article: 'Article 51',
        matched: true,
        explanation: 'General-purpose AI model — Chapter V obligations apply.'
      });
      return this.signedClassification(args, q, 'GPAI', rationale);
    }

    // 4. Article 50 transparency-only
    if (
      q.generates_synthetic_content_or_deepfakes ||
      q.interacts_directly_with_natural_persons
    ) {
      rationale.push({
        article: 'Article 50',
        matched: true,
        explanation:
          'Transparency obligations apply (Article 50). Not high-risk by default, ' +
          'but disclosure to natural persons / labelling of synthetic content required.'
      });
      return this.signedClassification(args, q, 'LIMITED_RISK', rationale);
    }

    // 5. Otherwise minimal risk
    rationale.push({
      matched: false,
      explanation:
        'No Article 5, Annex III, or transparency obligation matched. ' +
        'Voluntary codes of conduct (Article 95) recommended.'
    });
    return this.signedClassification(args, q, 'MINIMAL_RISK', rationale);
  }

  private signedClassification(
    args: ClassifyArgs,
    q: Questionnaire,
    tier: RiskTier,
    rationale: RationaleEntry[]
  ): RiskClassification {
    const classifiedAt = new Date().toISOString();
    const id = deterministicUUID(
      canonicalize({
        org_id: args.orgId,
        system_version_ref: args.systemVersionRef,
        questionnaire: q,
        tier,
        classified_at: classifiedAt
      })
    );
    const unsigned = {
      id,
      org_id: args.orgId,
      system_version_ref: args.systemVersionRef,
      tier,
      rationale,
      questionnaire: q,
      classified_at: classifiedAt
    };
    const signature = signBytes(canonicalize(unsigned), args.signingPrivateKeyPem);
    return Object.freeze(
      RiskClassificationSchema.parse({ ...unsigned, signature })
    );
  }
}

function checkArticle5(q: Questionnaire, out: RationaleEntry[]): boolean {
  const matches: Array<[keyof Questionnaire, string]> = [
    ['uses_subliminal_techniques', 'Article 5(1)(a) — subliminal techniques beyond consciousness'],
    ['exploits_vulnerabilities', 'Article 5(1)(b) — exploitation of vulnerabilities'],
    ['social_scoring_by_public_authority', 'Article 5(1)(c) — social scoring'],
    ['predictive_policing_individual', 'Article 5(1)(d) — individual predictive policing'],
    ['untargeted_facial_scraping', 'Article 5(1)(e) — untargeted facial image scraping'],
    [
      'emotion_recognition_workplace_or_education',
      'Article 5(1)(f) — emotion recognition in workplace/education'
    ],
    [
      'biometric_categorisation_sensitive_attributes',
      'Article 5(1)(g) — biometric categorisation by sensitive attributes'
    ],
    [
      'real_time_remote_biometric_id_public_law_enforcement',
      'Article 5(1)(h) — real-time remote biometric ID in public spaces for law enforcement'
    ]
  ];
  let any = false;
  for (const [key, desc] of matches) {
    if (q[key] === true) {
      out.push({ article: desc.split(' ')[0] + ' ' + desc.split(' ')[1], matched: true, explanation: desc });
      any = true;
    }
  }
  return any;
}

function checkAnnexIII(q: Questionnaire, out: RationaleEntry[]): boolean {
  const matches: Array<[keyof Questionnaire, string, string]> = [
    ['biometrics_post_remote_or_categorisation', 'Annex III §1', 'Biometrics (post-remote ID, categorisation, emotion recognition)'],
    ['critical_infrastructure_safety_component', 'Annex III §2', 'Critical infrastructure safety component'],
    ['education_or_vocational_training_decisions', 'Annex III §3', 'Education / vocational training decisions'],
    ['employment_recruitment_or_management', 'Annex III §4', 'Employment, worker management, recruitment'],
    ['essential_private_or_public_services', 'Annex III §5(a)', 'Essential private/public services'],
    ['creditworthiness_or_credit_scoring', 'Annex III §5(b)', 'Creditworthiness / credit scoring'],
    ['life_or_health_insurance_pricing', 'Annex III §5(c)', 'Life/health insurance risk assessment & pricing'],
    ['emergency_response_dispatch', 'Annex III §5(d)', 'Emergency response dispatch / triage'],
    ['law_enforcement_use', 'Annex III §6', 'Law enforcement'],
    ['migration_asylum_border_control', 'Annex III §7', 'Migration, asylum, border control'],
    ['administration_of_justice_or_democratic_processes', 'Annex III §8', 'Administration of justice / democratic processes']
  ];
  let any = false;
  for (const [key, clause, desc] of matches) {
    if (q[key] === true) {
      out.push({ annex_iii_clause: clause, matched: true, explanation: desc });
      any = true;
    }
  }
  return any;
}
