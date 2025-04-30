// src/utils/config.js
const dotenv = require('dotenv');
const fs = require('fs-extra');
const path = require('path');

// Load environment variables from .env file
const result = dotenv.config();
if (result.error) {
  console.warn('Warning: .env file not found or cannot be read. Using environment variables only.');
}

// Check for API keys - use only generic LLM_API_KEY
const llmApiKey = process.env.LLM_API_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
const googleApiKey = process.env.GOOGLE_API_KEY || process.env.LLM_API_KEY;

// Get model configuration (with validation)
const model = process.env.LLM_MODEL || process.env.MODEL || 'claude-3-7-sonnet-20250219';
const maxTokens = validateMaxTokens(process.env.MAX_TOKENS || '4000');
const temperature = validateTemperature(process.env.TEMPERATURE || '0.7');

// Log available API keys
if (llmApiKey) {
  console.log(`LLM API Key: Available (length: ${llmApiKey.length})`);
}
if (openaiApiKey && openaiApiKey !== llmApiKey) {
  console.log(`OpenAI API Key: Available (length: ${openaiApiKey.length})`);
}
if (googleApiKey && googleApiKey !== llmApiKey) {
  console.log(`Google API Key: Available (length: ${googleApiKey.length})`);
}

// Determine parser type based on model name
const parserType = determineParserType(model);
console.log(`Selected model: ${model} (using ${parserType} parser)`);

const config = {
  // Model and parser configuration
  model: model,
  parserType: parserType,
  maxTokens: maxTokens,
  temperature: temperature,
  
  // API configurations
  anthropic: {
    apiKey: llmApiKey,
    models: ['claude-3-7-sonnet-20250219', 'claude-3-opus', 'claude-3-5-sonnet', 'claude-3-haiku']
  },
  
  google: {
    apiKey: googleApiKey,
    models: ['gemini-pro-2.5', 'gemini-pro', 'gemini-1.5']
  },
  
  openai: {
    apiKey: openaiApiKey,
    models: ['o4-mini', 'gpt-4', 'gpt-4o', 'gpt-3.5-turbo']
  },
  
  // Default paths
  paths: {
    outputDir: process.env.OUTPUT_DIR || path.join(process.cwd(), 'output'),
  },
  
  // Export the helper functions so they can be used elsewhere
  determineParserType: determineParserType,
  validateMaxTokens: validateMaxTokens,
  validateTemperature: validateTemperature
};

// Ensure the output directory exists
fs.ensureDirSync(config.paths.outputDir);

/**
 * Determine the parser type based on the model name
 * @param {string} model - The model name
 * @returns {string} The parser type ('claude', 'gemini', 'openai')
 */
function determineParserType(model) {
  // Check Claude models
  if (model.toLowerCase().includes('claude')) {
    return 'claude';
  }
  
  // Check OpenAI models
  if (model.toLowerCase().includes('gpt') || model.toLowerCase().includes('o4')) {
    return 'openai';
  }
  
  // Check Gemini models
  if (model.toLowerCase().includes('gemini')) {
    return 'gemini';
  }
  
  // Default to Claude if unknown
  console.log(`Unknown model type: ${model}, defaulting to Claude parser`);
  return 'claude';
}

/**
 * Validate max tokens value
 * @param {string} value - The max tokens value from env
 * @returns {number} Validated max tokens
 */
function validateMaxTokens(value) {
  const tokens = parseInt(value, 10);
  if (isNaN(tokens) || tokens <= 0) {
    console.warn(`Invalid MAX_TOKENS value: ${value}, using default of 4000`);
    return 4000;
  }
  return tokens;
}

/**
 * Validate temperature value
 * @param {string} value - The temperature value from env
 * @returns {number} Validated temperature
 */
function validateTemperature(value) {
  const temp = parseFloat(value);
  if (isNaN(temp) || temp < 0 || temp > 1) {
    console.warn(`Invalid TEMPERATURE value: ${value}, using default of 0.7`);
    return 0.7;
  }
  return temp;
}

module.exports = config;