/**
 * PDM-AI Scenario Command
 * Extract user scenarios from source files or directories
 */
const path = require('path');
const fs = require('fs-extra');
const fileHandler = require('../utils/parsers/file-handler');
const scenarioParser = require('../utils/parsers/scenario-parser');
const mockScenarioParser = require('../utils/parsers/mock-scenario-parser');
const config = require('../utils/config');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Extract scenarios from source files or directories
 * @param {string} source - Path to source file or directory
 * @param {Object} options - Command options
 * @returns {Promise<void>}
 */
async function extractScenarios(source, options) {
  try {
    logger.info(`Starting scenario extraction from ${source}`);
    logger.debug(`Options: ${JSON.stringify(options)}`);

    // Set custom model if provided
    if (options.model) {
      // Just set the model directly in the environment variable
      // This avoids using config.updateConfig which doesn't exist
      if (options.model) {
        process.env.LLM_MODEL = options.model;
        logger.debug(`Using custom model: ${options.model}`);
      }
    }
    
    // Use mock parser for testing if specified
    const parser = options.mock ? mockScenarioParser : scenarioParser;
    logger.debug(`Using ${options.mock ? 'mock' : 'real'} scenario parser`);
    
    // Process source file or directory
    const sourcePaths = Array.isArray(source) ? source : [source];
    let allSources = [];
    
    for (const sourcePath of sourcePaths) {
      const resolvedPath = path.resolve(sourcePath);
      logger.debug(`Processing source path: ${resolvedPath}`);
      
      const sources = await fileHandler.processSource(resolvedPath, options.recursive);
      allSources = allSources.concat(sources);
    }
    
    logger.info(`Found ${allSources.length} source files to process`);
    
    if (allSources.length === 0) {
      logger.warn('No valid source files found');
      return;
    }
    
    // Process each source and extract scenarios
    const results = {
      sources: [],
      scenarios: []
    };
    
    for (let i = 0; i < allSources.length; i++) {
      const source = allSources[i];
      logger.info(`Processing ${i + 1}/${allSources.length}: ${source.name}`);
      
      try {
        const extractedScenarios = await parser.extractScenarios(source.content, source);
        
        // Add source info and scenarios to results
        // Remove content field from source to reduce output size
        const { content, ...sourceWithoutContent } = source;
        results.sources.push(sourceWithoutContent);
        results.scenarios = results.scenarios.concat(extractedScenarios);
        
        logger.info(`Extracted ${extractedScenarios.length} scenarios from ${source.name}`);
      } catch (error) {
        logger.error(`Error processing ${source.name}: ${error.message}`);
        if (options.verbose) {
          logger.debug(error.stack);
        }
      }
    }
    
    // Save results to output file
    const outputFile = options.output || generateOutputFilename(source);
    const outputDir = path.dirname(outputFile);
    
    // Create output directory if it doesn't exist
    await fs.ensureDir(outputDir);
    
    // Add version metadata
    const metadata = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      sourceCount: results.sources.length,
      scenarioCount: results.scenarios.length
    };
    
    const outputData = {
      metadata,
      ...results
    };
    
    // Write output file
    await fs.writeJSON(outputFile, outputData, { spaces: 2 });
    logger.info(`Saved ${results.scenarios.length} scenarios to ${outputFile}`);
    
    return outputFile;
  } catch (error) {
    logger.error(`Error in scenario extraction: ${error.message}`);
    if (options.verbose) {
      logger.debug(error.stack);
    }
    throw error;
  }
}

/**
 * Generate an output filename based on source path
 * @param {string} source - Source path
 * @returns {string} - Output filename
 */
function generateOutputFilename(source) {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  let baseName;
  
  if (Array.isArray(source)) {
    // If multiple sources, use a generic name
    baseName = 'multiple_sources';
  } else {
    // For single source, use the source name
    baseName = path.basename(source, path.extname(source));
  }
  
  return path.resolve(`./outputs/scenarios/${baseName}_scenarios_${timestamp}.json`);
}

/**
 * Execute the scenario command
 * @param {string} source - Path to source file or directory
 * @param {Object} options - Command options
 * @returns {Promise<void>}
 */
async function execute(source, options = {}) {
  try {
    // Set log level based on verbose flag
    if (options.verbose) {
      logger.setLevel('debug');
    }
    
    return await extractScenarios(source, options);
  } catch (error) {
    logger.error(`Failed to execute scenario command: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  execute
};