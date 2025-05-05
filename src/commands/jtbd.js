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
    let combinedScenarios = [...scenariosData.scenarios]; // Start with current scenarios
    
    if (incremental) {
      // Find most recent output file in the same directory as the target output
      const previousFile = options.previousFile || await findMostRecentOutput(outputFile);
      
      if (previousFile && fs.existsSync(previousFile)) {
        try {
          logger.info(`Loading previous results from ${previousFile} for incremental processing`);
          previousResults = await fs.readJson(previousFile);
          
          // Combine scenarios from previous results if they exist
          if (previousResults && previousResults.scenarios && Array.isArray(previousResults.scenarios)) {
            // Create a map of scenario IDs to avoid duplicates
            const scenarioMap = new Map();
            
            // Add new scenarios first
            combinedScenarios.forEach(scenario => {
              scenarioMap.set(scenario.id, scenario);
            });
            
            // Then add previous scenarios if not already included
            previousResults.scenarios.forEach(scenario => {
              if (!scenarioMap.has(scenario.id)) {
                scenarioMap.set(scenario.id, scenario);
              }
            });
            
            // Convert map back to array
            combinedScenarios = Array.from(scenarioMap.values());
            
            if (verbose) {
              const newScenariosCount = scenariosData.scenarios.length;
              const previousScenariosCount = previousResults.scenarios.length;
              const combinedCount = combinedScenarios.length;
              
              logger.debug(`Loaded ${previousScenariosCount} previous scenarios`);
              logger.debug(`Combined with ${newScenariosCount} new scenarios`);
              logger.debug(`Total unique scenarios to process: ${combinedCount}`);
            }
          }
          
          if (verbose && previousResults) {
            const prevJtbdCount = previousResults.jtbds?.length || 0;
            logger.debug(`Loaded ${prevJtbdCount} previous JTBDs`);
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
      combinedScenarios, // Use combined scenarios instead of just the new ones
      generationOptions
    );
    
    // Include all scenarios in the result for better integration with visualization
    result.scenarios = combinedScenarios;
    
    // Add metadata to track the source of the scenarios
    result.metadata = {
      ...result.metadata || {},
      sourceFile: input,
      previousSourceFile: incremental && previousResults ? previousResults.metadata?.sourceFile : null,
      combinedOutput: true,
      generatedAt: new Date().toISOString(),
      incremental: incremental,
      preservedClusters: incremental ? preserveExistingClusters : false,
      previousResultsFile: incremental && previousResults ? options.previousFile || previousFile : null,
      newScenariosCount: scenariosData.scenarios.length,
      previousScenariosCount: previousResults?.scenarios?.length || 0,
      totalScenariosCount: combinedScenarios.length
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
      logger.debug(`- Total scenarios processed: ${combinedScenarios.length}`);
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
 * or in alternative output directories
 * @param {string} outputFile - Target output file path
 * @returns {Promise<string|null>} Path to most recent output file or null if none found
 */
async function findMostRecentOutput(outputFile) {
  try {
    const outputDir = path.dirname(outputFile);
    const baseFilename = path.basename(outputFile).split('_')[0];
    
    // List of directories to search for previous outputs
    const searchDirectories = [
      outputDir, // The current output dir (.pdm/outputs/jtbds)
      path.join(process.cwd(), '.pdm', 'outputs', 'jtbds'), // In case we're not already looking at .pdm/outputs/jtbds
      path.join(process.cwd(), 'outputs', 'jtbds') // Old directory structure (backwards compatibility)
    ];
    
    // Remove duplicate directories
    const uniqueDirs = [...new Set(searchDirectories)];
    
    let allMatchingFiles = [];
    
    // Search each directory
    for (const dir of uniqueDirs) {
      // Skip if directory doesn't exist
      if (!fs.existsSync(dir)) {
        continue;
      }
      
      // Get all files in the directory
      const files = await fs.readdir(dir);
      
      // Filter files matching the pattern
      const matchingFiles = files
        .filter(file => {
          // Look for files that have a similar base name
          const fileBase = file.split('_')[0];
          return (
            // Base name contains our input file's base name or vice versa
            (fileBase.includes(baseFilename) || baseFilename.includes(fileBase)) &&
            // Must be a JTBD file
            file.includes('_jtbds_') &&
            // Don't include our current output file
            file !== path.basename(outputFile)
          );
        })
        .map(file => ({
          file,
          path: path.join(dir, file),
          mtime: fs.statSync(path.join(dir, file)).mtime
        }));
      
      allMatchingFiles = [...allMatchingFiles, ...matchingFiles];
    }
    
    // Sort all matching files by modification time (newest first)
    allMatchingFiles.sort((a, b) => b.mtime - a.mtime);
    
    if (allMatchingFiles.length === 0) {
      logger.debug(`No previous output files found in any of the search directories.`);
      return null;
    }
    
    // Log all found files if there are many
    if (allMatchingFiles.length > 1) {
      logger.debug(`Found ${allMatchingFiles.length} previous output files, using most recent: ${allMatchingFiles[0].path}`);
    } else {
      logger.debug(`Found previous output file: ${allMatchingFiles[0].path}`);
    }
    
    // Return the most recent file
    return allMatchingFiles[0].path;
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
  const outputDir = path.join(process.cwd(), '.pdm', 'outputs', 'jtbds');
  
  return path.join(outputDir, `${parsedPath.name.split('_')[0]}-jtbds.json`);
}

module.exports = {
  execute
};