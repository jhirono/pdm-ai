# PDM-AI Simplified Test Plan

This document outlines a streamlined approach to test the PDM-AI CLI tool's core functionality with both English and Japanese content.

## Prerequisites

- Node.js installed
- `.env` file with proper API keys configured
- PDM-AI installed (`npm install -g` or run with `node src/index.js`)

## Integration Test Suite

### 1. English Content Processing

```bash
# Initialize new project
pdm init --name="English Test" --dir="./test/output/english-test"

# Process English scenarios
pdm scenario ./test/inputs/aiplat/ --output=./test/output/english-test/scenarios.json --recursive

# Generate JTBDs (2 layers)
pdm jtbd ./test/output/english-test/scenarios.json --output=./test/output/english-test/jtbds.json --layers=2

# Visualize with Mermaid (JTBD view)
pdm visualize ./test/output/english-test/jtbds.json --format=mermaid --view=jtbd --output=./test/output/english-test/jtbd_view.md

# Visualize with Mermaid (Persona view)
pdm visualize ./test/output/english-test/jtbds.json --format=mermaid --view=persona --output=./test/output/english-test/persona_view.md

# Export to CSV
pdm visualize ./test/output/english-test/jtbds.json --format=csv --output=./test/output/english-test/export.csv
```

### 2. Japanese Content Processing

```bash
# Initialize new project
pdm init --name="Japanese Test" --dir="./test/output/japanese-test"

# Process Japanese scenarios
pdm scenario ./test/inputs/lazuli.txt --output=./test/output/japanese-test/scenarios.json

# Generate JTBDs (2 layers)
pdm jtbd ./test/output/japanese-test/scenarios.json --output=./test/output/japanese-test/jtbds.json --layers=2

# Visualize with Mermaid (JTBD view)
pdm visualize ./test/output/japanese-test/jtbds.json --format=mermaid --view=jtbd --output=./test/output/japanese-test/jtbd_view.md

# Visualize with Mermaid (Persona view)
pdm visualize ./test/output/japanese-test/jtbds.json --format=mermaid --view=persona --output=./test/output/japanese-test/persona_view.md

# Export to CSV
pdm visualize ./test/output/japanese-test/jtbds.json --format=csv --output=./test/output/japanese-test/export.csv
```

### 3. Incremental Processing Test

```bash
# Initialize new project
pdm init --name="Incremental Test" --dir="./test/output/incremental-test"

# Process initial dataset
pdm scenario ./test/inputs/aiplat/ --output=./test/output/incremental-test/scenarios_initial.json --recursive

# Generate initial JTBDs
pdm jtbd ./test/output/incremental-test/scenarios_initial.json --output=./test/output/incremental-test/jtbds_initial.json --layers=2

# Process new scenarios
pdm scenario ./test/inputs/aiplat2/ --output=./test/output/incremental-test/scenarios_new.json --recursive

# Generate incremental JTBDs
pdm jtbd ./test/output/incremental-test/scenarios_new.json --output=./test/output/incremental-test/jtbds_updated.json --layers=2 --incremental

# Visualize incremental results
pdm visualize ./test/output/incremental-test/jtbds_updated.json --format=mermaid --view=jtbd --output=./test/output/incremental-test/jtbd_view.md
```

### 4. Mixed Language Test

```bash
# Initialize new project
pdm init --name="Mixed Language Test" --dir="./test/output/mixed-test"

# Process mixed language content
pdm scenario ./test/inputs/aiplat/governance_tech-decision-maker_compliance-framework.txt ./test/inputs/lazuli.txt --output=./test/output/mixed-test/scenarios.json

# Generate JTBDs
pdm jtbd ./test/output/mixed-test/scenarios.json --output=./test/output/mixed-test/jtbds.json --layers=2

# Visualize with Mermaid
pdm visualize ./test/output/mixed-test/jtbds.json --format=mermaid --view=jtbd --output=./test/output/mixed-test/jtbd_view.md

# Export to CSV
pdm visualize ./test/output/mixed-test/jtbds.json --format=csv --output=./test/output/mixed-test/export.csv
```

