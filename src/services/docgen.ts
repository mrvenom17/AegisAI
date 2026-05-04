/**
 * Annex IV technical documentation generator.
 *
 * Produces an HTML document organised against the structure laid out in
 * EU AI Act Annex IV (1)–(9), pulling content from a ComplianceSnapshot,
 * the Risk Classification, the FRIA (if any), the ISO 42001 coverage map,
 * and recent monitoring signals.
 *
 * Output is print-to-PDF ready: minimal CSS, no external assets, no JS.
 */

import {
  ComplianceSnapshot,
  RiskClassification,
  FRIA,
  MonitoringSignal,
  PolicySet,
  SystemVersion
} from '../domain/types.js';
import { ControlCoverage } from './iso-42001-mapper.js';

export interface ConformityBinderInput {
  system: SystemVersion;
  classification: RiskClassification;
  snapshot: ComplianceSnapshot;
  policySets: PolicySet[];
  fria?: FRIA;
  isoCoverage: ControlCoverage[];
  recentSignals: MonitoringSignal[];
  generatedAt?: string;
}

export class DocGen {
  generateAnnexIV(input: ConformityBinderInput): string {
    const generatedAt = input.generatedAt ?? new Date().toISOString();
    const s = input.snapshot;

    const sections = [
      this.section1(input.system, input.classification),
      this.section2(input.system, input.classification),
      this.section3(s, input.policySets),
      this.section4(s),
      this.section5(input.fria),
      this.section6(s),
      this.section7(s),
      this.section8(input.recentSignals),
      this.section9(input.isoCoverage),
      this.sectionVerification(s)
    ].join('\n');

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Annex IV Technical Documentation — ${esc(input.system.system_id)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
         color: #111; max-width: 920px; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
  h1 { font-size: 1.6rem; border-bottom: 2px solid #111; padding-bottom: 0.5rem; }
  h2 { font-size: 1.25rem; margin-top: 2rem; border-bottom: 1px solid #ccc; padding-bottom: 0.25rem; }
  h3 { font-size: 1rem; margin-top: 1rem; }
  table { border-collapse: collapse; width: 100%; margin: 0.5rem 0; }
  th, td { border: 1px solid #ddd; padding: 0.4rem 0.6rem; text-align: left; vertical-align: top; font-size: 0.92rem; }
  th { background: #f5f5f5; }
  .pass { color: #1b5e20; font-weight: 600; }
  .fail { color: #b71c1c; font-weight: 600; }
  .partial { color: #e65100; font-weight: 600; }
  .meta { font-size: 0.85rem; color: #555; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.85em; }
  .stamp { font-family: ui-monospace, monospace; word-break: break-all; font-size: 0.8rem; }
  .pill { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 0.4rem; font-size: 0.85rem; }
  .pill-prohibited { background: #ffebee; color: #b71c1c; }
  .pill-high { background: #fff3e0; color: #e65100; }
  .pill-limited { background: #fff8e1; color: #f57f17; }
  .pill-minimal { background: #e8f5e9; color: #1b5e20; }
  .pill-gpai { background: #e3f2fd; color: #0d47a1; }
  .pill-unclassified { background: #eceff1; color: #455a64; }
  @media print {
    body { margin: 1cm; }
    h2 { page-break-after: avoid; }
    table { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<header>
  <h1>EU AI Act Annex IV — Technical Documentation</h1>
  <p class="meta">Generated ${esc(generatedAt)} · Snapshot ID <code>${esc(s.id)}</code></p>
  <p class="meta">This document is generated deterministically from a signed ComplianceSnapshot. Tampering will invalidate the cryptographic signature recorded in §10.</p>
</header>
${sections}
</body>
</html>`;
  }

  private section1(sys: SystemVersion, cls: RiskClassification): string {
    return `<h2>1. General description</h2>
<table>
  <tr><th>System ID</th><td>${esc(sys.system_id)}</td></tr>
  <tr><th>System version</th><td>${esc(sys.version)}</td></tr>
  <tr><th>Model</th><td>${esc(sys.model_name)} @ ${esc(sys.model_version)}</td></tr>
  <tr><th>Intended purpose</th><td>${esc(sys.intended_purpose)}</td></tr>
  <tr><th>Risk tier</th><td>${riskPill(cls.tier)}</td></tr>
  <tr><th>Deployment</th><td>${esc(sys.deployment_context.environment)} · ${esc(sys.deployment_context.region)} · since ${esc(sys.deployment_context.deployment_date)}</td></tr>
</table>`;
  }

  private section2(_sys: SystemVersion, cls: RiskClassification): string {
    const rows = cls.rationale
      .map(
        (r) => `<tr>
      <td>${esc(r.annex_iii_clause ?? r.article ?? '')}</td>
      <td>${r.matched ? '✓' : '—'}</td>
      <td>${esc(r.explanation)}</td>
    </tr>`
      )
      .join('');
    return `<h2>2. Risk classification (Article 6 / Annex III)</h2>
<table>
  <thead><tr><th>Reference</th><th>Match</th><th>Rationale</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<p class="meta">Classification ID <code>${esc(cls.id)}</code>, classified at ${esc(cls.classified_at)}.</p>`;
  }

  private section3(s: ComplianceSnapshot, policySets: PolicySet[]): string {
    const psList = policySets
      .map((p) => `<li>${esc(p.metadata.name)} (v${esc(p.version)})</li>`)
      .join('');
    return `<h2>3. Detailed description of system elements and processes</h2>
<p>Compliance evaluation executed against the following policy sets:</p>
<ul>${psList}</ul>
<p>Final status: <strong class="${s.final_status === 'COMPLIANT' ? 'pass' : 'fail'}">${esc(s.final_status)}</strong></p>`;
  }

  private section4(s: ComplianceSnapshot): string {
    const rows = s.rule_evaluations
      .map(
        (r) => `<tr>
      <td>${esc(r.obligation_id)}</td>
      <td>${esc(r.control_id)}</td>
      <td>${esc(r.rule_id)}</td>
      <td class="${r.passed ? 'pass' : 'fail'}">${r.passed ? 'PASS' : 'FAIL'}</td>
      <td>${esc(r.failure_mode)}</td>
      <td>${r.evidence_claim_refs.length}</td>
    </tr>`
      )
      .join('');
    return `<h2>4. Monitoring, functioning and control specifications — rule evaluations</h2>
<table>
  <thead><tr><th>Obligation</th><th>Control</th><th>Rule</th><th>Outcome</th><th>Failure mode</th><th>Claims</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
  }

  private section5(fria?: FRIA): string {
    if (!fria) {
      return `<h2>5. Risk management system &amp; FRIA</h2>
<p class="meta">No FRIA on file for this system version. If this system is high-risk and the deployer is a public authority or essential-services provider, Article 27 requires a FRIA.</p>`;
    }
    const risks = fria.risks_identified
      .map(
        (r) => `<tr>
        <td>${esc(r.risk)}</td>
        <td>${esc(r.likelihood)}</td>
        <td>${esc(r.severity)}</td>
        <td>${r.affected_rights.map(esc).join(', ')}</td>
      </tr>`
      )
      .join('');
    return `<h2>5. Risk management system &amp; FRIA</h2>
<p>FRIA <code>${esc(fria.id)}</code> · Status <strong>${esc(fria.status)}</strong> · Deployer ${esc(fria.deployer_organization)}</p>
<h3>Risks identified</h3>
<table><thead><tr><th>Risk</th><th>Likelihood</th><th>Severity</th><th>Affected rights</th></tr></thead><tbody>${risks}</tbody></table>
<h3>Mitigations</h3>
<ul>${fria.mitigations.map((m) => `<li>${esc(m.mitigation)} — owner: ${esc(m.responsible_role)}, review: ${esc(m.review_cadence)}</li>`).join('')}</ul>
<h3>Human oversight measures</h3>
<ul>${fria.human_oversight_measures.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>`;
  }

  private section6(s: ComplianceSnapshot): string {
    if (s.warnings.length === 0) {
      return `<h2>6. Testing procedures &amp; warnings</h2><p>No warnings recorded.</p>`;
    }
    const rows = s.warnings
      .map(
        (w) => `<tr>
      <td>${esc(w.type)}</td>
      <td>${esc(w.obligation_id)}</td>
      <td>${esc(w.severity)}</td>
      <td>${esc(w.message)}</td>
    </tr>`
      )
      .join('');
    return `<h2>6. Testing procedures &amp; warnings</h2>
<table><thead><tr><th>Type</th><th>Obligation</th><th>Severity</th><th>Message</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  private section7(s: ComplianceSnapshot): string {
    return `<h2>7. Instructions for use</h2>
<p>Instructions for use are documented under EU AI Act Article 13 obligations evaluated above. The provider supplies them as Article 13 evidence; this section reproduces the version of record at evaluation time.</p>
<p class="meta">Snapshot timestamp ${esc(s.timestamp)}.</p>`;
  }

  private section8(signals: MonitoringSignal[]): string {
    if (signals.length === 0) {
      return `<h2>8. Post-market monitoring (Article 72)</h2><p>No monitoring signals received in the reporting window.</p>`;
    }
    const rows = signals
      .slice(0, 50)
      .map(
        (sig) => `<tr>
      <td>${esc(sig.observed_at)}</td>
      <td>${esc(sig.signal_type)}</td>
      <td>${esc(sig.severity)}</td>
      <td>${sig.reported_to_authority ? '✓' : '—'}</td>
    </tr>`
      )
      .join('');
    return `<h2>8. Post-market monitoring (Article 72)</h2>
<table><thead><tr><th>Observed at</th><th>Type</th><th>Severity</th><th>Reported</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  private section9(coverage: ControlCoverage[]): string {
    const rows = coverage
      .map(
        (c) => `<tr>
      <td><code>${esc(c.control_id)}</code></td>
      <td>${esc(c.control_name)}</td>
      <td class="${c.status === 'PASS' ? 'pass' : c.status === 'FAIL' ? 'fail' : 'partial'}">${esc(c.status)}</td>
      <td>${c.rules.length}</td>
    </tr>`
      )
      .join('');
    return `<h2>9. ISO/IEC 42001:2023 control coverage</h2>
<table><thead><tr><th>Control</th><th>Name</th><th>Status</th><th>Rules</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  private sectionVerification(s: ComplianceSnapshot): string {
    return `<h2>10. Cryptographic verification</h2>
<table>
  <tr><th>Snapshot ID</th><td class="stamp">${esc(s.id)}</td></tr>
  <tr><th>Signing key ID</th><td class="stamp">${esc(s.signing_key_id)}</td></tr>
  <tr><th>Evidence Merkle root</th><td class="stamp">${esc(s.evidence_merkle_root)}</td></tr>
  <tr><th>Parameter set hash</th><td class="stamp">${esc(s.parameter_set_hash)}</td></tr>
  <tr><th>Signature</th><td class="stamp">${esc(s.signature)}</td></tr>
</table>`;
  }
}

function esc(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function riskPill(tier: string): string {
  const cls =
    tier === 'PROHIBITED'
      ? 'pill-prohibited'
      : tier === 'HIGH_RISK'
        ? 'pill-high'
        : tier === 'LIMITED_RISK'
          ? 'pill-limited'
          : tier === 'GPAI'
            ? 'pill-gpai'
            : tier === 'MINIMAL_RISK'
              ? 'pill-minimal'
              : 'pill-unclassified';
  return `<span class="pill ${cls}">${esc(tier)}</span>`;
}
