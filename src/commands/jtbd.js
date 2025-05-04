// src/commands/jtbd.js
const fs = require('fs-extra');
const path = require('path');
const config = require('../utils/config');
const logger = require('../utils/logger');
const jtbdGenerator = require('../utils/jtbd/jtbd-generator');

/**
 * Execute the JTBD command to generate JTBDs from scenarios
 * @param {string} input - Input file containing scenarios
 * @param {Object} options - Command options
 */
async function execute(input, options) {
  try {
    logger.info(`Starting JTBD generation from ${input}`);
    
    // Validate input file exists
    if (!fs.existsSync(input)) {
      throw new Error(`Input file not found: ${input}`);
    }
    
    // Set options
    const outputFile = options.output || getDefaultOutputPath(input);
    const model = options.model || config.model || 'gpt-4o';
    const layers = options.layers || 1;
    const incremental = options.incremental || false;
    const verbose = options.verbose || false;
    const layer1Threshold = options.threshold1 || null;
    const layer2Threshold = options.threshold2 || null;
    
    // Apply options to config
    config.model = model;
    
    if (verbose) {
      logger.setLevel('debug');
      logger.debug('Verbose mode enabled');
    }
    
    // Load scenarios from input file
    logger.info(`Loading scenarios from ${input}...`);
    const scenariosData = await fs.readJson(input);
    
    if (!scenariosData.scenarios || !Array.isArray(scenariosData.scenarios)) {
      throw new Error('Invalid scenarios file: missing or invalid "scenarios" array');
    }
    
    logger.info(`Loaded ${scenariosData.scenarios.length} scenarios`);
    
    // Set generation options
    const generationOptions = {
      layers,
      verbose,
      incremental,
      layer1Threshold,
      layer2Threshold
    };
    
    // Generate JTBDs using our new adaptive clustering implementation
    const result = await jtbdGenerator.generateJTBDs(
      scenariosData.scenarios, 
      generationOptions
    );
    
    // Include the original scenarios in the result for better integration with visualization
    result.scenarios = scenariosData.scenarios;
    
    // Add metadata to track the source of the scenarios
    result.metadata = {
      ...result.metadata || {},
      sourceFile: input,
      combinedOutput: true,
      generatedAt: new Date().toISOString()
    };
    
    // Ensure output directory exists
    const outputDir = path.dirname(outputFile);
    await fs.ensureDir(outputDir);
    
    // Write output file
    logger.info(`Writing ${result.jtbds.length} JTBDs and ${result.scenarios.length} scenarios to ${outputFile}`);
    await fs.writeJson(outputFile, result, { spaces: 2 });
    
    // Generate summary
    if (verbose) {
      logger.debug(`JTBD generation complete:`);
      logger.debug(`- Total scenarios processed: ${scenariosData.scenarios.length}`);
      logger.debug(`- Total JTBDs generated: ${result.jtbds.length}`);
      logger.debug(`- Combined output file includes both JTBDs and scenarios`);
      
      if (layers > 1 && result.hierarchyInfo) {
        logger.debug(`- Layer 1 JTBDs: ${result.hierarchyInfo.layer1Count}`);
        logger.debug(`- Layer 2 JTBDs: ${result.hierarchyInfo.layer2Count}`);
      }
    }
    
    logger.info(`JTBD generation complete. Results saved to ${outputFile}`);
    return result;
    
  } catch (error) {
    logger.error(`Error generating JTBDs: ${error.message}`);
    throw error;
  }
}

/**
 * Generate default output path based on input file
 * @param {string} inputFile - Input file path
 * @returns {string} Default output file path
 */
function getDefaultOutputPath(inputFile) {
  const parsedPath = path.parse(inputFile);
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const outputDir = path.join(process.cwd(), 'outputs', 'jtbds');
  
  return path.join(outputDir, `${parsedPath.name.split('_')[0]}_jtbds_${timestamp}.json`);
}

module.exports = {
  execute
};