/**
 * Annex IV technical documentation generator.
 *
 * Produces a regulator-grade HTML document organised against EU AI Act Annex IV.
 * Critically: this is NOT just a manifest of "rule X passed". It renders the
 * substantive evidence values, expired mitigations, open critical alerts at
 * snapshot time, and an actionable remediation list — anything an auditor or
 * Notified Body would expect to see.
 */

import {
  ComplianceSnapshot,
  RiskClassification,
  FRIA,
  MonitoringSignal,
  PolicySet,
  SystemVersion,
  RuleResult,
  ManualAttestation
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
  attestations?: ManualAttestation[];
  generatedAt?: string;
}

type MitigationStatus = 'ACTIVE' | 'EXPIRED' | 'OVERDUE' | 'INDEFINITE';

interface DisplayStatus {
  effective:
    | 'COMPLIANT'
    | 'COMPLIANT_WITH_WARNINGS'
    | 'CONDITIONAL'
    | 'INCOMPLETE_DOSSIER'
    | 'NON_COMPLIANT'
    | 'NON_COMPLIANT_BLOCKING';
  cssClass: 'pass' | 'partial' | 'fail';
  banner?: string;
}

export class DocGen {
  generateAnnexIV(input: ConformityBinderInput): string {
    const generatedAt = input.generatedAt ?? new Date().toISOString();
    const s = input.snapshot;

    const preSnapshotSignals = input.recentSignals
      .filter((sig) => sig.observed_at <= s.timestamp)
      .sort((a, b) => b.observed_at.localeCompare(a.observed_at));
    const postSnapshotSignals = input.recentSignals
      .filter((sig) => sig.observed_at > s.timestamp)
      .sort((a, b) => b.observed_at.localeCompare(a.observed_at));

    const display = computeDisplayStatus(s, preSnapshotSignals, input.isoCoverage);

    const sections = [
      this.section1(input.system, input.classification, display),
      this.section2(input.system, input.classification),
      this.section3(s, input.policySets, display),
      this.section4(s),
      this.section5(s, input.fria),
      this.section6(s, preSnapshotSignals),
      this.section7(s),
      this.section8(s, preSnapshotSignals, postSnapshotSignals),
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
  h4 { font-size: 0.95rem; margin: 0.75rem 0 0.25rem; color: #333; }
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
  .banner { padding: 0.75rem 1rem; border-radius: 0.4rem; margin: 0.75rem 0; border: 1px solid; font-size: 0.92rem; }
  .banner-warn { background: #fff8e1; border-color: #f9a825; color: #6a4e00; }
  .banner-error { background: #ffebee; border-color: #c62828; color: #861818; }
  .banner-info { background: #e3f2fd; border-color: #1565c0; color: #0d3a73; }
  .small { font-size: 0.85rem; }
  ul.remediation { margin: 0.25rem 0 0.75rem 1.25rem; padding: 0; }
  ul.remediation li { margin: 0.15rem 0; font-size: 0.9rem; }
  .ev { margin-bottom: 0.5rem; }
  .ev-head { font-weight: 600; font-size: 0.88rem; }
  .ev-prov { font-size: 0.8rem; color: #555; margin-bottom: 0.2rem; }
  ul.kv { margin: 0.15rem 0 0.25rem 1rem; padding: 0; list-style: none; }
  ul.kv li { font-size: 0.85rem; margin: 0.05rem 0; word-break: break-word; }
  ul.kv li strong { display: inline-block; min-width: 11rem; color: #333; }
  .att-block { background: #f3f8ff; border-left: 3px solid #1565c0; padding: 0.4rem 0.6rem; margin: 0.4rem 0; }
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
  ${display.banner ?? ''}
</header>
${sections}
</body>
</html>`;
  }

  private section1(sys: SystemVersion, cls: RiskClassification, display: DisplayStatus): string {
    return `<h2>1. General description</h2>
<table>
  <tr><th>System ID</th><td>${esc(sys.system_id)}</td></tr>
  <tr><th>System version</th><td>${esc(sys.version)}</td></tr>
  <tr><th>Model</th><td>${esc(sys.model_name)} @ ${esc(sys.model_version)}</td></tr>
  <tr><th>Intended purpose</th><td>${esc(sys.intended_purpose)}</td></tr>
  <tr><th>Risk tier</th><td>${riskPill(cls.tier)}</td></tr>
  <tr><th>Effective conformity status</th><td><strong class="${display.cssClass}">${esc(display.effective)}</strong></td></tr>
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

  private section3(s: ComplianceSnapshot, policySets: PolicySet[], display: DisplayStatus): string {
    const psList = policySets
      .map((p) => `<li>${esc(p.metadata.name)} (v${esc(p.version)})</li>`)
      .join('');
    const explanatory = s.final_status === display.effective
      ? ''
      : `<p class="meta">The <em>recorded snapshot status</em> is <strong>${esc(s.final_status)}</strong>. The <em>effective status</em> on the cover page is downgraded because of unreported critical alerts (§8) and/or ISO 42001 controls without signed manual attestations (§9).</p>`;
    return `<h2>3. Detailed description of system elements and processes</h2>
<p>Compliance evaluation executed against the following policy sets:</p>
<ul>${psList}</ul>
<p>Recorded snapshot status: <strong class="${s.final_status === 'COMPLIANT' ? 'pass' : 'fail'}">${esc(s.final_status)}</strong></p>
${explanatory}`;
  }

  private section4(s: ComplianceSnapshot): string {
    const rows = s.rule_evaluations
      .map((r) => this.renderRuleRow(r))
      .join('');
    return `<h2>4. Monitoring, functioning and control specifications — rule evaluations</h2>
<p class="meta">Each row shows the rule outcome and the substantive evidence values that drove it. The full claim payloads are bound by the Evidence Merkle root in §10.</p>
<table>
  <thead><tr><th>Obligation</th><th>Control</th><th>Rule</th><th>Outcome</th><th>Failure mode</th><th>Evidence summary</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
  }

  private renderRuleRow(r: RuleResult): string {
    const claims = r.verified_claims_used ?? [];
    const evidence = claims.length === 0
      ? `<span class="meta">No claims attached.</span>`
      : claims.map((c) => this.renderClaim(c)).join('');
    const reason = !r.passed && typeof r.logic_result === 'string'
      ? `<div class="small partial">Reason: ${esc(r.logic_result)}</div>`
      : '';
    return `<tr>
      <td>${esc(r.obligation_id)}</td>
      <td>${esc(r.control_id)}</td>
      <td>${esc(r.rule_id)}</td>
      <td class="${r.passed ? 'pass' : 'fail'}">${r.passed ? 'PASS' : 'FAIL'}</td>
      <td>${esc(r.failure_mode)}</td>
      <td>${evidence}${reason}</td>
    </tr>`;
  }

  private renderClaim(c: NonNullable<RuleResult['verified_claims_used']>[number]): string {
    const provenance = [
      c.submitted_by ? `submitted by ${esc(c.submitted_by)}` : '',
      c.source_system ? `from <code>${esc(c.source_system)}</code>` : '',
      c.observed_at ? `observed ${esc(c.observed_at)}` : ''
    ].filter(Boolean).join(' · ');
    const verbose = c.claim_type === 'instructions_for_use';
    const summaryFields = verbose
      ? ['provider_identity', 'performance_characteristics', 'expected_lifetime', 'version']
      : null;
    const items = Object.entries(c.claim_data)
      .filter(([k]) => k !== 'claim_type')
      .filter(([k]) => !summaryFields || summaryFields.includes(k))
      .slice(0, 12)
      .map(([k, v]) => `<li><strong>${esc(humanize(k))}:</strong> ${esc(truncate(formatValue(v), 240))}</li>`)
      .join('');
    const fullRef = verbose
      ? `<li class="meta">Full Article 13 instructions reproduced verbatim in §7.</li>`
      : '';
    return `<div class="ev">
        <div class="ev-head">${esc(c.claim_type)}</div>
        ${provenance ? `<div class="ev-prov">${provenance}</div>` : ''}
        <ul class="kv">${items}${fullRef}</ul>
      </div>`;
  }

  private section5(s: ComplianceSnapshot, fria?: FRIA): string {
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

    const mitigationsWithStatus = fria.mitigations.map((m) => ({
      m,
      status: computeMitigationStatus(m, s.timestamp)
    }));
    const expired = mitigationsWithStatus.filter((x) => x.status !== 'ACTIVE' && x.status !== 'INDEFINITE');
    const expiredBanner = expired.length === 0
      ? ''
      : `<div class="banner banner-error">
          <strong>${expired.length} mitigation(s) expired or overdue at snapshot time.</strong>
          The FRIA approval record relies on these mitigations being in force; remediation is required before this binder is treated as current.
        </div>`;

    const mitItems = mitigationsWithStatus.map(({ m, status }) => {
      const window = mitigationWindowText(m, status);
      const cls = status === 'ACTIVE' || status === 'INDEFINITE' ? 'pass' : 'fail';
      return `<li>${esc(m.mitigation)} — owner: ${esc(m.responsible_role)}, review: ${esc(m.review_cadence)}<br><span class="${cls} small">[${status}]</span> <span class="meta">${window}</span></li>`;
    }).join('');

    return `<h2>5. Risk management system &amp; FRIA</h2>
<p>FRIA <code>${esc(fria.id)}</code> · Status <strong>${esc(fria.status)}</strong> · Deployer ${esc(fria.deployer_organization)}</p>
${expiredBanner}
<h3>Risks identified</h3>
<table><thead><tr><th>Risk</th><th>Likelihood</th><th>Severity</th><th>Affected rights</th></tr></thead><tbody>${risks}</tbody></table>
<h3>Mitigations</h3>
<ul>${mitItems}</ul>
<h3>Human oversight measures</h3>
<ul>${fria.human_oversight_measures.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>`;
  }

  private section6(s: ComplianceSnapshot, preSignals: MonitoringSignal[]): string {
    const openCritical = preSignals.filter(
      (sig) => (sig.severity === 'HIGH' || sig.severity === 'CRITICAL') && !sig.reported_to_authority
    );
    const blocks: string[] = [];
    if (s.warnings.length > 0) {
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
      blocks.push(`<table><thead><tr><th>Type</th><th>Obligation</th><th>Severity</th><th>Message</th></tr></thead><tbody>${rows}</tbody></table>`);
    } else {
      blocks.push(`<p class="meta">No engine warnings recorded at evaluation time.</p>`);
    }
    if (openCritical.length > 0) {
      const list = openCritical.map((sig) => `<li>${esc(sig.observed_at)} — ${esc(sig.signal_type)} (${esc(sig.severity)}): ${esc(JSON.stringify(sig.payload))}</li>`).join('');
      blocks.push(`<div class="banner banner-error"><strong>${openCritical.length} unreported HIGH/CRITICAL alert(s) at evaluation time.</strong>
        Article 73 requires serious-incident reporting within 15 days. Until reported, the effective conformity status is CONDITIONAL.
        <ul>${list}</ul>
      </div>`);
    }
    return `<h2>6. Testing procedures &amp; warnings</h2>
${blocks.join('\n')}`;
  }

  private section7(s: ComplianceSnapshot): string {
    const ifuClaim = findClaim(s, 'instructions_for_use');
    if (!ifuClaim) {
      return `<h2>7. Instructions for use (Article 13)</h2>
<div class="banner banner-error"><strong>MISSING — Article 13 Instructions for Use are not present in the evidence bundle.</strong>
This binder cannot satisfy Article 13 until the deployer submits an <code>instructions_for_use</code> claim with provider identity, intended purpose, performance characteristics, known limitations, expected lifetime, and human oversight measures.</div>`;
    }
    const data = ifuClaim.claim_data as Record<string, unknown>;
    const fieldOrder = [
      'provider_identity',
      'intended_purpose',
      'performance_characteristics',
      'known_limitations',
      'expected_lifetime',
      'human_oversight_measures',
      'version'
    ];
    const rows = fieldOrder
      .filter((k) => data[k] !== undefined)
      .map((k) => `<tr><th>${esc(humanize(k))}</th><td>${esc(formatValue(data[k]))}</td></tr>`)
      .join('');
    const extras = Object.keys(data)
      .filter((k) => !fieldOrder.includes(k) && k !== 'claim_type')
      .map((k) => `<tr><th>${esc(humanize(k))}</th><td>${esc(formatValue(data[k]))}</td></tr>`)
      .join('');
    return `<h2>7. Instructions for use (Article 13)</h2>
<p class="meta">Reproduced from the <code>instructions_for_use</code> evidence claim of record at evaluation time (${esc(ifuClaim.observed_at ?? s.timestamp)}).</p>
<table>${rows}${extras}</table>`;
  }

  private section8(
    s: ComplianceSnapshot,
    preSignals: MonitoringSignal[],
    postSignals: MonitoringSignal[]
  ): string {
    const rowsFor = (signals: MonitoringSignal[]) => signals
      .slice(0, 50)
      .map(
        (sig) => `<tr>
      <td>${esc(sig.observed_at)}</td>
      <td>${esc(sig.signal_type)}</td>
      <td>${esc(sig.severity)}</td>
      <td>${sig.reported_to_authority ? '✓' : '—'}</td>
      <td><code>${esc(JSON.stringify(sig.payload))}</code></td>
    </tr>`
      )
      .join('');

    const preBlock = preSignals.length === 0
      ? `<p class="meta">No monitoring signals existed prior to snapshot timestamp ${esc(s.timestamp)}.</p>`
      : `<table><thead><tr><th>Observed at</th><th>Type</th><th>Severity</th><th>Reported (Art. 73)</th><th>Payload</th></tr></thead><tbody>${rowsFor(preSignals)}</tbody></table>`;

    const postBlock = postSignals.length === 0
      ? `<p class="meta">No new monitoring signals since the snapshot was sealed.</p>`
      : `<p class="meta">These signals were ingested after the snapshot was sealed and are <strong>not</strong> covered by its compliance evaluation. They will be folded into the next evaluation.</p>
        <table><thead><tr><th>Observed at</th><th>Type</th><th>Severity</th><th>Reported (Art. 73)</th><th>Payload</th></tr></thead><tbody>${rowsFor(postSignals)}</tbody></table>`;

    return `<h2>8. Post-market monitoring (Article 72)</h2>
<h3>At snapshot time (${esc(s.timestamp)})</h3>
${preBlock}
<h3>Operational telemetry since snapshot</h3>
${postBlock}`;
  }

  private section9(coverage: ControlCoverage[]): string {
    const counts = {
      pass: coverage.filter((c) => c.status === 'PASS').length,
      attested: coverage.filter((c) => c.status === 'MANUAL_ATTESTED').length,
      partial: coverage.filter((c) => c.status === 'PARTIAL').length,
      fail: coverage.filter((c) => c.status === 'FAIL').length,
      gap: coverage.filter((c) => c.status === 'MANUAL_EVIDENCE_REQUIRED').length
    };
    const summary = `<p class="meta"><strong>Coverage summary:</strong> ${counts.pass} automated PASS · ${counts.attested} manually attested · ${counts.partial} partial · ${counts.fail} failing · ${counts.gap} unattested gaps.</p>`;

    const gaps = coverage.filter((c) => c.status === 'MANUAL_EVIDENCE_REQUIRED');
    const fails = coverage.filter((c) => c.status === 'FAIL');
    const gapBlock = gaps.length === 0
      ? `<div class="banner banner-info"><strong>No unattested control gaps.</strong> Every ISO 42001 Annex A control is covered by either a passing automated rule or a signed manual attestation.</div>`
      : `<div class="banner banner-error"><strong>${gaps.length} control(s) have neither automated rule coverage nor a signed manual attestation.</strong>
          <p class="small">Until a manual attestation is filed (POST <code>/v1/systems/:id/attestations</code>), this dossier is incomplete and the effective conformity status is degraded.</p>
          <ul class="remediation">${gaps.map((c) => `<li><code>${esc(c.control_id)}</code> ${esc(c.control_name)}</li>`).join('')}</ul></div>`;
    const failBlock = fails.length === 0
      ? ''
      : `<div class="banner banner-error"><strong>${fails.length} control(s) have automated rules that FAILED and require remediation.</strong>
          <ul class="remediation">${fails.map((c) => `<li><code>${esc(c.control_id)}</code> ${esc(c.control_name)}</li>`).join('')}</ul></div>`;

    const attestedBlock = coverage.filter((c) => c.attestation).map((c) => {
      const att = c.attestation!;
      const docLink = att.document_ref
        ? ` · <span class="meta">document: <code>${esc(att.document_ref)}</code></span>`
        : '';
      const expiry = att.expires_at ? ` · expires ${esc(att.expires_at)}` : '';
      return `<div class="att-block"><strong>${esc(c.control_id)}</strong> ${esc(c.control_name)} — attested by ${esc(att.attested_by)} on ${esc(att.attested_at)}${docLink}${expiry}<br><span class="small">${esc(att.attestation)}</span></div>`;
    }).join('');
    const attestedSection = attestedBlock
      ? `<h3>Manual attestations on file</h3>${attestedBlock}`
      : '';

    const rows = coverage
      .map((c) => `<tr>
        <td><code>${esc(c.control_id)}</code></td>
        <td>${esc(c.control_name)}</td>
        <td class="${coverageStatusClass(c.status)}">${esc(c.status)}</td>
        <td>${c.rules.length}</td>
        <td>${c.attestation ? `${esc(c.attestation.attested_by)}` : '—'}</td>
      </tr>`)
      .join('');
    return `<h2>9. ISO/IEC 42001:2023 control coverage</h2>
${summary}
${gapBlock}
${failBlock}
${attestedSection}
<h3>Full coverage matrix</h3>
<table><thead><tr><th>Control</th><th>Name</th><th>Status</th><th>Auto rules</th><th>Attestation</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  private sectionVerification(s: ComplianceSnapshot): string {
    return `<h2>10. Cryptographic verification</h2>
<p class="meta">This signature attests that the underlying <code>ComplianceSnapshot</code> has not been modified since evaluation. It does <strong>not</strong> attest to the truth of the underlying claims — that depends on the integrity of the submitted evidence, which is bound by the Evidence Merkle root below.</p>
<table>
  <tr><th>Snapshot ID</th><td class="stamp">${esc(s.id)}</td></tr>
  <tr><th>Signing key ID</th><td class="stamp">${esc(s.signing_key_id)}</td></tr>
  <tr><th>Evidence Merkle root</th><td class="stamp">${esc(s.evidence_merkle_root)}</td></tr>
  <tr><th>Parameter set hash</th><td class="stamp">${esc(s.parameter_set_hash)}</td></tr>
  <tr><th>Signature (Ed25519)</th><td class="stamp">${esc(s.signature)}</td></tr>
</table>`;
  }
}

function computeDisplayStatus(
  s: ComplianceSnapshot,
  preSignals: MonitoringSignal[],
  isoCoverage: ControlCoverage[]
): DisplayStatus {
  const openCritical = preSignals.filter(
    (sig) => (sig.severity === 'HIGH' || sig.severity === 'CRITICAL') && !sig.reported_to_authority
  );
  const unattestedGaps = isoCoverage.filter((c) => c.status === 'MANUAL_EVIDENCE_REQUIRED');

  // Snapshot-engine failures dominate (they're either blocking or non-compliant).
  if (s.final_status === 'NON_COMPLIANT_BLOCKING' || s.final_status === 'NON_COMPLIANT') {
    return {
      effective: s.final_status,
      cssClass: 'fail'
    };
  }

  // Open Article 73 alerts at snapshot time → CONDITIONAL.
  if (openCritical.length > 0) {
    return {
      effective: 'CONDITIONAL',
      cssClass: 'partial',
      banner: `<div class="banner banner-error"><strong>EFFECTIVE STATUS: CONDITIONAL.</strong>
        ${openCritical.length} unreported HIGH/CRITICAL monitoring alert(s) existed at snapshot time. The recorded conformity status of <strong>${esc(s.final_status)}</strong> reflects only the rules evaluated; an auditor will require these alerts to be reported under Article 73 (15-day clock) before treating this binder as current.</div>`
    };
  }

  // ISO 42001 gaps with no manual attestation → INCOMPLETE_DOSSIER.
  if (unattestedGaps.length > 0) {
    return {
      effective: 'INCOMPLETE_DOSSIER',
      cssClass: 'partial',
      banner: `<div class="banner banner-error"><strong>EFFECTIVE STATUS: INCOMPLETE_DOSSIER.</strong>
        Automated rules pass, but ${unattestedGaps.length} ISO 42001 control(s) have no signed manual attestation on file. A complete Annex IV dossier requires every control to be either (a) covered by passing automated rules or (b) supported by a signed manual attestation. See §9 for the gap list and POST <code>/v1/systems/:id/attestations</code> to attach signed evidence.</div>`
    };
  }

  // Engine warnings only.
  if (s.final_status === 'COMPLIANT_WITH_WARNINGS') {
    return { effective: 'COMPLIANT_WITH_WARNINGS', cssClass: 'partial' };
  }

  return { effective: 'COMPLIANT', cssClass: 'pass' };
}

function coverageStatusClass(status: ControlCoverage['status']): string {
  if (status === 'PASS' || status === 'MANUAL_ATTESTED') return 'pass';
  if (status === 'FAIL') return 'fail';
  return 'partial';
}

function computeMitigationStatus(
  m: { effective_from?: string; duration_days?: number; valid_until?: string },
  asOf: string
): MitigationStatus {
  const asOfMs = Date.parse(asOf);
  if (Number.isNaN(asOfMs)) return 'INDEFINITE';

  if (m.valid_until) {
    const until = Date.parse(m.valid_until);
    if (!Number.isNaN(until)) {
      return asOfMs <= until ? 'ACTIVE' : 'EXPIRED';
    }
  }
  if (m.effective_from && m.duration_days) {
    const from = Date.parse(m.effective_from);
    if (!Number.isNaN(from)) {
      const until = from + m.duration_days * 86_400_000;
      if (asOfMs < from) return 'OVERDUE';
      return asOfMs <= until ? 'ACTIVE' : 'EXPIRED';
    }
  }
  return 'INDEFINITE';
}

function mitigationWindowText(
  m: { effective_from?: string; duration_days?: number; valid_until?: string },
  status: MitigationStatus
): string {
  if (m.valid_until) return `valid until ${m.valid_until} — currently ${status}`;
  if (m.effective_from && m.duration_days) {
    const fromMs = Date.parse(m.effective_from);
    if (!Number.isNaN(fromMs)) {
      const until = new Date(fromMs + m.duration_days * 86_400_000).toISOString();
      return `from ${m.effective_from}, ${m.duration_days}-day window (until ${until}) — currently ${status}`;
    }
  }
  return `no time bounds recorded — treated as ${status}`;
}

function findClaim(
  s: ComplianceSnapshot,
  claimType: string
): NonNullable<RuleResult['verified_claims_used']>[number] | undefined {
  for (const r of s.rule_evaluations) {
    const claims = r.verified_claims_used ?? [];
    const found = claims.find((c) => c.claim_type === claimType);
    if (found) return found;
  }
  return undefined;
}

function humanize(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (Array.isArray(v)) return v.map((x) => formatValue(x)).join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
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
