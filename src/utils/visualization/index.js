/**
 * Main visualization module
 * Handles the generation of different visualization formats for JTBDs and scenarios
 */

const mermaidGenerator = require('./mermaid');

/**
 * Generate visualization based on input data and options
 * @param {Object} data - Input data with JTBDs and scenarios
 * @param {Object} options - Visualization options
 * @returns {Object} Result object with content and stats
 */
async function generateVisualization(data, options) {
  // For Phase 1, we only support Mermaid format
  if (options.format === 'mermaid' || !options.format) {
    return mermaidGenerator.generateMermaidDiagram(data, options);
  }
  
  // Future formats will be implemented in later phases
  throw new Error(`Format '${options.format}' is not yet implemented.`);
}

module.exports = {
  generateVisualization
};