/**
 * PDM-AI MCP Tool: Project Initialization
 * 
 * Handles initialization of new PDM projects via MCP
 */
const path = require('path');
const init = require('../../commands/init');
const logger = require('../../utils/logger');

/**
 * Execute project initialization through MCP
 * @param {object} params - Initialization parameters
 * @param {string} [params.name] - Project name (optional)
 * @param {string} [params.directory] - Project directory (optional)
 * @returns {Promise<object>} - Initialization result
 */
async function execute(params) {
  try {
    const projectName = params.name;
    const projectDir = params.directory || process.cwd();
    
    logger.info(`MCP: Initializing project "${projectName || 'unnamed'}" in directory "${projectDir}"`);
    
    // Call the existing initialization command
    const result = await init(projectName, projectDir);
    
    return {
      success: true,
      projectName: result.projectName,
      projectDir: result.projectDir,
      message: `Successfully initialized PDM project "${result.projectName}" at ${result.projectDir}`
    };
  } catch (error) {
    logger.error(`MCP init error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  execute
};