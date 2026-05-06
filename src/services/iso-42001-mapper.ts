/**
 * ISO/IEC 42001 control mapper.
 *
 * Coverage status is derived from two independent sources:
 *   - automated rule evaluations from the policy engine
 *   - signed manual attestations attached to the system version
 *
 * A control is considered covered if every applicable automated rule passes
 * AND there are no applicable rules failing. If no rules apply, a signed
 * manual attestation (active at snapshot time) makes it MANUAL_ATTESTED.
 * Otherwise the control is MANUAL_EVIDENCE_REQUIRED — a real gap.
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ComplianceSnapshot, PolicySet, ManualAttestation } from '../domain/types.js';

export interface ControlCoverage {
  control_id: string;
  control_name: string;
  rules: Array<{
    obligation_id: string;
    rule_id: string;
    passed: boolean;
    failure_mode: 'WARN' | 'FAIL' | 'BLOCK';
  }>;
  attestation?: {
    attestation: string;
    attested_by: string;
    attested_at: string;
    document_ref?: string;
    expires_at?: string;
    active: boolean;
  };
  status: 'PASS' | 'PARTIAL' | 'FAIL' | 'MANUAL_ATTESTED' | 'MANUAL_EVIDENCE_REQUIRED';
}

export class ISO42001Mapper {
  private readonly catalog: Record<string, string>;

  constructor(catalogPath?: string) {
    const path =
      catalogPath ??
      join(
        dirname(fileURLToPath(import.meta.url)),
        '../../policies/iso-42001-controls.json'
      );
    const raw = JSON.parse(readFileSync(path, 'utf-8'));
    this.catalog = raw.controls;
  }

  coverage(
    snapshot: ComplianceSnapshot,
    policySet: PolicySet,
    attestations: ManualAttestation[] = [],
    asOf: string = snapshot.timestamp
  ): ControlCoverage[] {
    const ruleIndex = new Map<string, { iso: string[]; failure_mode: 'WARN' | 'FAIL' | 'BLOCK' }>();
    for (const rule of policySet.rules) {
      ruleIndex.set(rule.rule_id, {
        iso: rule.iso_42001_controls ?? [],
        failure_mode: rule.failure_mode
      });
    }

    const attestationsByControl = new Map<string, ManualAttestation>();
    for (const a of attestations) {
      if (a.framework !== 'ISO_42001') continue;
      attestationsByControl.set(a.control_id, a);
    }

    const perControl = new Map<string, ControlCoverage>();
    for (const [controlId, controlName] of Object.entries(this.catalog)) {
      perControl.set(controlId, {
        control_id: controlId,
        control_name: controlName,
        rules: [],
        status: 'MANUAL_EVIDENCE_REQUIRED'
      });
    }

    for (const ev of snapshot.rule_evaluations) {
      const meta = ruleIndex.get(ev.rule_id);
      if (!meta) continue;
      for (const controlId of meta.iso) {
        const cell = perControl.get(controlId);
        if (!cell) continue;
        cell.rules.push({
          obligation_id: ev.obligation_id,
          rule_id: ev.rule_id,
          passed: ev.passed,
          failure_mode: ev.failure_mode
        });
      }
    }

    for (const cell of perControl.values()) {
      const att = attestationsByControl.get(cell.control_id);
      if (att) {
        const active = !att.expires_at || Date.parse(asOf) <= Date.parse(att.expires_at);
        cell.attestation = {
          attestation: att.attestation,
          attested_by: att.attested_by,
          attested_at: att.attested_at,
          document_ref: att.document_ref,
          expires_at: att.expires_at,
          active
        };
      }

      if (cell.rules.length === 0) {
        cell.status = cell.attestation?.active ? 'MANUAL_ATTESTED' : 'MANUAL_EVIDENCE_REQUIRED';
      } else {
        const passes = cell.rules.filter((r) => r.passed).length;
        if (passes === cell.rules.length) cell.status = 'PASS';
        else if (passes === 0) cell.status = 'FAIL';
        else cell.status = 'PARTIAL';
      }
    }

    return Array.from(perControl.values()).sort((a, b) =>
      a.control_id.localeCompare(b.control_id, undefined, { numeric: true })
    );
  }
}
