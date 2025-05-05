#!/usr/bin/env node

/**
 * PDM-AI MCP Server
 * 
 * This is the main entry point for the PDM-AI MCP server, which allows
 * interaction with PDM via the Model Context Protocol.
 */
const path = require('path');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const config = require('../utils/config');
const logger = require('../utils/logger');
const server = require('./server');

// Initialize server
async function main() {
  try {
    // Try to load configuration from multiple sources
    const currentDir = process.cwd();
    const projectManager = require('../utils/project-manager');
    const projectRoot = projectManager.findProjectRoot(currentDir);
    
    if (projectRoot) {
      config.loadProjectConfig(projectRoot);
      config.loadConfig(projectRoot);
    } else {
      // If not in a project, just try to load global config
      config.loadConfig();
    }

    // Set up transport (default to stdio for local development)
    const transport = new StdioServerTransport();
    
    // Connect the server to the transport
    await server.connect(transport);
    
    logger.info('PDM-AI MCP Server started');
  } catch (error) {
    console.error('Failed to start PDM-AI MCP Server:', error);
    process.exit(1);
  }
}

// Start the server
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});