## Validation Checklist

For each test case above, validate the following:

- [ ] Command executed without errors
- [ ] Output files were created successfully
- [ ] Scenarios are properly parsed from input text
- [ ] JTBDs are properly generated with correct hierarchy
- [ ] JTBD clusters are meaningful and well-grouped
- [ ] Mermaid diagrams render correctly and show appropriate relationships
- [ ] CSV exports contain all expected data
- [ ] Incremental processing preserves existing JTBDs and properly incorporates new scenarios
- [ ] Both English and Japanese content is processed correctly

## Shell Script for Automated Testing

Save the following as `run-integration-tests.sh`:

```bash
#!/bin/bash
set -e

echo "Creating test output directory..."
mkdir -p ./test/output/english-test
mkdir -p ./test/output/japanese-test
mkdir -p ./test/output/incremental-test
mkdir -p ./test/output/mixed-test

echo "Running English content tests..."
pdm init --name="English Test" --dir="./test/output/english-test"
pdm scenario ./test/inputs/aiplat/ --output=./test/output/english-test/scenarios.json --recursive
pdm jtbd ./test/output/english-test/scenarios.json --output=./test/output/english-test/jtbds.json --layers=2
pdm visualize ./test/output/english-test/jtbds.json --format=mermaid --view=jtbd --output=./test/output/english-test/jtbd_view.md
pdm visualize ./test/output/english-test/jtbds.json --format=mermaid --view=persona --output=./test/output/english-test/persona_view.md
pdm visualize ./test/output/english-test/jtbds.json --format=csv --output=./test/output/english-test/export.csv

echo "Running Japanese content tests..."
pdm init --name="Japanese Test" --dir="./test/output/japanese-test"
pdm scenario ./test/inputs/lazuli.txt --output=./test/output/japanese-test/scenarios.json
pdm jtbd ./test/output/japanese-test/scenarios.json --output=./test/output/japanese-test/jtbds.json --layers=2
pdm visualize ./test/output/japanese-test/jtbds.json --format=mermaid --view=jtbd --output=./test/output/japanese-test/jtbd_view.md
pdm visualize ./test/output/japanese-test/jtbds.json --format=mermaid --view=persona --output=./test/output/japanese-test/persona_view.md
pdm visualize ./test/output/japanese-test/jtbds.json --format=csv --output=./test/output/japanese-test/export.csv

echo "Running incremental processing tests..."
pdm init --name="Incremental Test" --dir="./test/output/incremental-test"
pdm scenario ./test/inputs/aiplat/ --output=./test/output/incremental-test/scenarios_initial.json --recursive
pdm jtbd ./test/output/incremental-test/scenarios_initial.json --output=./test/output/incremental-test/jtbds_initial.json --layers=2
pdm scenario ./test/inputs/aiplat2/ --output=./test/output/incremental-test/scenarios_new.json --recursive
pdm jtbd ./test/output/incremental-test/scenarios_new.json --output=./test/output/incremental-test/jtbds_updated.json --layers=2 --incremental
pdm visualize ./test/output/incremental-test/jtbds_updated.json --format=mermaid --view=jtbd --output=./test/output/incremental-test/jtbd_view.md

echo "Running mixed language tests..."
pdm init --name="Mixed Language Test" --dir="./test/output/mixed-test"
pdm scenario ./test/inputs/aiplat/governance_tech-decision-maker_compliance-framework.txt ./test/inputs/lazuli.txt --output=./test/output/mixed-test/scenarios.json
pdm jtbd ./test/output/mixed-test/scenarios.json --output=./test/output/mixed-test/jtbds.json --layers=2
pdm visualize ./test/output/mixed-test/jtbds.json --format=mermaid --view=jtbd --output=./test/output/mixed-test/jtbd_view.md
pdm visualize ./test/output/mixed-test/jtbds.json --format=csv --output=./test/output/mixed-test/export.csv

echo "All integration tests completed!"
```

Make the script executable:
```bash
chmod +x run-integration-tests.sh
```

Run the automated test suite:
```bash
./run-integration-tests.sh
```