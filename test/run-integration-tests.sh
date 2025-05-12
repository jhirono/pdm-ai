#!/bin/bash
set -e

# Store the root directory for reference
ROOT_DIR=$(pwd)

# Path to the main script
PDM_CMD="node ${ROOT_DIR}/src/index.js"

# Force mock mode for integration tests
FORCE_MOCK=true

# If an OpenAI API key exists in .env, set it directly in the environment
if [ -f "${ROOT_DIR}/.env" ]; then
  echo "Loading environment variables from .env file..."
  # More robust way to handle .env files with potential quotes and special chars
  while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip comments and empty lines
    [[ $line =~ ^# ]] && continue
    [[ -z $line ]] && continue
    
    # Extract key and value
    if [[ $line =~ ^([^=]+)=(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      value="${BASH_REMATCH[2]}"
      # Remove surrounding quotes if present
      value="${value%\"}"
      value="${value#\"}"
      value="${value%\'}"
      value="${value#\'}"
      export "$key=$value"
    fi
  done < "${ROOT_DIR}/.env"
  
  # Directly check for LLM_API_KEY
  if [ -n "$LLM_API_KEY" ] || [ -n "$OPENAI_API_KEY" ]; then
    echo "API key found successfully"
    # If OPENAI_API_KEY exists but LLM_API_KEY doesn't, use OPENAI_API_KEY for LLM_API_KEY
    if [ -z "$LLM_API_KEY" ] && [ -n "$OPENAI_API_KEY" ]; then
      export LLM_API_KEY="$OPENAI_API_KEY"
      echo "Using OPENAI_API_KEY as LLM_API_KEY"
    fi
  else 
    echo "No API key found in .env file"
  fi
fi

echo "Creating test output directory..."
mkdir -p ./test/output/english-test
mkdir -p ./test/output/japanese-test
mkdir -p ./test/output/incremental-test
mkdir -p ./test/output/mixed-test

echo "Running English content tests..."
# Initialize with specific directory (this ensures .pdm directory is created in the target directory)
$PDM_CMD init --name="English Test" --dir="./test/output/english-test"
# Change to the test directory before running commands to ensure outputs go to the right place
cd ./test/output/english-test
# Use mock mode for integration tests to ensure consistent results
if [ "$FORCE_MOCK" = true ]; then
  echo "Using mock mode for consistent integration tests"
  $PDM_CMD scenario ../../inputs/aiplat/ --output=./scenarios.json --recursive --mock
  $PDM_CMD jtbd ./scenarios.json --output=./jtbds.json --layers=2 --mock
else
  if [ -n "$LLM_API_KEY" ] || [ -n "$OPENAI_API_KEY" ]; then
    echo "LLM_API_KEY=${LLM_API_KEY}" > ./.env
    echo "OPENAI_API_KEY=${OPENAI_API_KEY}" >> ./.env
    echo "Using real OpenAI API for tests"
    $PDM_CMD scenario ../../inputs/aiplat/ --output=./scenarios.json --recursive
    $PDM_CMD jtbd ./scenarios.json --output=./jtbds.json --layers=2
  else
    echo "No API key found, using mock mode"
    $PDM_CMD scenario ../../inputs/aiplat/ --output=./scenarios.json --recursive --mock
    $PDM_CMD jtbd ./scenarios.json --output=./jtbds.json --layers=2 --mock
  fi
fi
$PDM_CMD visualize ./jtbds.json --format=mermaid --perspective=jtbd --output=./jtbd_view.md
$PDM_CMD visualize ./jtbds.json --format=mermaid --perspective=persona --output=./persona_view.md
$PDM_CMD visualize ./jtbds.json --format=csv --output=./export.csv
# Return to original directory
cd "${ROOT_DIR}" > /dev/null

echo "Running Japanese content tests..."
$PDM_CMD init --name="Japanese Test" --dir="./test/output/japanese-test"
cd ./test/output/japanese-test
if [ "$FORCE_MOCK" = true ]; then
  echo "Using mock mode for consistent integration tests"
  $PDM_CMD scenario ../../inputs/japanese.txt --output=./scenarios.json --mock
  $PDM_CMD jtbd ./scenarios.json --output=./jtbds.json --layers=2 --mock
else
  if [ -n "$LLM_API_KEY" ] || [ -n "$OPENAI_API_KEY" ]; then
    echo "LLM_API_KEY=${LLM_API_KEY}" > ./.env
    echo "OPENAI_API_KEY=${OPENAI_API_KEY}" >> ./.env
    echo "Using real OpenAI API for tests"
    $PDM_CMD scenario ../../inputs/japanese.txt --output=./scenarios.json
    $PDM_CMD jtbd ./scenarios.json --output=./jtbds.json --layers=2
  else
    echo "No API key found, using mock mode"
    $PDM_CMD scenario ../../inputs/japanese.txt --output=./scenarios.json --mock
    $PDM_CMD jtbd ./scenarios.json --output=./jtbds.json --layers=2 --mock
  fi
fi
$PDM_CMD visualize ./jtbds.json --format=mermaid --perspective=jtbd --output=./jtbd_view.md
$PDM_CMD visualize ./jtbds.json --format=mermaid --perspective=persona --output=./persona_view.md
$PDM_CMD visualize ./jtbds.json --format=csv --output=./export.csv
cd "${ROOT_DIR}" > /dev/null

echo "Running incremental processing tests..."
$PDM_CMD init --name="Incremental Test" --dir="./test/output/incremental-test"
cd ./test/output/incremental-test
if [ "$FORCE_MOCK" = true ]; then
  echo "Using mock mode for consistent integration tests"
  $PDM_CMD scenario ../../inputs/aiplat/ --output=./scenarios_initial.json --recursive --mock
  $PDM_CMD jtbd ./scenarios_initial.json --output=./jtbds_initial.json --layers=2 --mock
  $PDM_CMD scenario ../../inputs/aiplat2/ --output=./scenarios_new.json --recursive --mock
  $PDM_CMD jtbd ./scenarios_new.json --output=./jtbds_updated.json --layers=2 --incremental --previous-file=./jtbds_initial.json --mock
else
  if [ -n "$LLM_API_KEY" ] || [ -n "$OPENAI_API_KEY" ]; then
    echo "LLM_API_KEY=${LLM_API_KEY}" > ./.env
    echo "OPENAI_API_KEY=${OPENAI_API_KEY}" >> ./.env
    echo "Using real OpenAI API for tests"
    $PDM_CMD scenario ../../inputs/aiplat/ --output=./scenarios_initial.json --recursive
    $PDM_CMD jtbd ./scenarios_initial.json --output=./jtbds_initial.json --layers=2
    $PDM_CMD scenario ../../inputs/aiplat2/ --output=./scenarios_new.json --recursive
    $PDM_CMD jtbd ./scenarios_new.json --output=./jtbds_updated.json --layers=2 --incremental --previous-file=./jtbds_initial.json
  else
    echo "No API key found, using mock mode"
    $PDM_CMD scenario ../../inputs/aiplat/ --output=./scenarios_initial.json --recursive --mock
    $PDM_CMD jtbd ./scenarios_initial.json --output=./jtbds_initial.json --layers=2 --mock
    $PDM_CMD scenario ../../inputs/aiplat2/ --output=./scenarios_new.json --recursive --mock
    $PDM_CMD jtbd ./scenarios_new.json --output=./jtbds_updated.json --layers=2 --incremental --previous-file=./jtbds_initial.json --mock
  fi
fi
$PDM_CMD visualize ./jtbds_updated.json --format=mermaid --perspective=jtbd --output=./jtbd_view.md
cd "${ROOT_DIR}" > /dev/null

echo "Running mixed language tests..."
$PDM_CMD init --name="Mixed Language Test" --dir="./test/output/mixed-test"
cd ./test/output/mixed-test
if [ "$FORCE_MOCK" = true ]; then
  echo "Using mock mode for consistent integration tests"
  $PDM_CMD scenario ../../inputs/aiplat/governance_tech-decision-maker_compliance-framework.txt ../../inputs/japanese.txt --output=./scenarios.json --mock
  $PDM_CMD jtbd ./scenarios.json --output=./jtbds.json --layers=2 --mock
else
  if [ -n "$LLM_API_KEY" ] || [ -n "$OPENAI_API_KEY" ]; then
    echo "LLM_API_KEY=${LLM_API_KEY}" > ./.env
    echo "OPENAI_API_KEY=${OPENAI_API_KEY}" >> ./.env
    echo "Using real OpenAI API for tests"
    $PDM_CMD scenario ../../inputs/aiplat/governance_tech-decision-maker_compliance-framework.txt ../../inputs/japanese.txt --output=./scenarios.json
    $PDM_CMD jtbd ./scenarios.json --output=./jtbds.json --layers=2
  else
    echo "No API key found, using mock mode"
    $PDM_CMD scenario ../../inputs/aiplat/governance_tech-decision-maker_compliance-framework.txt ../../inputs/japanese.txt --output=./scenarios.json --mock
    $PDM_CMD jtbd ./scenarios.json --output=./jtbds.json --layers=2 --mock
  fi
fi
$PDM_CMD visualize ./jtbds.json --format=mermaid --perspective=jtbd --output=./jtbd_view.md
$PDM_CMD visualize ./jtbds.json --format=mermaid --perspective=persona --output=./persona_view.md
$PDM_CMD visualize ./jtbds.json --format=csv --output=./export.csv
cd "${ROOT_DIR}" > /dev/null

echo "All integration tests completed!"