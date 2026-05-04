/**
 * ISO/IEC 42001 control mapper.
 *
 * For a given ComplianceSnapshot, produce a control-by-control coverage
 * report mapping rule evaluations to ISO 42001 Annex A controls. This is
 * the procurement gate enterprise buyers ask for.
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ComplianceSnapshot, PolicySet } from '../domain/types.js';

export interface ControlCoverage {
  control_id: string;
  control_name: string;
  rules: Array<{
    obligation_id: string;
    rule_id: string;
    passed: boolean;
    failure_mode: 'WARN' | 'FAIL' | 'BLOCK';
  }>;
  status: 'PASS' | 'PARTIAL' | 'FAIL' | 'NOT_COVERED';
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

  coverage(snapshot: ComplianceSnapshot, policySet: PolicySet): ControlCoverage[] {
    const ruleIndex = new Map<string, { iso: string[]; failure_mode: 'WARN' | 'FAIL' | 'BLOCK' }>();
    for (const rule of policySet.rules) {
      ruleIndex.set(rule.rule_id, {
        iso: rule.iso_42001_controls ?? [],
        failure_mode: rule.failure_mode
      });
    }

    const perControl = new Map<string, ControlCoverage>();
    for (const [controlId, controlName] of Object.entries(this.catalog)) {
      perControl.set(controlId, {
        control_id: controlId,
        control_name: controlName,
        rules: [],
        status: 'NOT_COVERED'
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
      if (cell.rules.length === 0) {
        cell.status = 'NOT_COVERED';
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
