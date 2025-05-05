# PDM-AI MCP Server Usage Guide

This guide explains how to use the PDM-AI Model Context Protocol (MCP) server integration for interacting with your product requirements through LLM chat interfaces.

## What is MCP?

The Model Context Protocol (MCP) is a standard protocol that allows AI assistants to access external tools and data. With PDM-AI's MCP server, you can interact with your product requirements data directly from chat interfaces like Claude.

## Local Setup

### 1. Install PDM-AI

If you haven't already, install PDM-AI:

```bash
npm install -g pdm-ai
```

### 2. Start the MCP Server

You can start the MCP server using the PDM CLI:

```bash
pdm mcp
```

Or using npm:

```bash
npm run mcp
```

This will start the MCP server in stdio mode, which is ready to be used with MCP-compatible chat interfaces.

### 3. Configure your LLM Chat Interface

Create a configuration file for your MCP-compatible chat interface. Here's an example for Claude Desktop:

```json
{
  "mcpServers": {
    "pdm-ai": {
      "command": "pdm",
      "args": ["mcp"],
      "env": {
        "PDM_CONFIG_PATH": "${HOME}/.pdm/config.json",
        "LLM_API_KEY": "${OPENAI_API_KEY}"
      }
    }
  }
}
```

Save this as `pdm-mcp-config.json` and configure your LLM interface to use this file.

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
````
