// src/commands/consolidate.js
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const consolidationManager = require('../utils/consolidation/consolidation-manager');

/**
 * Add the consolidate command to the CLI program
 * @param {Object} program - Commander program instance
 */
function consolidateCommand(program) {
  program
    .command('consolidate')
    .description('Consolidate JTBDs and their related scenarios using JTBD-first approach')
    .argument('<input>', 'Input JSON file with parsed JTBDs/scenarios')
    .option('-o, --output <path>', 'Output file path for consolidated results (default: new file with timestamp)')
    .option('-th, --threshold <value>', 'Similarity threshold for JTBD clustering (0-1)', '0.7')
    .option('-sth, --scenario-threshold <value>', 'Similarity threshold for scenario clustering (0-1)', '0.7')
    .option('-m, --method <method>', 'Similarity method (semantic or keyword)', 'semantic')
    .option('-v, --verbose', 'Show detailed output during consolidation', false)
    .action(async (input, options) => {
      try {
        console.log(chalk.blue(`Consolidating JTBDs and scenarios in: ${input}`));
        
        // Validate input file exists
        const inputPath = path.resolve(process.cwd(), input);
        if (!fs.existsSync(inputPath)) {
          console.error(chalk.red(`Error: Input file does not exist: ${inputPath}`));
          process.exit(1);
        }
        
        // Determine output path if specified
        const outputPath = options.output 
          ? path.resolve(process.cwd(), options.output) 
          : null;  // Let the consolidation manager generate a default filename
        
        // Validate JTBD threshold value
        const threshold = parseFloat(options.threshold);
        if (isNaN(threshold) || threshold < 0 || threshold > 1) {
          console.error(chalk.red(`Error: JTBD threshold must be a number between 0 and 1`));
          process.exit(1);
        }
        
        // Validate scenario threshold value
        const scenarioThreshold = parseFloat(options.scenarioThreshold);
        if (isNaN(scenarioThreshold) || scenarioThreshold < 0 || scenarioThreshold > 1) {
          console.error(chalk.red(`Error: Scenario threshold must be a number between 0 and 1`));
          process.exit(1);
        }
        
        // Validate method
        if (!['semantic', 'keyword'].includes(options.method)) {
          console.error(chalk.red(`Error: Method must be 'semantic' or 'keyword'`));
          process.exit(1);
        }
        
        // Configure options for consolidation
        const consolidationOptions = {
          jtbdThreshold: threshold,
          scenarioThreshold: scenarioThreshold,
          method: options.method,
          verbose: options.verbose
        };
        
        console.log(chalk.blue(`Using ${options.method} method with JTBD threshold: ${threshold} and scenario threshold: ${scenarioThreshold}`));
        console.log(chalk.blue(`Output will be saved to a new file${outputPath ? ': ' + outputPath : ' with timestamp'}`));
        
        // Run consolidation process with JTBD-first approach
        const result = await consolidationManager.consolidateJTBDFirst(
          inputPath, 
          outputPath, 
          consolidationOptions
        );
        
        // Print summary
        const jtbdAbstractCount = result.consolidation?.jtbdConsolidation?.abstractItems || 0;
        const scenarioAbstractCount = result.consolidation?.scenarioConsolidation?.abstractItems || 0;
        const totalJtbdCount = result.jtbds.length;
        const totalScenarioCount = result.scenarios?.length || 0;
          
        console.log(chalk.green(`✓ Consolidation complete!`));
        console.log(chalk.green(`  - Generated ${jtbdAbstractCount} abstract JTBDs`));
        console.log(chalk.green(`  - Generated ${scenarioAbstractCount} abstract scenarios`));
        console.log(chalk.green(`  - Total JTBDs: ${totalJtbdCount}`));
        console.log(chalk.green(`  - Total scenarios: ${totalScenarioCount}`));
        
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
}

module.exports = consolidateCommand;