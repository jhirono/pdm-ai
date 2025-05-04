# PDM-AI

PDM-AI is a command-line tool for transforming customer feedback into structured product insights using the Jobs-to-be-Done (JTBD) methodology. It processes customer feedback, extracts user scenarios, generates JTBDs through adaptive clustering, and creates visualizations for product teams.

## Installation

```bash
# Install from npm
npm install -g pdm-ai

# Or clone and install locally
git clone https://github.com/yourusername/pdm-ai.git
cd pdm-ai
npm install
npm link
```

## Quick Start

```bash
# Initialize a new project
pdm init --name my-product

# Extract scenarios from customer feedback
pdm scenario inputs/customer-interviews.txt -o outputs/scenarios.json

# Generate JTBDs from scenarios
pdm jtbd outputs/scenarios.json -o outputs/jtbds.json

# Create visualizations
pdm visualize outputs/jtbds.json -o outputs/jtbd-diagram.md
```

## Project Structure

When you initialize a project, PDM-AI creates the following structure:

```
my-product/
├── inputs/          # Place your raw text files here
│   └── raw/         # For original, unprocessed feedback
├── outputs/         # Generated artifacts
│   ├── scenarios/   # Extracted user scenarios
│   ├── jtbds/       # Generated JTBDs
│   └── visualizations/ # Visual representations
└── .pdm/           # Project configuration and version tracking
```

## Command Reference

### Initialize a Project

```bash
pdm init [options]
```

Options:
- `-n, --name <name>` - Project name (defaults to directory name)
- `-d, --dir <directory>` - Project directory (defaults to current directory)

### Extract User Scenarios

```bash
pdm scenario <source> [options]
```

Arguments:
- `source` - Source file or directory to process

Options:
- `-o, --output <path>` - Output file path
- `-r, --recursive` - Process directories recursively
- `-m, --model <model>` - LLM model to use (defaults to gpt-4o)
- `-v, --verbose` - Enable verbose output

### Generate JTBDs

```bash
pdm jtbd <input> [options]
```

Arguments:
- `input` - Input file containing scenarios

Options:
- `-o, --output <path>` - Output file path
- `-m, --model <model>` - LLM model to use (defaults to gpt-4o)
- `-l, --layers <number>` - Number of abstraction layers (1 or 2)
- `-i, --incremental` - Enable incremental mode to update existing JTBDs
- `-v, --verbose` - Enable verbose output
- `--threshold1 <number>` - Force layer 1 clustering threshold (0.0-1.0)
- `--threshold2 <number>` - Force layer 2 clustering threshold (0.0-1.0)
- `--preserve-clusters` - In incremental mode, preserve existing clusters

### Create Visualizations

```bash
pdm visualize <input> [options]
```

Arguments:
- `input` - Input JSON file with JTBDs and scenarios

Options:
- `-f, --format <format>` - Output format: mermaid, figma, miro (default: mermaid)
- `-v, --view <view>` - Visualization perspective: jtbd, persona (default: jtbd)
- `-o, --output <path>` - Output file path
- `--filter <query>` - Filter entities by text match
- `-m, --max-nodes <number>` - Maximum number of nodes to display (default: 100)
- `--verbose` - Show detailed processing output

## Advanced Features

### Incremental Processing

Process new feedback while preserving insights from previous runs:

```bash
# Default: Recreate clusters with combined data (previous + new)
pdm jtbd new_scenarios.json --incremental

# Preserve existing clusters and add new data to them or create new clusters
pdm jtbd new_scenarios.json --incremental --preserve-clusters
```

### Hierarchical Clustering

Generate Jobs-to-be-Done (JTBDs) using adaptive clustering techniques:

```bash
# Single layer clustering
pdm jtbd scenarios.json --layers 1

# Hierarchical clustering with two layers
pdm jtbd scenarios.json --layers 2 
```

### Visualization Views

PDM-AI supports different visualization perspectives:

```bash
# JTBD-centric view (default)
pdm visualize jtbds.json --view jtbd

# Persona-centric view
pdm visualize jtbds.json --view persona
```

### Language Support

PDM-AI supports multiple languages for JTBD generation:

```bash
# Set language in .env file
echo "PDM_LANGUAGE=ja" >> .env

# Or specify in config
pdm config set language ja
```

## Configuration

PDM-AI uses a configuration system that can be set at global and project levels:

```bash
# Set global config
pdm config set model gpt-4o

# List current configuration
pdm config list
```

## LLM Provider Support

PDM-AI supports multiple LLM providers:

- OpenAI (default): I recommend gpt-4o. It supports reasoning models, but you will know their randomness.

Configure the API key in your .env file:

```
LLM_API_KEY=your_openai_api_key
```

## License

MIT
