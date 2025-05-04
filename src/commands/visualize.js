/**
 * Visualization command for PDM-AI
 * Generates visual representations of JTBDs and scenarios
 */

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const visualization = require('../utils/visualization');

/**
 * Generate a default output filename based on the input file and format
 * @param {string} inputFile - Path to input file
 * @param {string} format - Output format (mermaid, figma, miro)
 * @returns {string} Default output filename
 */
function generateDefaultOutputFilename(inputFile, format) {
  const baseName = path.basename(inputFile, path.extname(inputFile));
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const extension = format === 'mermaid' ? 'md' : format;
  return path.join(process.cwd(), 'outputs', 'visualizations', `${baseName}_viz_${timestamp}.${extension}`);
}

/**
 * Execute the visualize command
 * @param {string} input - Input JSON file with JTBDs and scenarios
 * @param {Object} options - Command options
 */
async function execute(input, options) {
  try {
    const verbose = options.verbose;
    if (verbose) {
      console.log(chalk.blue(`Generating visualization from: ${input}`));
      console.log(chalk.blue(`Using format: ${options.format}, view: ${options.view}`));
    }
    
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
    
    if (verbose) {
      console.log(chalk.blue(`Output will be saved to: ${outputPath}`));
    }
    
    // Read input file
    const inputData = await fs.readJson(inputPath);
    let dataToVisualize = inputData;
    
    // Check if the file has the expected structure
    // For JTBD view, we need both JTBDs and scenarios
    if (options.view === 'jtbd') {
      // Check if we have JTBD data
      if (!inputData.jtbds || !Array.isArray(inputData.jtbds) || inputData.jtbds.length === 0) {
        console.error(chalk.red(`Error: Input file doesn't contain valid JTBD data for JTBD view`));
        process.exit(1);
      }
      
      // Check if we already have scenario data in the same file (new format)
      if (!inputData.scenarios || !Array.isArray(inputData.scenarios) || inputData.scenarios.length === 0) {
        console.error(chalk.red(`Error: Input file doesn't contain scenario data, which is required for JTBD view`));
        console.error(chalk.red(`Use the updated 'pdm jtbd' command to generate files that include both JTBDs and scenarios`));
        process.exit(1);
      }
    } else if (options.view === 'persona') {
      // For persona view, we only need scenarios
      if (!inputData.scenarios || !Array.isArray(inputData.scenarios) || inputData.scenarios.length === 0) {
        console.error(chalk.red(`Error: Input file doesn't contain valid scenario data required for persona view`));
        process.exit(1);
      }
    }
    
    // Prepare visualization options
    const visualizationOptions = {
      format: options.format,
      view: options.view,
      filter: options.filter,
      maxNodes: parseInt(options.maxNodes, 10),
      includeFullStatements: true  // Always include full statements for better context
    };
    
    console.log(chalk.blue(`Building ${options.view}-centric visualization...`));
    
    // Generate visualization
    const result = await visualization.generateVisualization(dataToVisualize, visualizationOptions);
    
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
      console.log(chalk.yellow(`\nTo view the Mermaid diagram, paste the contents of the output file`));
      console.log(chalk.yellow(`into a Markdown viewer that supports Mermaid syntax.`));
    }
    
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

module.exports = { execute };