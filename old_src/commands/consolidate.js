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
    .description('Consolidate JTBDs using semantic clustering')
    .argument('<input>', 'Input JSON file with parsed JTBDs')
    .option('-o, --output <path>', 'Output file path for consolidated results (default: new file with timestamp)')
    .option('-th, --threshold <value>', 'Similarity threshold for JTBD clustering (0-1)', '0.5')
    .option('-m, --method <method>', 'Similarity method (semantic or keyword)', 'semantic')
    .option('-v, --verbose', 'Show detailed output during consolidation', false)
    .action(async (input, options) => {
      try {
        console.log(chalk.blue(`Consolidating JTBDs in: ${input}`));
        
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
        
        // Validate method
        if (!['semantic', 'keyword'].includes(options.method)) {
          console.error(chalk.red(`Error: Method must be 'semantic' or 'keyword'`));
          process.exit(1);
        }
        
        // Configure options for consolidation
        const consolidationOptions = {
          threshold: threshold,
          method: options.method,
          verbose: options.verbose
        };
        
        console.log(chalk.blue(`Using ${options.method} method with JTBD threshold: ${threshold}`));
        console.log(chalk.blue(`Output will be saved to a new file${outputPath ? ': ' + outputPath : ' with timestamp'}`));
        
        // Run consolidation process for JTBDs only
        const result = await consolidationManager.consolidateJTBDs(
          inputPath, 
          outputPath, 
          consolidationOptions
        );
        
        // Print summary
        const jtbdAbstractCount = result.consolidation?.abstractItems || 0;
        const totalJtbdCount = result.jtbds.length;
          
        console.log(chalk.green(`✓ Consolidation complete!`));
        console.log(chalk.green(`  - Generated ${jtbdAbstractCount} abstract JTBDs`));
        console.log(chalk.green(`  - Total JTBDs: ${totalJtbdCount}`));
        
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
}

module.exports = consolidateCommand;