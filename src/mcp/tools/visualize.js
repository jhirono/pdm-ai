/**
 * PDM-AI MCP Tool: Visualization
 * 
 * Generates visualizations from JTBDs and user scenarios via MCP
 */
const visualize = require('../../commands/visualize');
const logger = require('../../utils/logger');

/**
 * Execute visualization generation through MCP
 * @param {object} params - Visualization parameters
 * @param {string} params.source - Source file with JTBDs and scenarios
 * @param {string} [params.format] - Output format (optional, default: mermaid)
 * @param {string} [params.output] - Output file path (optional)
 * @returns {Promise<object>} - Visualization result
 */
async function execute(params) {
  try {
    const options = {
      format: params.format || 'mermaid',
      output: params.output,
      verbose: true
    };
    
    logger.info(`MCP: Generating visualization from "${params.source}" with format "${options.format}"`);
    
    // Call the existing visualization command
    const result = await visualize.execute(params.source, options);
    
    return {
      success: true,
      source: params.source,
      format: options.format,
      visualizationData: result.visualizationData,
      outputPath: result.outputPath,
      message: `Successfully generated ${options.format} visualization from ${params.source}`
    };
  } catch (error) {
    logger.error(`MCP visualization error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  execute
};