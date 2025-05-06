# PDM-AI MCP Server Usage Guide

This guide explains how to use the PDM-AI Model Context Protocol (MCP) server integration for interacting with your product requirements through LLM chat interfaces.

## What is MCP?

The Model Context Protocol (MCP) is a standard protocol that allows AI assistants to access external tools and data. With PDM-AI's MCP server, you can interact with your product requirements data directly from chat interfaces like Claude.

## Configure your LLM Chat Interface

Create a configuration file for your MCP-compatible chat interface. Here's an example for Claude, Cursor, VSCode, other IDEs.

```json
{
  "mcpServers": {
    "pdm-ai": {
      "command": "npx",
      "args": ["-y", "--package=pdm-ai", "pdm-mcp"],
      "env": {
        "LLM_API_KEY": "your api key",
        "LLM_MODEL": "gpt-4o",
        "LLM_MAX_TOKENS": "4000",
        "LLM_TEMPERATURE": "0.7",
        "LANGUAGE": "en"
      }
    }
  }
}
```

## Alternative: Local Installation

If you prefer a local installation (not recommended for most users):

```bash
npm install -g pdm-ai
pdm mcp
```

## Available MCP Tools

The PDM-AI MCP server provides the following tools:

### Project Initialization

Initialize a new PDM project structure:

```
Prompt: "Initialize a new PDM project in the current directory called 'banking-app'"
```

### Scenario Parsing

Extract user scenarios from input text:

```
Prompt: "Parse scenarios from the customer-feedback.txt file"
```

### JTBD Generation

Generate Jobs-to-be-Done from user scenarios:

```
Prompt: "Generate JTBDs from the scenarios.json file"
```

### Visualization

Create visualizations of your project data:

```
Prompt: "Create a visualization of my JTBDs from project-data.json"
```

## Example Conversation

Here's an example conversation using PDM-AI via MCP:

```
User: I need to analyze customer feedback for my new mobile banking app.
```

## Special Instructions for LLMs

If you are an AI assistant (LLM) using PDM-AI's MCP interface, you MUST follow this protocol:

### 1. Initialize If Needed

If the `.pdm` directory does NOT exist or the above check returns nothing, you MUST initialize the project before proceeding:

```bash
pdm init [--name optional-project-name]
```

Wait for initialization to complete successfully before continuing.

### 2. Process in Correct Sequence

Only after confirming that a project is initialized, proceed with the commands in this sequence:

```bash
# Step 1: Process input files into scenarios
pdm scenario <input-path> [options]

# Step 2: Generate JTBDs from scenarios
pdm jtbd <scenarios-file> [options]

# Step 3: Create visualizations from JTBDs
pdm visualize <jtbds-file> [options]
```
