/**
 * PDM-AI MCP Tool: JTBD Generation
 * 
 * Generates Jobs-to-be-Done from user scenarios via MCP
 */
const jtbd = require('../../commands/jtbd');
const logger = require('../../utils/logger');

/**
 * Execute JTBD generation through MCP
 * @param {object} params - JTBD generation parameters
 * @param {string} params.source - Source file with scenarios
 * @param {string} [params.output] - Output file path (optional)
 * @param {string} [params.model] - LLM model to use (optional)
 * @returns {Promise<object>} - Generation result
 */
async function execute(params) {
  try {
    const options = {
      output: params.output,
      model: params.model,
      verbose: true
    };
    
    logger.info(`MCP: Generating JTBDs from scenarios in "${params.source}" with options: ${JSON.stringify(options)}`);
    
    // Call the existing JTBD command
    const result = await jtbd.execute(params.source, options);
    
    return {
      success: true,
      source: params.source,
      jtbds: result.jtbds || [],
      outputPath: result.outputPath,
      message: `Successfully generated ${(result.jtbds || []).length} JTBDs from scenarios in ${params.source}`
    };
  } catch (error) {
    logger.error(`MCP JTBD error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  execute
};