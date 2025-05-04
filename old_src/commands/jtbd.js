// src/commands/jtbd.js
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const config = require('../utils/config');
const jtbdGenerator = require('../utils/jtbd/jtbd-generator');
const jtbdClustering = require('../utils/consolidation/jtbd-clustering');

/**
 * Generates a default output filename based on the input file
 * @param {string} inputFile - Path to input file
 * @returns {string} Default output filename
 */
function generateDefaultOutputFilename(inputFile) {
  const baseName = path.basename(inputFile, path.extname(inputFile));
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  return path.join(process.cwd(), 'output', `${baseName}_jtbds_${timestamp}.json`);
}

/**
 * Generate a unique JTBD ID
 * @param {number} index - Index to use for ID generation
 * @returns {string} A unique JTBD ID
 */
function generateUniqueJtbdId(index) {
  return `jtbd-${String(index + 1).padStart(3, '0')}`;
}

/**
 * Add the JTBD command to the CLI program
 * @param {Object} program - Commander program instance
 */
function jtbdCommand(program) {
  program
    .command('jtbd')
    .description('Generate Jobs-to-be-Done (JTBDs) by clustering user scenarios')
    .argument('<input>', 'Input JSON file with user scenarios')
    .option('-o, --output <path>', 'Output file path for JTBDs')
    .option('-t, --threshold <value>', 'Clustering threshold (0-1)', '0.5')
    .option('-m, --model <model>', 'LLM model to use (defaults to value in .env)', process.env.LLM_MODEL || config.model)
    .option('-l, --language <language>', 'Language to use (en or ja)', process.env.LANGUAGE || 'en')
    .option('-v, --verbose', 'Show detailed output during processing', false)
    .option('-p, --preserve-scenarios', 'Preserve original scenarios in output', true)
    .action(async (input, options) => {
      try {
        console.log(chalk.blue(`Generating JTBDs from scenarios in: ${input}`));
        console.log(chalk.blue(`Using model: ${options.model}, language: ${options.language}`));
        console.log(chalk.blue(`Clustering threshold: ${options.threshold}`));
        
        // Override config with command-line options
        config.model = options.model;
        config.language = options.language;
        
        const inputPath = path.resolve(process.cwd(), input);
        
        // Check if input exists
        if (!fs.existsSync(inputPath)) {
          console.error(chalk.red(`Error: Input file does not exist: ${inputPath}`));
          process.exit(1);
        }
        
        // Read input file
        const inputData = await fs.readJson(inputPath);
        
        // Validate input has scenarios
        if (!inputData.scenarios || !Array.isArray(inputData.scenarios) || inputData.scenarios.length === 0) {
          console.error(chalk.red(`Error: Input file doesn't contain any scenarios`));
          process.exit(1);
        }
        
        console.log(chalk.blue(`Found ${inputData.scenarios.length} scenarios to process`));
        
        // Cluster scenarios
        console.log(chalk.blue(`Clustering scenarios with threshold ${options.threshold}...`));
        const clusters = await jtbdClustering.clusterScenarios(inputData.scenarios, { 
          threshold: parseFloat(options.threshold),
          verbose: options.verbose 
        });
        
        console.log(chalk.green(`Created ${clusters.length} clusters from ${inputData.scenarios.length} scenarios`));
        
        // Generate JTBDs for each cluster
        console.log(chalk.blue(`Generating JTBDs from scenario clusters...`));
        const jtbds = [];
        let processedCount = 0;
        
        for (const [index, cluster] of clusters.entries()) {
          if (options.verbose) {
            console.log(chalk.gray(`Processing cluster ${index + 1}/${clusters.length} with ${cluster.length} scenarios...`));
          } else if (index % 5 === 0 || index === clusters.length - 1) {
            process.stdout.write(`\rProcessing JTBDs: ${Math.round((index + 1) / clusters.length * 100)}%`);
          }
          
          try {
            // Only generate JTBDs for clusters with at least 2 scenarios
            // or if we're processing a single scenario (for complete coverage)
            if (cluster.length >= 2 || clusters.length === 1) {
              const jtbd = await jtbdGenerator.generateJTBDFromScenarios(cluster);
              
              if (jtbd) {
                // Assign a unique ID to the JTBD, overriding any ID from the LLM
                jtbd.id = generateUniqueJtbdId(index);
                
                // Add relationship to scenarios
                jtbd.relatedScenarios = cluster.map(scenario => scenario.id);
                
                // Add hierarchical structure fields with default values
                jtbd.parentId = null;
                jtbd.childIds = [];
                jtbd.isAbstract = false;
                jtbd.level = 1;
                
                // Add sources from all related scenarios
                jtbd.sources = [...new Set(cluster.flatMap(scenario => scenario.sources || []))];
                
                jtbds.push(jtbd);
                processedCount++;
              }
            }
          } catch (error) {
            console.error(chalk.yellow(`Error processing cluster ${index + 1}: ${error.message}`));
          }
        }
        
        console.log(`\n${chalk.green(`Generated ${processedCount} JTBDs from ${clusters.length} clusters`)}`);
        
        // Update scenario relationships to point to new JTBDs
        const scenarioRelationships = new Map();
        
        jtbds.forEach(jtbd => {
          if (jtbd.relatedScenarios) {
            jtbd.relatedScenarios.forEach(scenarioId => {
              if (!scenarioRelationships.has(scenarioId)) {
                scenarioRelationships.set(scenarioId, []);
              }
              scenarioRelationships.get(scenarioId).push(jtbd.id);
            });
          }
        });
        
        // Update the scenarios with relationships to JTBDs
        inputData.scenarios.forEach(scenario => {
          if (scenarioRelationships.has(scenario.id)) {
            scenario.relatedJtbds = scenarioRelationships.get(scenario.id);
          }
        });
        
        // Prepare output data
        const outputData = {
          project: inputData.project || path.basename(inputPath, path.extname(inputPath)),
          timestamp: new Date().toISOString(),
          sources: inputData.sources || [],
          jtbds: jtbds,
          scenarios: options.preserveScenarios ? inputData.scenarios : []
        };
        
        // Determine output path
        const outputPath = options.output || generateDefaultOutputFilename(inputPath);
        
        // Ensure output directory exists
        fs.ensureDirSync(path.dirname(outputPath));
        
        // Write output file
        await fs.writeJson(outputPath, outputData, { spaces: 2 });
        
        console.log(chalk.green(`✓ Results written to: ${outputPath}`));
        console.log(chalk.green(`Generated ${jtbds.length} JTBDs from ${inputData.scenarios.length} scenarios`));
        
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        console.error(error.stack);
        process.exit(1);
      }
    });
}

module.exports = jtbdCommand;