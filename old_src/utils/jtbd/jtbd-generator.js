// src/utils/jtbd/jtbd-generator.js
const config = require('../config');

/**
 * Generate a JTBD from a cluster of scenarios
 * @param {Array} scenarios - Array of scenario objects
 * @returns {Promise<Object>} Generated JTBD object
 */
async function generateJTBDFromScenarios(scenarios) {
  try {
    console.log(`Generating JTBD from ${scenarios.length} scenarios...`);
    
    // Use the appropriate LLM API based on configuration
    const llmProvider = getLLMProvider();
    
    // Generate a JTBD statement based on the scenarios
    const jtbd = await llmProvider.generateJTBD(scenarios);
    
    return jtbd;
  } catch (error) {
    console.error(`Error generating JTBD: ${error.message}`);
    return null;
  }
}

/**
 * Get the appropriate LLM provider based on configuration
 * @returns {Object} LLM provider
 */
function getLLMProvider() {
  // Determine which model to use from config
  const model = config.model.toLowerCase();
  
  if (model.includes('claude')) {
    return require('./providers/claude-provider');
  } else if (model.includes('gemini') || model.includes('google')) {
    return require('./providers/gemini-provider');
  } else {
    // Default to OpenAI
    return require('./providers/openai-provider');
  }
}

module.exports = {
  generateJTBDFromScenarios
};