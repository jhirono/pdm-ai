/**
 * PDM-AI MCP Server Implementation
 * 
 * Defines the MCP server and registers available tools, resources, and prompts.
 * Also includes adapter functions to bridge between MCP tools and existing commands.
 */
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { z } = require('zod');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const config = require('../utils/config');
const logger = require('../utils/logger');
const pkg = require('../../package.json');

// Import existing command implementations
const init = require('../commands/init');
const scenario = require('../commands/scenario');
const jtbd = require('../commands/jtbd');
const visualize = require('../commands/visualize');
const projectManager = require('../utils/project-manager');

// Create the MCP server
const server = new McpServer({
  name: "pdm-ai",
  version: pkg.version,
  instructions: "PDM-AI helps transform customer feedback into structured product insights using Jobs-to-be-Done (JTBD) methodology."
});

/**
 * Gets the appropriate project context for MCP commands
 * Creates a temporary project if not running in an existing PDM project
 */
function getProjectContext() {
  const currentDir = process.cwd();
  const projectRoot = projectManager.findProjectRoot(currentDir);
  
  if (projectRoot) {
    return { 
      isTemporary: false, 
      projectRoot,
      outputDir: path.join(projectRoot, '.pdm', 'outputs')
    };
  } else {
    // Create temporary project context
    const tmpDir = path.join(os.tmpdir(), `pdm-mcp-${Date.now()}`);
    fs.ensureDirSync(tmpDir);
    
    const tempProjectDir = path.join(tmpDir, '.pdm');
    fs.ensureDirSync(tempProjectDir);
    fs.ensureDirSync(path.join(tempProjectDir, 'outputs'));
    fs.ensureDirSync(path.join(tempProjectDir, 'inputs'));
    
    logger.info(`Created temporary project at ${tmpDir} for MCP operation`);
    
    return {
      isTemporary: true,
      projectRoot: tmpDir,
      outputDir: path.join(tempProjectDir, 'outputs'),
      cleanup: () => fs.removeSync(tmpDir)
    };
  }
}

// Register all tools
function registerTools() {
  // Project initialization
  server.tool("initProject", {
    description: "Initialize a new PDM project structure",
    parameters: z.object({
      name: z.string().optional().describe("Project name (defaults to directory name)"),
      directory: z.string().optional().describe("Project directory (defaults to current directory)")
    }),
    execute: async (params) => {
      try {
        const projectName = params.name;
        const projectDir = params.directory || process.cwd();
        
        logger.info(`MCP: Initializing project "${projectName || 'unnamed'}" in directory "${projectDir}"`);
        
        // Call the existing initialization command
        const result = await init(projectName, projectDir);
        
        return {
          success: true,
          projectName: result.projectName,
          projectDir: result.projectDir,
          message: `Successfully initialized PDM project "${result.projectName}" at ${result.projectDir}`
        };
      } catch (error) {
        logger.error(`MCP init error: ${error.message}`);
        return {
          success: false,
          error: error.message
        };
      }
    }
  });

  // Scenario parsing
  server.tool("parseScenarios", {
    description: "Extract user scenarios from input text files",
    parameters: z.object({
      source: z.string().describe("Source file or directory to process"),
      content: z.string().optional().describe("Direct content to parse instead of a file"),
      output: z.string().optional().describe("Output file path"),
      recursive: z.boolean().optional().describe("Process directories recursively"),
      model: z.string().optional().describe("LLM model to use")
    }),
    execute: async (params) => {
      try {
        // If we're directly given content, we need to save it to a temp file first
        let source = params.source;
        let tempFile = null;
        let projectContext = null;
        
        if (params.content) {
          projectContext = getProjectContext();
          const timestamp = Date.now();
          tempFile = path.join(projectContext.projectRoot, `.pdm`, `inputs`, `mcp-content-${timestamp}.txt`);
          await fs.writeFile(tempFile, params.content);
          source = tempFile;
          logger.info(`Saved content to temporary file: ${tempFile}`);
        }
        
        const options = {
          output: params.output,
          recursive: !!params.recursive,
          model: params.model,
          verbose: true
        };
        
        logger.info(`MCP: Parsing scenarios from "${source}" with options: ${JSON.stringify(options)}`);
        
        // Call the existing scenario command
        const result = await scenario.execute(source, options);
        
        // Clean up temp file if we created one
        if (tempFile) {
          await fs.remove(tempFile);
          if (projectContext.isTemporary && projectContext.cleanup) {
            projectContext.cleanup();
          }
        }
        
        return {
          success: true,
          source,
          scenarios: result.scenarios || [],
          outputPath: result.outputPath,
          message: `Successfully extracted ${(result.scenarios || []).length} scenarios from ${source}`
        };
      } catch (error) {
        logger.error(`MCP scenario error: ${error.message}`);
        return {
          success: false,
          error: error.message
        };
      }
    }
  });

  // JTBD generation
  server.tool("generateJtbds", {
    description: "Generate Jobs-to-be-Done from user scenarios",
    parameters: z.object({
      source: z.string().describe("Source file with user scenarios"),
      output: z.string().optional().describe("Output file path"),
      model: z.string().optional().describe("LLM model to use")
    }),
    execute: async (params) => {
      try {
        const options = {
          output: params.output,
          model: params.model,
          verbose: true
        };
        
        logger.info(`MCP: Generating JTBDs from scenarios in "${params.source}" with options: ${JSON.stringify(options)}`);
        
        // Call the existing JTBD command
        const result = await jtbd.execute(params.source, options);
        
        return {
          success: true,
          source: params.source,
          jtbds: result.jtbds || [],
          outputPath: result.outputPath,
          message: `Successfully generated ${(result.jtbds || []).length} JTBDs from scenarios in ${params.source}`
        };
      } catch (error) {
        logger.error(`MCP JTBD error: ${error.message}`);
        return {
          success: false,
          error: error.message
        };
      }
    }
  });

  // Visualization
  server.tool("visualize", {
    description: "Generate visualizations from JTBDs and scenarios",
    parameters: z.object({
      source: z.string().describe("Source file with JTBDs and/or scenarios"),
      format: z.string().optional().describe("Output format (default: mermaid)"),
      output: z.string().optional().describe("Output file path")
    }),
    execute: async (params) => {
      try {
        const options = {
          format: params.format || 'mermaid',
          output: params.output,
          verbose: true
        };
        
        logger.info(`MCP: Generating visualization from "${params.source}" with format "${options.format}"`);
        
        // Call the existing visualization command
        const result = await visualize.execute(params.source, options);
        
        return {
          success: true,
          source: params.source,
          format: options.format,
          visualizationData: result.visualizationData,
          outputPath: result.outputPath,
          message: `Successfully generated ${options.format} visualization from ${params.source}`
        };
      } catch (error) {
        logger.error(`MCP visualization error: ${error.message}`);
        return {
          success: false,
          error: error.message
        };
      }
    }
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