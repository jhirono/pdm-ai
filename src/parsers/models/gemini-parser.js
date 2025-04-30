// src/parsers/models/gemini-parser.js
const https = require('https');
const BaseParser = require('../base-parser');
const config = require('../../utils/config');
require('dotenv').config();

/**
 * Gemini-specific parser implementation for Google's Gemini Pro 2.5 model
 */
class GeminiParser extends BaseParser {
  /**
   * Call the Gemini API to extract JTBDs and scenarios
   * @param {string} content - The content to parse
   * @param {Object} fileInfo - Information about the file
   * @returns {Promise<Object>} Parsed JTBDs and scenarios
   */
  async callModelAPI(content, fileInfo) {
    try {
      console.log("Calling Google Gemini API...");
      
      const apiKey = config.google.apiKey;
      if (!apiKey) {
        throw new Error("No API key available for Gemini. Set LLM_API_KEY in your .env file");
      }
      
      // Get model configuration from global config
      const model = config.model;
      const maxTokens = config.maxTokens;
      const temperature = config.temperature;
      
      // Create prompt for Gemini
      const prompt = this.createPrompt(content, fileInfo);
      
      let response = null;
      
      try {
        response = await this.makeGeminiAPIRequest(
          apiKey, 
          prompt, 
          model,
          maxTokens,
          temperature
        );
        
        // Extract JSON content from response
        return this.extractJSON(response);
      } catch (error) {
        console.log(`API error or timeout: ${error.message}. Using fallback.`);
        return null;
      }
    } catch (apiError) {
      console.error(`Gemini API call failed: ${apiError.message}`);
      return null;
    }
  }

  /**
   * Create prompt for Gemini
   * @param {string} content - The content to create a prompt for
   * @returns {string} Prompt for Gemini
   */
  createPrompt(content) {
    return `Analyze the following customer feedback and extract:

1. Jobs-to-be-Done (JTBDs) in the format "When [situation], I want to [motivation], so I can [expected outcome]"
2. User scenarios in the format "As a [persona], I want to [action], so that I can [value/goal]"

Assign each JTBD and scenario a priority from 1-10 (10 being highest).
Extract key quotes that support the JTBDs.
Create relationships between JTBDs and scenarios.

CUSTOMER INPUT:
${content}

FORMAT YOUR RESPONSE AS A VALID JSON OBJECT WITH THIS STRUCTURE:
{
  "jtbds": [
    {
      "id": "jtbd-[unique-id]",
      "statement": "When [situation], I want to [motivation], so I can [expected outcome]",
      "situation": "[situation]",
      "motivation": "[motivation]",
      "outcome": "[expected outcome]",
      "priority": [1-10],
      "sourceQuotes": ["quote from the content"],
      "relatedScenarios": ["scenario-id-1", "scenario-id-2"]
    }
  ],
  "scenarios": [
    {
      "id": "scenario-[unique-id]",
      "statement": "As a [persona], I want to [action], so that I can [value/goal]",
      "persona": "[persona]",
      "action": "[action]",
      "value": "[value/goal]",
      "priority": [1-10],
      "relatedJtbds": ["jtbd-id-1", "jtbd-id-2"]
    }
  ]
}

IMPORTANT: Respond with ONLY the JSON object. Do not include any text outside the JSON.`;
  }

