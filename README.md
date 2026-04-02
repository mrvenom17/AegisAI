# AegisAI Compliance Engine v1.0

## Executive Summary

AegisAI Compliance Engine is a deterministic, policy-driven compliance decision system designed specifically to evaluate AI systems against regulatory frameworks, primarily the EU AI Act. 

Its primary use case is to facilitate automated compliance checks, validate submitted evidence, and generate comprehensive compliance reports for AI operations. By ingestng declarative JSON policies and validating system evidence against them, AegisAI ensures systematic, transparent, and reproducible evaluation of AI systems against complex legislative frameworks like Articles 5 and 15 of the EU AI Act. This solves the critical problem of manual, error-prone regulatory audits by providing a structured, code-first approach to AI compliance.

## System Architecture

AegisAI employs a modular, service-oriented architecture built in TypeScript. The system is designed around several core components that work together to evaluate compliance:

*   **Core Infrastructure**: The application is divided into distinct services (Policy Engine, Evidence Vault, System Registry, etc.) orchestrated by a central `Orchestrator`.
*   **Design Patterns**: 
    *   *Registry Pattern*: Used by the `SystemRegistry` to manage the lifecycle and metadata of AI systems under evaluation.
    *   *Adapter Pattern*: Employed by the `EvidenceVerifier` (`StructuredJSONAdapter`, `DocumentAdapter`) to normalize heterogeneous evidence inputs into a standard format for evaluation.
    *   *Facade/Orchestrator Pattern*: The `Orchestrator` service acts as the central coordinator, abstracting the complex interactions between the vault, engine, and reporting services.
*   **Module Interactions**: The `Orchestrator` receives a request, loads policies via `PolicyLoader`, fetches systems from the `SystemRegistry`, gathers and verifies evidence using the `EvidenceVault` and `EvidenceVerifier`, evaluates the data using the `PolicyEngine`, stores the result in the `SnapshotStore`, and finally generates documentation via `DocGen`.

## Tech Stack & Dependencies

**Language**: TypeScript (Node.js Environment)

**Core Dependencies**:
*   `zod` (^3.22.4): Schema validation and runtime type safety.
*   `json-logic-js` (^2.0.2): Evaluation of complex, declarative JSON policy rules.
*   `uuid` (^9.0.1): Unique identifier generation for systems, evidence, and evaluations.
*   `crypto` (^1.0.1): Cryptographic hashing to ensure evidence integrity and immutability.

**Development Tools**:
*   `typescript` (^5.3.2): Static typing and compilation.
*   `eslint` (^8.54.0) & `@typescript-eslint/*`: Code linting and quality assurance.

## Directory Structure

```text
/
├── ARCHITECTURE.md          # Detailed architectural documentation
├── IMPLEMENTATION_NOTES.md  # Implementation details and developer notes
├── package.json             # Project dependencies and npm scripts
├── PROJECT_SUMMARY.md       # High-level project summary
├── QUICK_START.md           # Quick start guide
├── README.md                # This comprehensive documentation file
├── tsconfig.json            # TypeScript compiler configuration
├── examples/                # Compiled end-to-end usage examples
├── policies/                # JSON definitions of regulatory rules
│   ├── eu-ai-act-article-15.json
│   └── eu-ai-act-article-5.json
└── src/                     # Source code directory
    ├── index.ts             # Main entry point exporting core services
    ├── domain/              # Shared data models and interfaces
    │   └── types.ts
    ├── examples/            # TypeScript source for practical end-to-end usage
    │   └── end-to-end-example.ts
    ├── services/            # Core business logic modules
    │   ├── docgen.ts
    │   ├── evidence-vault.ts
    │   ├── evidence-verifier.ts
    │   ├── orchestrator.ts
    │   ├── policy-engine.ts
    │   ├── policy-loader.ts
    │   ├── snapshot-store.ts
    │   └── system-registry.ts
    └── utils/               # Helper utilities
        ├── crypto.ts
        └── uuid.ts
```

## Setup & Installation

Follow these steps to set up the AegisAI Compliance Engine locally.

**Prerequisites**:
*   Node.js (version 18.0.0 or higher)
*   npm (Node Package Manager)

**1. Clone the Repository**:
```bash
git clone <repository_url>
cd AegisAI
```

**2. Install Dependencies**:
```bash
npm install
```

**3. Compile TypeScript**:
```bash
npm run build
```
This will compile the TypeScript code into JavaScript in the `dist/` directory.

*(Note: There are no specific `.env` requirements mandated by the core codebase at this time. Standard Node.js environment applies).*

## Core Data Flow / Logic

The primary execution path for a compliance evaluation follows these steps:

1.  **Initialization**: The system boots up. Regulatory rules are loaded from JSON files in the `policies/` directory using the `PolicyLoader`. The AI system under evaluation is registered in the `SystemRegistry`.
2.  **Evidence Collection**: Technical documentation, test results, and operational data are submitted to the `EvidenceVault`. The `EvidenceVerifier` ensures this data matches expected schemas and formats.
3.  **Policy Evaluation**: The central `Orchestrator` triggers the `PolicyEngine`. The Engine uses `json-logic-js` to process the verified evidence against the loaded JSON policy rules, determining compliant or non-compliant states defensively.
4.  **Snapshot & Reporting**: The outcome of the evaluation, along with the state of the evidence and policies at that exact point in time, is persisted to the `SnapshotStore` for auditability. Finally, the `DocGen` service formats these results into human-readable compliance reports.

## Testing & Deployment

**Running Examples**:
To see an end-to-end evaluation workflow in action, execute the provided example script:
```bash
npm run example
```
This script compiles the project and runs the `dist/examples/end-to-end-example.js` file, demonstrating the complete data flow.

**Quality Assurance**:
Ensure code quality and strict type safety by running the built-in checks:
```bash
npm run lint
npm run type-check
```

**Build for Production**:
To compile the project for deployment:
```bash
npm run build
```
The compiled assets will be available in the `dist/` directory, ready to be integrated into any Node.js (>=18) environment.

**Production-Grade EU AI Act Compliance Decision Engine**

## Architecture

AegisAI is a deterministic, policy-driven compliance engine that converts EU AI Act obligations into immutable, signed ComplianceSnapshots.

### Core Principles

1. **Determinism**: Identical inputs produce identical outputs forever
2. **Evidence Verification**: All evidence is type-validated before evaluation
3. **Configuration as Interpretation**: All thresholds come from signed Parameter Sets
4. **Immutable Compliance**: Compliance is an immutable snapshot, not a boolean
5. **Explicit Uncertainty**: Missing data is a first-class signal

### Services

- **System Registry**: Registers AI systems, models, versions, deployment context
- **Evidence Vault**: Write-once storage with cryptographic content addressing
- **Evidence Verifier**: Validates evidence and emits VerifiedClaims
- **Policy Engine**: Pure function that evaluates policies deterministically
- **Snapshot Store**: Immutable storage for ComplianceSnapshots
- **DocGen**: Generates Annex IV technical documentation

## Usage

See `examples/` directory for end-to-end examples.

## License

UNLICENSED - Internal Use Only
