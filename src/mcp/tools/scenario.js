/**
 * PDM-AI MCP Tool: Scenario Parsing
 * 
 * Extracts user scenarios from input text via MCP
 */
const scenario = require('../../commands/scenario');
const logger = require('../../utils/logger');

/**
 * Execute scenario parsing through MCP
 * @param {object} params - Scenario parsing parameters
 * @param {string} params.source - Source file or directory to process
 * @param {string} [params.output] - Output file path (optional)
 * @param {boolean} [params.recursive] - Process directories recursively (optional)
 * @param {string} [params.model] - LLM model to use (optional)
 * @returns {Promise<object>} - Parsing result
 */
async function execute(params) {
  try {
    const options = {
      output: params.output,
      recursive: !!params.recursive,
      model: params.model,
      verbose: true
    };
    
    logger.info(`MCP: Parsing scenarios from "${params.source}" with options: ${JSON.stringify(options)}`);
    
    // Call the existing scenario command
    const result = await scenario.execute(params.source, options);
    
    return {
      success: true,
      source: params.source,
      scenarios: result.scenarios || [],
      outputPath: result.outputPath,
      message: `Successfully extracted ${(result.scenarios || []).length} scenarios from ${params.source}`
    };
  } catch (error) {
    logger.error(`MCP scenario error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  execute
};