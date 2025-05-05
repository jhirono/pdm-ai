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
 * @param {string} format - Output format (mermaid, csv)
 * @returns {string} Default output filename
 */
function generateDefaultOutputFilename(inputFile, format) {
  const baseName = path.basename(inputFile, path.extname(inputFile));
  const extension = format === 'mermaid' ? 'md' : format;
  return path.join(process.cwd(), '.pdm', 'outputs', 'visualizations', `${baseName}-viz.${extension}`);
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
      console.log(chalk.blue(`Using format: ${options.format}, perspective: ${options.perspective}`));
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
    // For JTBD perspective, we need both JTBDs and scenarios
    if (options.perspective === 'jtbd') {
      // Check if we have JTBD data
      if (!inputData.jtbds || !Array.isArray(inputData.jtbds) || inputData.jtbds.length === 0) {
        console.error(chalk.red(`Error: Input file doesn't contain valid JTBD data for JTBD perspective`));
        process.exit(1);
      }
      
      // Check if we already have scenario data in the same file (new format)
      if (!inputData.scenarios || !Array.isArray(inputData.scenarios) || inputData.scenarios.length === 0) {
        console.error(chalk.red(`Error: Input file doesn't contain scenario data, which is required for JTBD perspective`));
        console.error(chalk.red(`Use the updated 'pdm jtbd' command to generate files that include both JTBDs and scenarios`));
        process.exit(1);
      }
    } else if (options.perspective === 'persona') {
      // For persona perspective, we only need scenarios
      if (!inputData.scenarios || !Array.isArray(inputData.scenarios) || inputData.scenarios.length === 0) {
        console.error(chalk.red(`Error: Input file doesn't contain valid scenario data required for persona perspective`));
        process.exit(1);
      }
    }
    
    // Prepare visualization options
    const visualizationOptions = {
      format: options.format,
      view: options.perspective, // Map perspective to view for backward compatibility
      filter: options.filter,
      maxNodes: parseInt(options.maxNodes, 10),
      includeFullStatements: true,  // Always include full statements for better context
      outputPath: outputPath // Pass the output path for CSV generation
    };
    
    console.log(chalk.blue(`Building ${options.perspective}-centric visualization...`));
    
    // Generate visualization
    const result = await visualization.generateVisualization(dataToVisualize, visualizationOptions);
    
    // Ensure output directory exists
    await fs.ensureDir(path.dirname(outputPath));
    
    // Handle result based on format
    if (options.format === 'mermaid') {
      // For Mermaid format, write a single file
      await fs.writeFile(outputPath, result.content);
      
      console.log(chalk.green(`✓ Visualization generated successfully!`));
      console.log(chalk.green(`  - Output file: ${outputPath}`));
      
      if (verbose) {
        console.log(chalk.green(`  - Format: ${options.format}`));
        console.log(chalk.green(`  - Perspective: ${options.perspective}`));
        console.log(chalk.green(`  - Nodes rendered: ${result.stats.nodeCount}`));
        console.log(chalk.green(`  - Edges rendered: ${result.stats.edgeCount}`));
        console.log(chalk.yellow(`\nTo view the Mermaid diagram, paste the contents of the output file`));
        console.log(chalk.yellow(`into a Markdown viewer that supports Mermaid syntax.`));
      }
    } 
    else if (options.format === 'csv') {
      // For CSV format, multiple files are generated
      console.log(chalk.green(`✓ CSV files generated successfully!`));
      console.log(chalk.green(`  - Files generated: ${result.stats.fileCount}`));
      
      if (verbose) {
        console.log(chalk.green(`  - Format: ${options.format}`));
        console.log(chalk.green(`  - Perspective: ${options.perspective}`));
        console.log(chalk.green(`  - JTBDs processed: ${result.stats.jtbdCount}`));
        console.log(chalk.green(`  - Scenarios included: ${result.stats.scenarioCount}`));
        
        // List all generated CSV files
        console.log(chalk.yellow(`\nGenerated CSV files:`));
        result.files.forEach(file => {
          console.log(chalk.yellow(`  - ${file.path}`));
        });
        
        console.log(chalk.yellow(`\nThese CSV files can be imported into Figma or Miro.`));
      }
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