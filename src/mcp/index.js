#!/usr/bin/env node

/**
 * PDM-AI MCP Server
 * 
 * This is the main entry point for the PDM-AI MCP server, which allows
 * interaction with PDM via the Model Context Protocol.
 */
const path = require('path');
const os = require('os');
require('dotenv').config(); // Load from current directory first

// Load from user's home directory if exists (doesn't override existing vars)
const userHome = os.homedir();
const pdmConfigDir = path.join(userHome, '.pdm');
require('dotenv').config({ path: path.join(pdmConfigDir, '.env'), override: false });

// Set default values for critical environment variables if not provided
process.env.LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o';
process.env.LLM_MAX_TOKENS = process.env.LLM_MAX_TOKENS || '4000';
process.env.LLM_TEMPERATURE = process.env.LLM_TEMPERATURE || '0.7';
process.env.LANGUAGE = process.env.LANGUAGE || 'en';

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

    logger.info('Starting PDM-AI MCP Server...');
    
    // Log environment information for debugging
    logger.debug(`Environment variables loaded:`);
    logger.debug(`  - LLM_MODEL: ${process.env.LLM_MODEL}`);
    logger.debug(`  - LLM_MAX_TOKENS: ${process.env.LLM_MAX_TOKENS}`);
    logger.debug(`  - LLM_TEMPERATURE: ${process.env.LLM_TEMPERATURE}`);
    logger.debug(`  - LANGUAGE: ${process.env.LANGUAGE}`);
    
    // Set up transport (default to stdio for local development)
    const transport = new StdioServerTransport();
    
    // Connect the server to the transport
    await server.connect(transport);
    
    logger.info('PDM-AI MCP Server started successfully');
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