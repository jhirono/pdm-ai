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

## Environment Variable Handling

Based on the feedback, we need to ensure proper handling of environment variables:

1. **Use .env File for Configuration**
   - Update the MCP server to load environment variables from the `.env` file in the project root
   - Use dotenv library to load variables from multiple locations:
     - User's project .env (if exists)
     - User's home directory .pdm/.env (if exists)
     - Default variables in the MCP server

2. **Configure MCP JSON**
   - Update the MCP configuration example to use environment variables matching those in the .env file
   - Allow for dynamic mapping of environment variables based on what's defined in the user's .env file
   ```json
   {
     "mcpServers": {
       "pdm-ai": {
         "command": "npx",
         "args": ["-y", "--package=pdm-ai", "pdm-mcp"],
         "env": {
           "LLM_API_KEY": "${OPENAI_API_KEY}",
           "LLM_MODEL": "${LLM_MODEL}",
           "LLM_MAX_TOKENS": "${LLM_MAX_TOKENS}",
           "LLM_TEMPERATURE": "${LLM_TEMPERATURE}",
           "LANGUAGE": "${LANGUAGE}"
         }
       }
     }
   }
   ```

## Handling Initialization with npx

To make the MCP server usable without requiring global installation or explicit initialization:

1. **Auto-Initialization Logic**
   - Implement smart auto-initialization in the MCP server that:
     - Detects if running in a pdm-ai project (checks for .pdm directory)
     - If not in a pdm project, creates a temporary project structure in memory
     - For parsing operations, uses the current directory as the working directory
   
2. **Temporary Project Mode**
   - When used via npx without prior initialization:
     - Create an in-memory or temporary project structure
     - Use OS temp directory for outputs if no specific output path provided
     - Return results directly through the MCP response instead of relying on file outputs
     - Inform user about temporary mode and how to initialize a persistent project

3. **Stateless Operation Support**
   - Make tools work in a more stateless fashion:
     - Accept raw content in addition to file paths
     - Allow returning results directly in the response
     - Support relative paths based on current working directory
   
4. **Graceful Fallbacks**
   - Implement fallbacks for missing configuration:
     - Use default models when no model specified
     - Create temporary storage when no project directory available
     - Default to sensible output formats when none specified

## Technical Implementation Details

### Directory Structure

```
src/
  mcp/
    index.js         # Main entry point for MCP server
    server.js        # MCP server implementation
    adapters.js      # Parameter adapters for command integration
    utils/           # MCP-specific utilities
      session.js     # Session management
      errors.js      # Error handling helpers
      temp-project.js # Temporary project handling
```

### Streamlined Implementation Approach

To avoid duplication between `src/commands/` and `src/mcp/tools/`, we'll implement a more efficient approach:

1. **Direct Command Integration**
   - The MCP server will directly use the existing command implementations from `src/commands/`
   - Eliminate the redundant tool files in `src/mcp/tools/`
   - Use a simple adapter pattern to transform between MCP parameters and command parameters

2. **Adapter Pattern**
   ```javascript
   // src/mcp/adapters.js
   const initCommand = require('../commands/init');
   const scenarioCommand = require('../commands/scenario');
   const jtbdCommand = require('../commands/jtbd');
   const visualizeCommand = require('../commands/visualize');
   
   // Adapter for init command
   exports.initAdapter = async (params) => {
     try {
       const projectName = params.name;
       const projectDir = params.directory || process.cwd();
       
       // Directly call the existing command
       const result = await initCommand(projectName, projectDir);
       
       return {
         success: true,
         projectName: result.projectName,
         projectDir: result.projectDir,
         message: `Successfully initialized PDM project "${result.projectName}" at ${result.projectDir}`
       };
     } catch (error) {
       return { success: false, error: error.message };
     }
   };
   
   // Similar adapters for other commands
   // ...
   ```

3. **Simplified Server Registration**
   ```javascript
   // In server.js
   const { initAdapter, scenarioAdapter, jtbdAdapter, visualizeAdapter } = require('./adapters');
   
   // Register tools using adapters
   server.tool("initProject", {
     description: "Initialize a new PDM project structure",
     parameters: z.object({
       name: z.string().optional().describe("Project name (defaults to directory name)"),
       directory: z.string().optional().describe("Project directory (defaults to current directory)")
     }),
     execute: initAdapter
   });
   
   // Other tool registrations...
   ```

This approach has several advantages:
- **Single Source of Truth**: Core functionality exists in only one place
- **Consistency**: CLI and MCP behavior will always stay in sync
- **Reduced Maintenance**: Updates to functionality only need to be made once
- **Simpler Structure**: Fewer files to maintain and understand

The adapters' only responsibility will be:
1. Convert MCP parameters to the format expected by commands
2. Handle temporary project context if needed
3. Format command results into MCP-friendly responses

### Local Development Commands

```bash
# Install dependencies
npm install @modelcontextprotocol/sdk zod dotenv

# Run MCP server in stdio mode for testing
node src/mcp/index.js

# Test with MCP Inspector
npx @modelcontextprotocol/inspector

# Local testing with .env file
node src/mcp/index.js
```

### MCP Configuration (for clients)

```json
{
  "mcpServers": {
    "pdm-ai": {
      "command": "npx",
      "args": ["-y", "--package=pdm-ai", "pdm-mcp"],
      "env": {
        "LLM_API_KEY": "${OPENAI_API_KEY}",
        "LLM_MODEL": "${LLM_MODEL}",
        "LLM_MAX_TOKENS": "${LLM_MAX_TOKENS}",
        "LLM_TEMPERATURE": "${LLM_TEMPERATURE}",
        "LANGUAGE": "${LANGUAGE}"
      }
    }
  }
}
```

## Next Steps

1. Set up the basic directory structure for MCP server implementation
2. Install the required dependencies (including dotenv)
3. Implement environment variable loading from .env files
4. Create smart project initialization logic for npx usage
5. Implement the initial server configuration
6. Create first MCP tool (scenario parsing) with support for direct content input
7. Test the implementation locally with MCP Inspector
8. Gradually add more tools and resources with stateless support

## References

- [Model Context Protocol TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [FastMCP - TypeScript framework for MCP servers](https://github.com/punkpeye/fastmcp)
- [MCP Specification](https://modelcontextprotocol.io/)
- [Dotenv Documentation](https://github.com/motdotla/dotenv)