/**
 * Policy Loader Service
 * 
 * Loads and validates policy sets from JSON/YAML files.
 * Ensures policies are declarative, not code.
 */

import { PolicySet, PolicySetSchema, PolicyRule, PolicyRuleSchema } from '../domain/types.js';
import { readFileSync } from 'fs';

export class PolicyLoader {
  /**
   * Load a policy set from a JSON file.
   * Validates against Zod schema.
   */
  loadFromJSON(filePath: string): PolicySet {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      return PolicySetSchema.parse(parsed);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load policy set from ${filePath}: ${errorMessage}`);
    }
  }

  /**
   * Load a policy set from a YAML file.
   * Requires yaml parser (not included in base dependencies).
   */
  loadFromYAML(_filePath: string): PolicySet {
    throw new Error('YAML loading not implemented. Use JSON format.');
  }

  /**
   * Create a policy set programmatically (for testing).
   */
  createPolicySet(
    version: string,
    effectiveDate: string,
    rules: PolicyRule[],
    metadata: {
      name: string;
      description?: string;
      regulatorySource: string;
    }
  ): PolicySet {
    const policySet: PolicySet = {
      version,
      effective_date: effectiveDate,
      rules: rules.map(rule => PolicyRuleSchema.parse(rule)),
      metadata: {
        name: metadata.name,
        description: metadata.description,
        regulatory_source: metadata.regulatorySource
      }
    };

    return PolicySetSchema.parse(policySet);
  }
}
