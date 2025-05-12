// src/commands/jtbd.js
import fs from 'fs-extra';
import path from 'path';
import config from '../utils/config.js';
import logger from '../utils/logger.js';
import * as jtbdGenerator from '../utils/jtbd/jtbd-generator.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Execute the JTBD command to generate JTBDs from scenarios
 * @param {string} input - Input file(s) containing scenarios (comma-separated for multiple files)
 * @param {Object} options - Command options
 */
async function execute(input, options = {}) {
  try {
    // Split input by commas to support multiple files
    const inputFiles = input.split(',').map(file => file.trim());
    
    if (inputFiles.length > 1) {
      logger.info(`Starting JTBD generation from ${inputFiles.length} input files`);
    } else {
      logger.info(`Starting JTBD generation from ${input}`);
    }
    
    // Validate each input file exists
    for (const file of inputFiles) {
      if (!fs.existsSync(file)) {
        throw new Error(`Input file not found: ${file}`);
      }
    }
    
    // Set options
    const outputFile = options.output || getDefaultOutputPath(inputFiles[0]);
    const model = options.model || config.model || 'gpt-4o';
    const layers = options.layers || 1;
    const verbose = options.verbose || false;
    const layer1Threshold = options.threshold1 || null;
    const layer2Threshold = options.threshold2 || null;
    const useMock = options.mock || false;
    
    if (verbose) {
      logger.setLevel('debug');
      logger.debug('Verbose mode enabled');
    }
    
    if (useMock) {
      logger.info('Using mock mode for JTBD generation (no API calls will be made)');
    }
    
    // Load and combine scenarios from all input files
    let allScenarios = [];
    let sourceFiles = [];
    const scenarioMap = new Map();
    
    for (const file of inputFiles) {
      logger.info(`Loading scenarios from ${file}...`);
      const scenariosData = await fs.readJson(file);
      
      if (!scenariosData.scenarios || !Array.isArray(scenariosData.scenarios)) {
        throw new Error(`Invalid scenarios file ${file}: missing or invalid "scenarios" array`);
      }
      
      // Add scenarios to the map to ensure uniqueness by ID
      scenariosData.scenarios.forEach(scenario => {
        if (!scenarioMap.has(scenario.id)) {
          scenarioMap.set(scenario.id, scenario);
        }
      });
      
      sourceFiles.push(file);
      logger.info(`Loaded ${scenariosData.scenarios.length} scenarios from ${file}`);
    }
    
    // Convert map back to array
    allScenarios = Array.from(scenarioMap.values());
    logger.info(`Combined ${allScenarios.length} unique scenarios from ${inputFiles.length} files`);
    
    // Set generation options
    const generationOptions = {
      layers,
      verbose,
      layer1Threshold,
      layer2Threshold
    };
    
    // Generate JTBDs using our new adaptive clustering implementation
    // For mock mode, generate mock JTBDs instead
    let result;
    
    if (useMock) {
      // Generate mock JTBDs without making API calls
      result = generateMockJTBDs(allScenarios, layers);
      logger.info(`Generated ${result.jtbds.length} mock JTBDs for testing`);
    } else {
      // Use the real JTBD generator
      result = await jtbdGenerator.generateJTBDs(
        allScenarios,
        generationOptions
      );
    }
    
    // Include all scenarios in the result for better integration with visualization
    result.scenarios = allScenarios;
    
    // Add metadata to track the source of the scenarios
    result.metadata = {
      ...result.metadata || {},
      sourceFiles: sourceFiles,
      combinedOutput: inputFiles.length > 1,
      generatedAt: new Date().toISOString(),
      totalScenariosCount: allScenarios.length
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
      logger.debug(`- Total scenarios processed: ${allScenarios.length}`);
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
 * Generate mock JTBDs for testing purposes
 * @param {Array} scenarios - Scenarios to process
 * @param {number} layers - Number of layers for JTBD generation
 * @returns {Object} Mock JTBD result
 */
function generateMockJTBDs(scenarios, layers) {
  const mockJTBDs = scenarios.map((scenario, index) => ({
    id: uuidv4(),
    title: `Mock JTBD ${index + 1}`,
    description: `This is a mock JTBD for scenario ${scenario.id}`,
    layer: 1
  }));

  const result = {
    jtbds: mockJTBDs,
    hierarchyInfo: {
      layer1Count: mockJTBDs.length,
      layer2Count: layers > 1 ? Math.floor(mockJTBDs.length / 2) : 0
    }
  };

  return result;
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

export { execute };