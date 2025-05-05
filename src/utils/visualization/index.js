/**
 * Main visualization module
 * Handles the generation of different visualization formats for JTBDs and scenarios
 */

const mermaidGenerator = require('./mermaid');
const csvGenerator = require('./csv');
const path = require('path');
const fs = require('fs-extra');

/**
 * Generate visualization based on input data and options
 * @param {Object} data - Input data with JTBDs and scenarios
 * @param {Object} options - Visualization options
 * @returns {Object} Result object with content and stats
 */
async function generateVisualization(data, options) {
  // Generate Mermaid diagrams
  if (options.format === 'mermaid' || !options.format) {
    return mermaidGenerator.generateMermaidDiagram(data, options);
  } 
  // Generate CSV files for Figma/Miro
  else if (options.format === 'csv') {
    // For CSV we need an output path to create multiple files
    if (!options.outputPath) {
      throw new Error('Output path is required for CSV format');
    }
    
    // Ensure the output directory exists
    await fs.ensureDir(path.dirname(options.outputPath));
    
    // Generate CSV files and return the result
    return await csvGenerator.generateCSVFiles(data, options, options.outputPath);
  }
  
  // Unsupported format
  throw new Error(`Format '${options.format}' is not yet implemented.`);
}

module.exports = {
  generateVisualization
};