import { readFileSync } from 'fs';
import {
  PolicySet,
  PolicySetSchema,
  PolicyRule,
  PolicyRuleSchema
} from '../domain/types.js';

export class PolicyLoader {
  loadFromJSON(filePath: string): PolicySet {
    try {
      const content = readFileSync(filePath, 'utf-8');
      return PolicySetSchema.parse(JSON.parse(content));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to load policy set from ${filePath}: ${msg}`);
    }
  }

  createPolicySet(
    version: string,
    effectiveDate: string,
    rules: PolicyRule[],
    metadata: { name: string; description?: string; regulatorySource: string }
  ): PolicySet {
    return PolicySetSchema.parse({
      version,
      effective_date: effectiveDate,
      rules: rules.map((r) => PolicyRuleSchema.parse(r)),
      metadata: {
        name: metadata.name,
        description: metadata.description,
        regulatory_source: metadata.regulatorySource
      }
    });
  }
}
