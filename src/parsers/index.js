// src/parsers/index.js
const claudeParser = require('./models/claude-parser');
const geminiParser = require('./models/gemini-parser');
const openaiParser = require('./models/openai-parser');
const config = require('../utils/config');

/**
 * Get the appropriate parser based on configuration or specified type
 * @param {string} type - Override parser type ('claude', 'gemini', 'openai')
 * @returns {Object} The selected parser instance
 */
function getParser(type) {
  // Use the override type if provided, otherwise use the one from config
  const parserType = type || config.parserType;
  
  // Select the parser based on the determined type
  switch (parserType.toLowerCase()) {
    case 'gemini':
      return geminiParser;
    case 'openai':
      return openaiParser;
    case 'claude':
    default:
      return claudeParser;
  }
}

/**
 * Check if a parser can be used based on available API keys
 * @param {string} type - Parser type to check ('claude', 'gemini', 'openai')
 * @returns {boolean} Whether the parser can be used
 */
function canUseParser(type) {
  switch (type.toLowerCase()) {
    case 'claude':
      return !!config.anthropic.apiKey;
    case 'gemini':
      return !!config.google.apiKey;
    case 'openai':
      return !!config.openai.apiKey;
    default:
      return false;
  }
}

/**
 * Get a fallback parser if the primary one cannot be used
 * @returns {Object} A fallback parser or null if none available
 */
function getFallbackParser() {
  // Try parsers in order of preference
  if (canUseParser('claude')) return claudeParser;
  if (canUseParser('openai')) return openaiParser;
  if (canUseParser('gemini')) return geminiParser;
  
  // No API keys available
  console.error('No API keys found for any supported model. Please add API keys to your .env file.');
  return null;
}

module.exports = {
  getParser,
  canUseParser,
  getFallbackParser,
  claudeParser,
  geminiParser,
  openaiParser
};