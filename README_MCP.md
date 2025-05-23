# PDM-AI Model Context Protocol (MCP) Support

This document provides information about the Model Context Protocol (MCP) support in PDM-AI.

## Overview

PDM-AI now includes support for the [Model Context Protocol (MCP)](https://github.com/mcp-c4ai/model-context-protocol), which enables integration with LLMs that support the protocol. This allows you to extract scenarios, generate JTBDs, and create visualizations directly from an AI assistant conversation.

## Usage

### Starting the MCP Server

To start the PDM-AI MCP server, use the following command:

```bash
pdm mcp
```

This will start a stdio-based MCP server that can be used by any MCP-compatible client.

### Available Tools

**Important:** Before using any PDM-AI tool, ensure the project is initialized. If you're working in a new environment or the `.pdm` directory doesn't exist, always run the initialization first:

```
initialize_project
```

This initializes the PDM project structure required for all other tools to function properly. You'll see a confirmation message when initialization is complete.

#### 1. Extract Scenarios

```
extract_scenarios
```

Extract user scenarios from input text files or directories.

**Parameters:**
- `source`: Source file or directory to process
- `recursive` (optional): Process directories recursively (default: false)
- `model` (optional): LLM model to use
- `verbose` (optional): Enable verbose output (default: false)

#### 2. Generate JTBDs

```
generate_jtbd
```

Generate JTBD statements from scenarios through adaptive clustering.

**Parameters:**
- `source`: Input file(s) containing scenarios (comma-separated for multiple files)
- `output` (optional): Output file path
- `model` (optional): LLM model to use
- `layers` (optional): Number of JTBD layers to generate (default: 1)
- `incremental` (optional): Process incrementally with previous results (default: false)
- `verbose` (optional): Enable verbose output (default: false)

#### 3. Visualize JTBDs

```
visualize
```

Create visual representations of JTBDs and scenarios.

**Parameters:**
- `source`: Input JSON file with JTBDs and scenarios
- `format` (optional): Output format (mermaid, csv) (default: mermaid)
- `perspective` (optional): Visualization perspective (jtbd, persona) (default: jtbd)
- `output` (optional): Output file path
- `filter` (optional): Filter entities by text match
- `maxNodes` (optional): Maximum number of nodes to display (default: 100)
- `verbose` (optional): Show detailed processing output (default: false)

**Response Format:**
- The tool will return a response with the following structure:
  ```json
  {
    "content": [
      {
        "type": "text",
        "text": "{\"data\":\"graph TD\\n  A[JTBD]-->B[Scenario]\\n...\",\"format\":\"mermaid\",\"outputPath\":\"/path/to/output.md\",\"success\":true}"
      }
    ]
  }
  ```
- Key parts of the response:
  - `data`: Contains the actual visualization content (Mermaid diagram code or CSV data)
  - `format`: Indicates the format type (mermaid or csv)
  - `outputPath`: Path to the saved visualization file
  - `success`: Boolean indicating if the visualization was created successfully
- **Important:** For Mermaid diagrams, the `data` field contains valid Mermaid syntax that can be directly rendered in any Mermaid-compatible viewer
- **Note for LLMs:** This is a successful response, not an error. You should extract and use the Mermaid code from the `data` field

## Integration with AI Assistants

The PDM-AI MCP server can be integrated with any MCP-compatible client, including AI assistants that support MCP. This enables AI assistants to extract scenarios, generate JTBDs, and create visualizations directly within a conversation.

### Example Integration with Copilot GPT

1. Start the PDM-AI MCP server:
   ```bash
   pdm mcp
   ```

2. In the Copilot GPT interface, connect to the PDM-AI MCP server.

3. Use the available tools via the AI assistant.

## Technical Details

The PDM-AI MCP server is implemented using the [FastMCP](https://github.com/chain-ml/fastmcp) library and supports the Model Context Protocol specification v1.0. It uses stdio for communication, which is the most compatible transport mechanism for MCP clients.

### Implementation

The MCP server is implemented in the following files:
- `src/mcp/index.js`: Entry point for the MCP server
- `src/mcp/server.js`: Core implementation of the MCP server

The server leverages the existing PDM-AI command modules to perform the actual work, ensuring consistency between the CLI and MCP interfaces.
