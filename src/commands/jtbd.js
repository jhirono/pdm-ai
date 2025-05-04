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
    // Add option for preserving existing clusters (default to false, meaning recreate clusters)
    const preserveExistingClusters = options.preserveClusters || false;
    
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
    
    // Load previous results for incremental processing if enabled
    let previousResults = null;
    
    if (incremental) {
      // Find most recent output file in the same directory as the target output
      const previousFile = options.previousFile || await findMostRecentOutput(outputFile);
      
      if (previousFile && fs.existsSync(previousFile)) {
        try {
          logger.info(`Loading previous results from ${previousFile} for incremental processing`);
          previousResults = await fs.readJson(previousFile);
          
          if (verbose && previousResults) {
            const prevJtbdCount = previousResults.jtbds?.length || 0;
            const prevScenarioCount = previousResults.scenarios?.length || 0;
            logger.debug(`Loaded ${prevJtbdCount} previous JTBDs and ${prevScenarioCount} previous scenarios`);
          }
        } catch (error) {
          logger.warn(`Failed to load previous results: ${error.message}`);
          logger.warn('Proceeding with incremental processing without previous results');
          previousResults = null;
        }
      } else {
        logger.warn(`No previous results file found for incremental processing`);
        logger.warn('Proceeding with incremental processing without previous results');
      }
    }
    
    // Set generation options
    const generationOptions = {
      layers,
      verbose,
      incremental,
      previousResults,
      preserveExistingClusters,
      layer1Threshold,
      layer2Threshold
    };
    
    if (verbose) {
      logger.debug(`Incremental processing: ${incremental}`);
      if (incremental) {
        logger.debug(`Preserve existing clusters: ${preserveExistingClusters}`);
      }
    }
    
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
      generatedAt: new Date().toISOString(),
      incremental: incremental,
      preservedClusters: incremental ? preserveExistingClusters : false,
      previousResultsFile: incremental && previousResults ? options.previousFile : null
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
      
      if (incremental && result.hierarchyInfo) {
        logger.debug(`- Previous JTBDs: ${result.hierarchyInfo.previousJTBDsCount}`);
        logger.debug(`- Mode: ${preserveExistingClusters ? 'Preserving existing clusters' : 'Creating new clusters'}`);
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
 * Find the most recent output file in the same directory as the target output
 * @param {string} outputFile - Target output file path
 * @returns {Promise<string|null>} Path to most recent output file or null if none found
 */
async function findMostRecentOutput(outputFile) {
  try {
    const outputDir = path.dirname(outputFile);
    const baseFilename = path.basename(outputFile).split('_')[0];
    
    // Check if directory exists
    if (!fs.existsSync(outputDir)) {
      return null;
    }
    
    // Get all files in the directory
    const files = await fs.readdir(outputDir);
    
    // Filter files matching the pattern and not the current output
    const matchingFiles = files
      .filter(file => file.startsWith(baseFilename) && file.includes('_jtbds_') && file !== path.basename(outputFile))
      .map(file => ({
        file,
        path: path.join(outputDir, file),
        mtime: fs.statSync(path.join(outputDir, file)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime);
    
    if (matchingFiles.length === 0) {
      return null;
    }
    
    // Return the most recent file
    return matchingFiles[0].path;
  } catch (error) {
    logger.warn(`Error finding previous output file: ${error.message}`);
    return null;
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