  /**
   * Make a request to the Google Gemini API
   * @param {string} apiKey - Google API key
   * @param {string} prompt - Text prompt
   * @param {string} model - Gemini model name
   * @param {number} maxTokens - Maximum output tokens
   * @param {number} temperature - Temperature setting
   * @returns {Promise<string>} Gemini API response
   */
  makeGeminiAPIRequest(apiKey, prompt, model, maxTokens, temperature) {
    return new Promise((resolve, reject) => {
      // Set a 3-minute timeout for the API call
      const TIMEOUT_MS = 180000;
      
      const requestData = {
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: temperature,
          maxOutputTokens: maxTokens,
          topP: 0.95,
          topK: 40
        }
      };
      
      const queryParams = new URLSearchParams({
        key: apiKey
      }).toString();
      
      const options = {
        hostname: 'generativelanguage.googleapis.com',
        port: 443,
        path: `/v1beta/models/${model}:generateContent?${queryParams}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: TIMEOUT_MS
      };
      
      let timer = setTimeout(() => {
        req.destroy();
        reject(new Error(`Request timed out after ${TIMEOUT_MS/1000} seconds`));
      }, TIMEOUT_MS);
      
      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          clearTimeout(timer);
          try {
            if (res.statusCode !== 200) {
              reject(new Error(`API returned status code ${res.statusCode}: ${data}`));
              return;
            }
            
            const response = JSON.parse(data);
            const textContent = response.candidates && 
                              response.candidates[0] && 
                              response.candidates[0].content && 
                              response.candidates[0].content.parts && 
                              response.candidates[0].content.parts[0] && 
                              response.candidates[0].content.parts[0].text;
            
            // Return the text content or empty string
            resolve(textContent || "");
          } catch (e) {
            console.log(`Failed to parse API response: ${e.message}. Using empty string.`);
            resolve("");
          }
        });
      });
      
      req.on('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });
      
      req.on('timeout', () => {
        req.destroy();
        clearTimeout(timer);
        reject(new Error('Request timed out'));
      });
      
      req.write(JSON.stringify(requestData));
      req.end();
    });
  }

  /**
   * Extract JSON from the API response
   * @param {string} response - API response text
   * @returns {Object|null} Parsed JSON or null if parsing fails
   */
  extractJSON(response) {
    if (!response) return null;
    
    let parsedResponse = null;
    
    // Strategy 1: Try to find a JSON block with ```json markers
    const jsonBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch && jsonBlockMatch[1]) {
      try {
        parsedResponse = JSON.parse(jsonBlockMatch[1].trim());
        console.log("Successfully extracted JSON from code block");
        return parsedResponse;
      } catch (e) {
        console.log("Found JSON code block but failed to parse it, trying other methods");
      }
    }
    
    // Strategy 2: Try to find anything that looks like a JSON object (with { at the start and } at the end)
    let jsonObjectMatch = response.match(/(\{[\s\S]*\})/);
    if (jsonObjectMatch && jsonObjectMatch[1]) {
      try {
        // Try to fix common JSON parsing issues
        let jsonCandidate = jsonObjectMatch[1].trim();
        
        // Replace single quotes with double quotes
        jsonCandidate = jsonCandidate.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":');
        // Replace single quotes in values with double quotes
        jsonCandidate = jsonCandidate.replace(/: ?'([^']*)'/g, ': "$1"');
        
        parsedResponse = JSON.parse(jsonCandidate);
        console.log("Successfully extracted JSON from object pattern");
        return parsedResponse;
      } catch (e) {
        console.log(`Found JSON-like object but failed to parse it: ${e.message}, trying other methods`);
      }
    }
    
    // Strategy 3: Try to find multiple JSON objects and merge them
    try {
      const jtbdMatch = response.match(/"jtbds"\s*:\s*(\[[\s\S]*?\])/);
      const scenariosMatch = response.match(/"scenarios"\s*:\s*(\[[\s\S]*?\])/);
      
      if (jtbdMatch && scenariosMatch) {
        const combinedJson = `{"jtbds": ${jtbdMatch[1]}, "scenarios": ${scenariosMatch[1]}}`;
        parsedResponse = JSON.parse(combinedJson);
        console.log("Successfully constructed JSON by combining jtbds and scenarios arrays");
        return parsedResponse;
      }
    } catch (e) {
      console.log(`Failed to combine JSON parts: ${e.message}`);
    }
    
    return null;
  }
}

module.exports = new GeminiParser();