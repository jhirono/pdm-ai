#!/bin/bash
set -e

# Path to the main script
PDM_CMD="node $(pwd)/src/index.js"

echo "Creating test output directory..."
mkdir -p ./test/output/english-test
mkdir -p ./test/output/japanese-test
mkdir -p ./test/output/incremental-test
mkdir -p ./test/output/mixed-test

echo "Running English content tests..."
$PDM_CMD init --name="English Test" --dir="./test/output/english-test"
$PDM_CMD scenario ./test/inputs/aiplat/ --output=./test/output/english-test/scenarios.json --recursive
$PDM_CMD jtbd ./test/output/english-test/scenarios.json --output=./test/output/english-test/jtbds.json --layers=2
$PDM_CMD visualize ./test/output/english-test/jtbds.json --format=mermaid --perspective=jtbd --output=./test/output/english-test/jtbd_view.md
$PDM_CMD visualize ./test/output/english-test/jtbds.json --format=mermaid --perspective=persona --output=./test/output/english-test/persona_view.md
$PDM_CMD visualize ./test/output/english-test/jtbds.json --format=csv --output=./test/output/english-test/export.csv

echo "Running Japanese content tests..."
$PDM_CMD init --name="Japanese Test" --dir="./test/output/japanese-test"
$PDM_CMD scenario ./test/inputs/japanese.txt --output=./test/output/japanese-test/scenarios.json
$PDM_CMD jtbd ./test/output/japanese-test/scenarios.json --output=./test/output/japanese-test/jtbds.json --layers=2
$PDM_CMD visualize ./test/output/japanese-test/jtbds.json --format=mermaid --perspective=jtbd --output=./test/output/japanese-test/jtbd_view.md
$PDM_CMD visualize ./test/output/japanese-test/jtbds.json --format=mermaid --perspective=persona --output=./test/output/japanese-test/persona_view.md
$PDM_CMD visualize ./test/output/japanese-test/jtbds.json --format=csv --output=./test/output/japanese-test/export.csv

echo "Running incremental processing tests..."
$PDM_CMD init --name="Incremental Test" --dir="./test/output/incremental-test"
$PDM_CMD scenario ./test/inputs/aiplat/ --output=./test/output/incremental-test/scenarios_initial.json --recursive
$PDM_CMD jtbd ./test/output/incremental-test/scenarios_initial.json --output=./test/output/incremental-test/jtbds_initial.json --layers=2
$PDM_CMD scenario ./test/inputs/aiplat2/ --output=./test/output/incremental-test/scenarios_new.json --recursive
$PDM_CMD jtbd ./test/output/incremental-test/scenarios_new.json --output=./test/output/incremental-test/jtbds_updated.json --layers=2 --incremental --previous-file=./test/output/incremental-test/jtbds_initial.json
$PDM_CMD visualize ./test/output/incremental-test/jtbds_updated.json --format=mermaid --perspective=jtbd --output=./test/output/incremental-test/jtbd_view.md

echo "Running mixed language tests..."
$PDM_CMD init --name="Mixed Language Test" --dir="./test/output/mixed-test"
$PDM_CMD scenario ./test/inputs/aiplat/governance_tech-decision-maker_compliance-framework.txt ./test/inputs/japanese.txt --output=./test/output/mixed-test/scenarios.json
$PDM_CMD jtbd ./test/output/mixed-test/scenarios.json --output=./test/output/mixed-test/jtbds.json --layers=2
$PDM_CMD visualize ./test/output/mixed-test/jtbds.json --format=mermaid --perspective=jtbd --output=./test/output/mixed-test/jtbd_view.md
$PDM_CMD visualize ./test/output/mixed-test/jtbds.json --format=mermaid --perspective=persona --output=./test/output/mixed-test/persona_view.md
$PDM_CMD visualize ./test/output/mixed-test/jtbds.json --format=csv --output=./test/output/mixed-test/export.csv

echo "All integration tests completed!"