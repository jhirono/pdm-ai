/**
 * PDM-AI MCP Server Implementation
 * 
 * Defines the MCP server and registers available tools, resources, and prompts
 */
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { z } = require('zod');
const path = require('path');
const config = require('../utils/config');
const logger = require('../utils/logger');
const pkg = require('../../package.json');

// Initialize tools
const initTool = require('./tools/init');
const scenarioTool = require('./tools/scenario');
const jtbdTool = require('./tools/jtbd');
const visualizeTool = require('./tools/visualize');

// Create the MCP server
const server = new McpServer({
  name: "pdm-ai",
  version: pkg.version,
  instructions: "PDM-AI helps transform customer feedback into structured product insights using Jobs-to-be-Done (JTBD) methodology."
});

// Register all tools
function registerTools() {
  // Project initialization
  server.tool("initProject", {
    description: "Initialize a new PDM project structure",
    parameters: z.object({
      name: z.string().optional().describe("Project name (defaults to directory name)"),
      directory: z.string().optional().describe("Project directory (defaults to current directory)")
    }),
    execute: initTool.execute
  });

  // Scenario parsing
  server.tool("parseScenarios", {
    description: "Extract user scenarios from input text files",
    parameters: z.object({
      source: z.string().describe("Source file or directory to process"),
      output: z.string().optional().describe("Output file path"),
      recursive: z.boolean().optional().describe("Process directories recursively"),
      model: z.string().optional().describe("LLM model to use")
    }),
    execute: scenarioTool.execute
  });

  // JTBD generation
  server.tool("generateJtbds", {
    description: "Generate Jobs-to-be-Done from user scenarios",
    parameters: z.object({
      source: z.string().describe("Source file with user scenarios"),
      output: z.string().optional().describe("Output file path"),
      model: z.string().optional().describe("LLM model to use")
    }),
    execute: jtbdTool.execute
  });

  // Visualization
  server.tool("visualize", {
    description: "Generate visualizations from JTBDs and scenarios",
    parameters: z.object({
      source: z.string().describe("Source file with JTBDs and/or scenarios"),
      format: z.string().optional().describe("Output format (default: mermaid)"),
      output: z.string().optional().describe("Output file path")
    }),
    execute: visualizeTool.execute
  });

  logger.debug("MCP Tools registered");
}

// Register resources
function registerResources() {
  // Project configuration resource
  server.resource("config", new ResourceTemplate("config://", {
    load: async () => {
      return {
        contents: [
          {
            text: JSON.stringify(config.getConfig(), null, 2)
          }
        ]
      };
    }
  }));

  // More resources will be added as needed

  logger.debug("MCP Resources registered");
}

// Initialize the server by registering all tools and resources
try {
  registerTools();
  registerResources();
  logger.info("MCP Server initialized successfully");
} catch (error) {
  logger.error(`Failed to initialize MCP Server: ${error.message}`);
  throw error;
}

// Export the server instance
module.exports = server;