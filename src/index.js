#!/usr/bin/env node

/**
 * PDM-AI - A CLI tool for transforming customer feedback into structured product insights
 * using the Jobs-to-be-Done (JTBD) methodology
 */
const { program } = require('commander');
const path = require('path');
const fs = require('fs-extra');
const init = require('./commands/init');
const scenario = require('./commands/scenario');
const jtbd = require('./commands/jtbd');
const visualize = require('./commands/visualize');
const config = require('./utils/config');
const logger = require('./utils/logger');
const projectManager = require('./utils/project-manager');

// Try to load configuration from multiple sources
// First check for project-specific config based on current directory
const currentDir = process.cwd();
const projectRoot = projectManager.findProjectRoot(currentDir);
if (projectRoot) {
  config.loadProjectConfig(projectRoot);
  config.loadConfig(projectRoot);
} else {
  // If not in a project, just try to load global config
  config.loadConfig();
}

// Set up the CLI
program
  .name('pdm')
  .description('PDM-AI: Transform customer feedback into structured product insights')
  .version('0.1.0');

// Init command
program
  .command('init')
  .description('Initialize a new PDM project structure')
  .option('-n, --name <name>', 'Project name (defaults to directory name)')
  .option('-d, --dir <directory>', 'Project directory (defaults to current directory)')
  .action((options) => {
    init(options.name, options.dir);
  });

// Scenario command
program
  .command('scenario')
  .description('Extract user scenarios from input text files')
  .argument('<source>', 'Source file or directory to process')
  .option('-o, --output <path>', 'Output file path')
  .option('-r, --recursive', 'Process directories recursively')
  .option('-m, --model <model>', 'LLM model to use')
  .option('-v, --verbose', 'Enable verbose output')
  .action((source, options) => {
    scenario.execute(source, options);
  });

// JTBD command
program
  .command('jtbd')
  .description('Generate JTBDs from user scenarios through adaptive clustering')
  .argument('<input>', 'Input file containing scenarios')
  .option('-o, --output <path>', 'Output file path')
  .option('-m, --model <model>', 'LLM model to use')
  .option('-l, --layers <number>', 'Number of abstraction layers (1 or 2)', parseInt)
  .option('-i, --incremental', 'Enable incremental mode to update existing JTBDs')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-t1, --threshold1 <number>', 'Force layer 1 clustering threshold (0.0-1.0)', parseFloat)
  .option('-t2, --threshold2 <number>', 'Force layer 2 clustering threshold (0.0-1.0)', parseFloat)
  .option('-c, --preserve-clusters', 'In incremental mode, preserve existing clusters instead of creating new ones')
  .option('-p, --previous-file <path>', 'Explicitly specify previous JTBD file for incremental mode')
  .action((input, options) => {
    jtbd.execute(input, options).catch(err => {
      logger.error(err.message);
      process.exit(1);
    });
  });

// Visualize command
program
  .command('visualize')
  .description('Create visual representations of JTBDs and scenarios')
  .argument('<input>', 'Input JSON file with JTBDs and scenarios')
  .option('-f, --format <format>', 'Output format (mermaid, csv)', 'mermaid')
  .option('-p, --perspective <perspective>', 'Visualization perspective (jtbd, persona)', 'jtbd')
  .option('-o, --output <path>', 'Output file path')
  .option('-q, --filter <query>', 'Filter entities by text match')
  .option('-m, --max-nodes <number>', 'Maximum number of nodes to display', '100')
  .option('-v, --verbose', 'Show detailed processing output', false)
  .action((input, options) => {
    visualize.execute(input, options).catch(err => {
      logger.error(err.message);
      process.exit(1);
    });
  });

// MCP Server command
program
  .command('mcp')
  .description('Start the Model Context Protocol server for LLM chat integration')
  .option('-p, --port <number>', 'Port number for HTTP transport (defaults to stdio if not specified)')
  .option('-t, --transport <type>', 'Transport type (stdio or http)', 'stdio')
  .option('-v, --verbose', 'Enable verbose logging')
  .action((options) => {
    // Set verbosity level before loading the MCP server
    if (options.verbose) {
      process.env.LOG_LEVEL = 'debug';
    }
    
    // Use dynamic import to load the MCP server only when needed
    try {
      const mcpPath = path.join(__dirname, 'mcp', 'index.js');
      // For HTTP transport, we'll need to implement that option in the future
      if (options.transport === 'http') {
        logger.info(`HTTP transport not yet implemented. Using stdio transport.`);
      }
      
      // Execute the MCP server script
      require(mcpPath);
      
    } catch (error) {
      logger.error(`Failed to start MCP server: ${error.message}`);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// If no arguments provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}