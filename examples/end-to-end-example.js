/**
 * End-to-End Compliance Evaluation Example
 *
 * Demonstrates the complete flow:
 * 1. System registration
 * 2. Evidence ingestion
 * 3. Evidence verification
 * 4. Policy evaluation
 * 5. Immutable snapshot creation
 */
import { SystemRegistry, EvidenceVault, EvidenceVerifier, PolicyEngine, SnapshotStore, Orchestrator, PolicyLoader, StructuredJSONAdapter } from '../src/index.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
async function main() {
    console.log('=== AegisAI Compliance Engine - End-to-End Example ===\n');
    // ========================================================================
    // Step 1: Initialize Services
    // ========================================================================
    console.log('1. Initializing services...');
    const registry = new SystemRegistry();
    const vault = new EvidenceVault();
    const verifier = new EvidenceVerifier({ vault });
    const policyEngine = new PolicyEngine();
    const snapshotStore = new SnapshotStore();
    const orchestrator = new Orchestrator({
        registry,
        vault,
        verifier,
        policyEngine,
        snapshotStore
    });
    const policyLoader = new PolicyLoader();
    // Register evidence adapters
    // Note: In production, adapters would be selected based on evidence metadata
    // For this example, we use a single adapter that handles all structured JSON
    // and extracts claim type from evidence content or metadata
    const structuredAdapter = new StructuredJSONAdapter({}, 'structured_claim');
    verifier.registerAdapter('STRUCTURED_JSON', structuredAdapter);
    // In a production system, you would have claim-type-specific adapters
    // or a routing mechanism based on evidence metadata
    console.log('   ✓ Services initialized\n');
    // ========================================================================
    // Step 2: Register AI System
    // ========================================================================
    console.log('2. Registering AI system...');
    const systemVersion = registry.registerSystemVersion('fraud-detection-v1', '1.2.3', 'FraudDetectionModel', 'v2.1', {
        environment: 'PRODUCTION',
        region: 'EU',
        deploymentDate: '2024-01-15T00:00:00Z'
    });
    console.log(`   ✓ System registered: ${systemVersion.id}`);
    console.log(`     System ID: ${systemVersion.system_id}`);
    console.log(`     Version: ${systemVersion.version}\n`);
    // ========================================================================
    // Step 3: Load Policy Set
    // ========================================================================
    console.log('3. Loading policy set...');
    const policySetPath = join(__dirname, '../policies/eu-ai-act-article-15.json');
    const policySet = policyLoader.loadFromJSON(policySetPath);
    console.log(`   ✓ Policy set loaded: ${policySet.metadata.name}`);
    console.log(`     Version: ${policySet.version}`);
    console.log(`     Rules: ${policySet.rules.length}\n`);
    // ========================================================================
    // Step 4: Define Parameter Set
    // ========================================================================
    console.log('4. Defining parameter set...');
    const parameterSet = {
        id: 'param-set-001',
        version: '1.0',
        parameters: {
            min_accuracy_threshold: 0.95,
            min_robustness_score: 0.90
        },
        effective_date: '2024-01-01T00:00:00Z'
    };
    console.log('   ✓ Parameter set defined');
    console.log(`     Min Accuracy: ${parameterSet.parameters.min_accuracy_threshold}`);
    console.log(`     Min Robustness: ${parameterSet.parameters.min_robustness_score}\n`);
    // ========================================================================
    // Step 5: Submit Evidence
    // ========================================================================
    console.log('5. Submitting evidence...');
    // Evidence 1: Accuracy metric
    const accuracyEvidence = {
        type: 'STRUCTURED_JSON',
        content: {
            claim_type: 'accuracy_metric', // Claim type hint in content
            accuracy: 0.97,
            test_dataset_size: 10000,
            test_date: '2024-01-10T00:00:00Z'
        },
        metadata: {
            submitted_by: 'data-science-team',
            source_system: 'ml-evaluation-pipeline'
        }
    };
    // Evidence 2: Robustness test result
    const robustnessEvidence = {
        type: 'STRUCTURED_JSON',
        content: {
            claim_type: 'robustness_test_result', // Claim type hint in content
            score: 0.92,
            test_type: 'adversarial',
            test_date: '2024-01-12T00:00:00Z'
        },
        metadata: {
            submitted_by: 'security-team',
            source_system: 'robustness-testing-framework'
        }
    };
    // Evidence 3: Cybersecurity audit
    const cybersecurityEvidence = {
        type: 'STRUCTURED_JSON',
        content: {
            claim_type: 'cybersecurity_audit', // Claim type hint in content
            passed: true,
            audit_date: '2024-01-14T00:00:00Z',
            auditor: 'internal-security-audit',
            findings: []
        },
        metadata: {
            submitted_by: 'security-team',
            source_system: 'audit-management-system'
        }
    };
    console.log('   ✓ Evidence prepared (3 items)\n');
    // ========================================================================
    // Step 6: Execute Compliance Evaluation
    // ========================================================================
    console.log('6. Executing compliance evaluation...\n');
    try {
        const snapshot = await orchestrator.evaluateCompliance({
            systemVersionId: systemVersion.id,
            evidenceSubmissions: [
                accuracyEvidence,
                robustnessEvidence,
                cybersecurityEvidence
            ],
            policySet,
            parameterSet
        });
        // ========================================================================
        // Step 7: Display Results
        // ========================================================================
        console.log('7. Compliance Evaluation Results:');
        console.log('   ' + '='.repeat(60));
        console.log(`   Snapshot ID: ${snapshot.id}`);
        console.log(`   Timestamp: ${snapshot.timestamp}`);
        console.log(`   Final Status: ${snapshot.final_status}`);
        console.log(`   Policy Set Version: ${snapshot.policy_set_version}`);
        console.log(`   Evidence Merkle Root: ${snapshot.evidence_merkle_root.substring(0, 16)}...`);
        console.log(`   Parameter Set Hash: ${snapshot.parameter_set_hash.substring(0, 16)}...`);
        console.log(`   Signature: ${snapshot.signature.substring(0, 32)}...`);
        console.log(`   Warnings: ${snapshot.warnings.length}`);
        console.log(`   Rule Evaluations: ${snapshot.rule_evaluations.length}`);
        console.log('\n   Rule Evaluation Details:');
        for (const rule of snapshot.rule_evaluations) {
            const status = rule.passed ? '✓ PASS' : '✗ FAIL';
            console.log(`     ${status} ${rule.obligation_id}/${rule.control_id}/${rule.rule_id}`);
            console.log(`       Failure Mode: ${rule.failure_mode}`);
            console.log(`       Evidence Claims: ${rule.evidence_claim_refs.length}`);
        }
        if (snapshot.warnings.length > 0) {
            console.log('\n   Warnings:');
            for (const warning of snapshot.warnings) {
                console.log(`     [${warning.severity}] ${warning.type}: ${warning.message}`);
            }
        }
        console.log('\n   ' + '='.repeat(60));
        console.log('\n✓ Compliance evaluation completed successfully!\n');
        // ========================================================================
        // Step 8: Demonstrate Snapshot Retrieval
        // ========================================================================
        console.log('8. Retrieving compliance status...');
        const latestSnapshot = orchestrator.getComplianceStatus(systemVersion.id);
        if (latestSnapshot) {
            console.log(`   ✓ Latest snapshot: ${latestSnapshot.id}`);
            console.log(`     Status: ${latestSnapshot.final_status}\n`);
        }
    }
    catch (error) {
        console.error('\n✗ Compliance evaluation failed:');
        console.error(error);
        process.exit(1);
    }
}
// Run example
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=end-to-end-example.js.map