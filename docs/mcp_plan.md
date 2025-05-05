# MCP Server Implementation Plan for pdm-ai

## Overview

This document outlines the implementation strategy for adding Model Context Protocol (MCP) support to the pdm-ai tool. The MCP integration will allow users to interact with pdm-ai directly from LLM interfaces like Claude, without having to switch contexts.

## Implementation Phases

### Phase 1: Local Development and Testing

1. **MCP Server Setup**
   - Install required dependencies
   - Create basic MCP server structure in `src/mcp/`
   - Define server configuration and initialization

2. **Core Tool Implementation**
   - Expose key pdm-ai functionality as MCP tools:
     - Project initialization
     - Scenario parsing and extraction
     - JTBD generation and management
     - Visualization generation

3. **Resource Implementation**
   - Provide access to project data as MCP resources:
     - Project configuration
     - JTBDs and scenarios
     - Source documents
     - Visualizations

4. **Local Testing**
   - Build test harness for validating MCP functionality
   - Test with MCP Inspector tool
   - Debug and optimize performance

### Phase 2: Integration and Publishing

1. **CLI Integration**
   - Add MCP command to start the server
   - Support both stdio and HTTP transport options
   - Configure environment variables and settings

2. **Package for npm**
   - Update package.json for MCP functionality
   - Document MCP capabilities in README
   - Create standalone MCP configuration guide

3. **Testing via npx**
   - Verify npx integration works as expected
   - Confirm environment variable passing

4. **Documentation and Examples**
   - Create usage examples for common LLM chat interfaces
   - Document configuration options

## Technical Implementation Details

### Directory Structure

```
src/
  mcp/
    index.js         # Main entry point for MCP server
    server.js        # MCP server implementation
    tools/           # Tool implementations
      init.js        # Project initialization tool
      scenario.js    # Scenario parsing tool
      jtbd.js        # JTBD management tools
      visualize.js   # Visualization tools
    resources/       # Resource implementations
      config.js      # Project configuration resources
      data.js        # Data access resources
    utils/           # MCP-specific utilities
      session.js     # Session management
      errors.js      # Error handling helpers
```

### MCP Server Implementation

The server will be built using the [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) library, with FastMCP as a reference. Key components include:

1. **Server Configuration**
   ```javascript
   const server = new McpServer({
     name: "pdm-ai",
     version: "0.1.0",
     instructions: "PDM-AI helps transform customer feedback into structured product insights using Jobs-to-be-Done methodology."
   });
   ```

2. **Tool Registration Pattern**
   ```javascript
   server.tool("parseScenarios", {
     description: "Extract user scenarios from input text",
     parameters: z.object({
       source: z.string().describe("Source text or file path to process"),
       recursive: z.boolean().optional().describe("Process directories recursively")
     }),
     execute: async (params) => {
       // Implementation using existing scenario parsing functionality
       // ...
     }
   });
   ```

3. **Resource Registration Pattern**
   ```javascript
   server.resource("jtbds", new ResourceTemplate("jtbd://{id?}", {
     list: async () => {
       // Return list of available JTBDs
     },
     load: async (uri) => {
       // Load specific JTBD data
       const id = uri.searchParams.get("id");
       // ...
     }
   }));
   ```

### Local Development Commands

```bash
# Install dependencies
npm install @modelcontextprotocol/sdk zod

# Run MCP server in stdio mode for testing
node src/mcp/index.js

# Test with MCP Inspector
npx @modelcontextprotocol/inspector

# Local testing with configuration
PDM_CONFIG_PATH=/path/to/config node src/mcp/index.js
```

### MCP Configuration (for clients)

```json
{
  "mcpServers": {
    "pdm-ai": {
      "command": "node",
      "args": ["./src/mcp/index.js"],
      "env": {
        "PDM_CONFIG_PATH": "${HOME}/.pdm/config.json",
        "LLM_API_KEY": "${OPENAI_API_KEY}"
      }
    }
  }
}
```

### NPX Configuration (for production)

```json
{
  "mcpServers": {
    "pdm-ai": {
      "command": "npx",
      "args": ["-y", "--package=pdm-ai", "pdm-ai-mcp"],
      "env": {
        "PDM_CONFIG_PATH": "${HOME}/.pdm/config.json",
        "LLM_API_KEY": "${OPENAI_API_KEY}"
      }
    }
  }
}
```

## Next Steps

1. Set up the basic directory structure for MCP server implementation
2. Install the required dependencies
3. Implement the initial server configuration
4. Create first MCP tool (project initialization)
5. Test the implementation locally with MCP Inspector
6. Gradually add more tools and resources

## References

- [Model Context Protocol TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [FastMCP - TypeScript framework for MCP servers](https://github.com/punkpeye/fastmcp)
- [MCP Specification](https://modelcontextprotocol.io/)