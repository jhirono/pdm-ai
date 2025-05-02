/**
 * Visualization command for PDM
 * Generates visual representations of JTBDs and scenarios
 */

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

/**
 * Generate a default output filename based on the input file and format
 * @param {string} inputFile - Path to input file
 * @param {string} format - Output format (mermaid, cytoscape, png, svg)
 * @returns {string} Default output filename
 */
function generateDefaultOutputFilename(inputFile, format) {
  const baseName = path.basename(inputFile, path.extname(inputFile));
  const extension = format === 'cytoscape' ? 'html' : format;
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  return path.join(process.cwd(), 'output', `${baseName}_visualized_${timestamp}.${extension}`);
}

/**
 * Add the visualize command to the CLI program
 * @param {Object} program - Commander program instance
 */
function visualizeCommand(program) {
  program
    .command('visualize')
    .description('Visualize JTBDs and scenarios relationships')
    .argument('<input>', 'Input JSON file with parsed/consolidated JTBDs/scenarios')
    .option('-f, --format <format>', 'Output format (mermaid, cytoscape, png, svg)', 'mermaid')
    .option('-v, --view <view>', 'Visualization perspective (jtbd, persona, priority, source)', 'jtbd')
    .option('-o, --output <path>', 'Output file path')
    .option('-a, --abstract-only', 'Only show abstract JTBDs (not applied to scenarios)', false)
    .option('-i, --include-independent', 'Include independent scenarios not part of any abstraction', true)
    .option('-l, --include-level <level>', 'Maximum abstraction level to include')
    .option('--filter <query>', 'Filter entities by text or attribute match')
    .option('-m, --max-nodes <number>', 'Maximum number of nodes to display', '100')
    .option('-c, --cluster <attribute>', 'Cluster nodes by attribute (e.g., priority, source)')
    .option('-h, --highlight <id>', 'Highlight specific node and its connections')
    .option('--scenario-abstraction <mode>', 'How to handle scenario abstractions (both, abstract-only, independent-only)', 'both')
    .action(async (input, options) => {
      try {
        console.log(chalk.blue(`Generating visualization from: ${input}`));
        console.log(chalk.blue(`Using format: ${options.format}, view: ${options.view}`));
        
        // Validate input file exists
        const inputPath = path.resolve(process.cwd(), input);
        if (!fs.existsSync(inputPath)) {
          console.error(chalk.red(`Error: Input file does not exist: ${inputPath}`));
          process.exit(1);
        }
        
        // Determine output path
        const outputPath = options.output 
          ? path.resolve(process.cwd(), options.output) 
          : generateDefaultOutputFilename(inputPath, options.format);
        
        console.log(chalk.blue(`Output will be saved to: ${outputPath}`));
        
        // Read input file
        const inputData = await fs.readJson(inputPath);
        
        // Validate input has required structure
        if (!inputData.jtbds || !Array.isArray(inputData.jtbds)) {
          console.error(chalk.red(`Error: Input file doesn't contain valid JTBD data`));
          process.exit(1);
        }
        
        // Prepare visualization options
        const visualizationOptions = {
          format: options.format,
          view: options.view,
          abstractOnly: options.abstractOnly,
          includeIndependent: options.includeIndependent,
          includeLevel: options.includeLevel ? parseInt(options.includeLevel, 10) : undefined,
          filter: options.filter,
          maxNodes: parseInt(options.maxNodes, 10),
          cluster: options.cluster,
          highlight: options.highlight,
          scenarioAbstraction: options.scenarioAbstraction
        };
        
        // Generate visualization based on format
        let result;
        
        // Import visualization modules based on format (Phase 1: only mermaid)
        const visualization = require('../utils/visualization');
        
        console.log(chalk.blue(`Building ${options.view}-centric visualization...`));
        
        result = await visualization.generateVisualization(inputData, visualizationOptions);
        
        // Ensure output directory exists
        await fs.ensureDir(path.dirname(outputPath));
        
        // Write output to file
        await fs.writeFile(outputPath, result.content);
        
        console.log(chalk.green(`✓ Visualization generated successfully!`));
        console.log(chalk.green(`  - Format: ${options.format}`));
        console.log(chalk.green(`  - View: ${options.view}`));
        console.log(chalk.green(`  - Nodes rendered: ${result.stats.nodeCount}`));
        console.log(chalk.green(`  - Edges rendered: ${result.stats.edgeCount}`));
        console.log(chalk.green(`  - Output file: ${outputPath}`));
        
        if (options.format === 'mermaid') {
          console.log(chalk.yellow(`\nTo view the Mermaid diagram, paste the contents into a Markdown viewer that supports Mermaid syntax.`));
        } else if (options.format === 'cytoscape') {
          console.log(chalk.yellow(`\nTo view the Cytoscape visualization, open the generated HTML file in a web browser.`));
        }
        
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        console.error(error.stack);
        process.exit(1);
      }
    });
}

module.exports = visualizeCommand;