// src/utils/parsers/models/openai-parser.js
const https = require('https');
const BaseParser = require('../base-parser');
const config = require('../../config');
require('dotenv').config();

/**
 * OpenAI-specific parser implementation (GPT models)
 */
class OpenAIParser extends BaseParser {
  /**
   * Call the OpenAI API to extract JTBDs and scenarios
   * @param {string} content - The content to parse
   * @param {Object} fileInfo - Information about the file
   * @returns {Promise<Object>} Parsed JTBDs and scenarios
   */
  async callModelAPI(content, fileInfo) {
    try {
      console.log("Calling OpenAI API...");
      
      const apiKey = config.openai.apiKey;
      if (!apiKey) {
        throw new Error("No API key available for OpenAI. Set OPENAI_API_KEY in your .env file");
      }
      
      // Get model configuration from global config
      const model = config.model;
      const maxTokens = config.maxTokens;
      const temperature = config.temperature;
      
      // Generate system prompt with JSON instruction
      const systemPrompt = this.createSystemPrompt();
      
      // Create user prompt with content
      const userPrompt = this.createPrompt(content, fileInfo);
      
      let response = null;
      
      try {
        response = await this.makeOpenAIAPIRequest(
          apiKey, 
          systemPrompt, 
          userPrompt, 
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
      console.error(`OpenAI API call failed: ${apiError.message}`);
      return null;
    }
  }

  /**
   * Call the OpenAI API specifically for scenario extraction
   * @param {string} content - The content to parse
   * @param {Object} fileInfo - Information about the file
   * @param {string} specializedPrompt - Specialized prompt for scenario extraction 
   * @returns {Promise<Object>} Parsed scenarios
   */
  async callModelAPIForScenarios(content, fileInfo, specializedPrompt) {
    try {
      console.log("Calling OpenAI API for scenario extraction...");
      
      const apiKey = config.openai.apiKey;
      if (!apiKey) {
        throw new Error("No API key available for OpenAI. Set OPENAI_API_KEY in your .env file");
      }
      
      // Get model configuration from global config
      const model = config.model;
      const maxTokens = config.maxTokens;
      const temperature = config.temperature;
      
      // Use the scenario-specific system prompt
      const systemPrompt = this.createScenarioSystemPrompt();
      
      // If no specialized prompt is provided, create one
      const userPrompt = specializedPrompt || this.createScenarioExtractionPrompt(content, fileInfo);
      
      let response = null;
      
      try {
        response = await this.makeOpenAIAPIRequest(
          apiKey, 
          systemPrompt, 
          userPrompt, 
          model,
          maxTokens,
          temperature
        );
        
        // Extract JSON content from response
        const result = this.extractJSON(response);
        
        // Ensure we return an object with at least an empty scenarios array
        if (!result) {
          return { scenarios: [] };
        }
        
        // If extractJSON returned both jtbds and scenarios, just return the scenarios
        if (result.jtbds && result.scenarios) {
          return { scenarios: result.scenarios };
        }
        
        return result;
      } catch (error) {
        console.log(`API error or timeout in scenario extraction: ${error.message}. Using fallback.`);
        return { scenarios: [] };
      }
    } catch (apiError) {
      console.error(`OpenAI API call for scenario extraction failed: ${apiError.message}`);
      return { scenarios: [] };
    }
  }

  /**
   * Create system message for OpenAI
   * @returns {string} System message
   */
  createSystemPrompt() {
    return `You are an expert product manager skilled at extracting customer insights from feedback.
You specialize in the Jobs-to-be-Done (JTBD) framework and user scenarios.
Always provide your output as a valid JSON object with the structure specified in the prompt.
Do not include ANY text outside of the JSON object.`;
  }

  /**
   * Create a system prompt specifically for scenario extraction
   * @returns {string} System prompt for scenario extraction
   */
  createScenarioSystemPrompt() {
    return `You are an expert product manager skilled at extracting user scenarios from customer feedback.
Focus exclusively on identifying user scenarios in the "As a [persona], I want to [action], so that I can [value/goal]" format.
Look for real user needs and pain points in the input text and formulate them as clear user scenarios.
Try to identify specific personas rather than using generic terms like "user" when possible.
Ensure each scenario clearly articulates what the user wants to accomplish and why.
Always provide your output as a valid JSON object with the structure specified in the prompt.
Do not include ANY text outside of the JSON object.`;
  }

  /**
   * Create user message for OpenAI
   * @param {string} content - The content to create a prompt for
   * @returns {string} User message
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
   * Create a specialized prompt for scenario extraction
   * @param {string} content - The content to create a prompt for
   * @param {Object} fileInfo - Information about the file
   * @returns {string} Specialized prompt for scenario extraction
   */
  createScenarioExtractionPrompt(content, fileInfo) {
    // Check if the content is in Japanese and adjust the prompt accordingly
    const isJapanese = config.language === 'ja' || this.detectJapaneseContent(content);
    
    if (isJapanese) {
      return `以下のカスタマーフィードバックから、ユーザーシナリオを「〜として、私は〜したい、それによって〜できる」の形式で抽出してください。

可能な限り関連性の高いユーザーシナリオを抽出してください。各シナリオに1〜10（10が最高）の優先度を割り当ててください。
一般的な「ユーザー」などの用語ではなく、具体的なペルソナをテキストから特定するようにしてください。
実際のユーザーニーズを反映した実行可能なシナリオの抽出に焦点を当ててください。
IDフィールドは省略してください。システム側で自動的に生成します。

顧客フィードバック:
${content}

回答は以下の構造の有効なJSONオブジェクトとして提供してください:
{
  "scenarios": [
    {
      "statement": "[ペルソナ]として、私は[アクション]したい、それによって[価値/目標]できる",
      "persona": "[ペルソナ]",
      "action": "[アクション]",
      "value": "[価値/目標]",
      "priority": [1-10]
    }
  ]
}

重要: JSONオブジェクトのみを返し、JSON以外のテキストを含めないでください。`;
    }
    
    // Default English prompt
    return `Analyze the following customer feedback and extract user scenarios in the format "As a [persona], I want to [action], so that I can [value/goal]".

Extract as many relevant user scenarios as possible. Assign each scenario a priority from 1-10 (10 being highest).
Try to identify specific personas from the text rather than using generic terms like "user".
Focus on extracting actionable scenarios that reflect real user needs.
Do not include an "id" field - our system will automatically generate unique IDs.

CUSTOMER INPUT:
${content}

FORMAT YOUR RESPONSE AS A VALID JSON OBJECT WITH THIS STRUCTURE:
{
  "scenarios": [
    {
      "statement": "As a [persona], I want to [action], so that I can [value/goal]",
      "persona": "[persona]",
      "action": "[action]",
      "value": "[value/goal]",
      "priority": [1-10]
    }
  ]
}

IMPORTANT: Respond with ONLY the JSON object. Do not include any text outside the JSON.`;
  }

  /**
   * Detect if content is primarily in Japanese
   * @param {string} content - The content to check
   * @returns {boolean} True if content appears to be in Japanese
   */
  detectJapaneseContent(content) {
    // Simple detection based on Japanese character ranges
    const japaneseCharRegex = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]/g;
    const japaneseChars = content.match(japaneseCharRegex);
    
    if (!japaneseChars) return false;
    
    // If more than 15% of characters are Japanese, consider it Japanese content
    const japaneseCharRatio = japaneseChars.length / content.length;
    return japaneseCharRatio > 0.15;
  }

  /**
   * Make a request to the OpenAI API
   * @param {string} apiKey - OpenAI API key
   * @param {string} systemMessage - System message
   * @param {string} userMessage - User message
   * @param {string} model - OpenAI model name
   * @param {number} maxTokens - Maximum tokens to generate
   * @param {number} temperature - Temperature setting
   * @returns {Promise<string>} OpenAI API response
   */
  makeOpenAIAPIRequest(apiKey, systemMessage, userMessage, model, maxTokens, temperature) {
    return new Promise((resolve, reject) => {
      // Set a 3-minute timeout for the API call
      const TIMEOUT_MS = 180000;
      
      const requestData = {
        model: model,
        messages: [
          {
            role: "system",
            content: systemMessage
          },
          {
            role: "user",
            content: userMessage
          }
        ]
      };
      
      // Handle model-specific parameters
      if (model.startsWith('o3') || model.startsWith('o4')) {
        // o3 and o4 models use max_completion_tokens instead of max_tokens
        requestData.max_completion_tokens = maxTokens;
        
        // o3 and o4 models don't support temperature parameter
        // Do not set temperature parameter for these models
      } else {
        // Other models use max_tokens and support custom temperature
        requestData.max_tokens = maxTokens;
        requestData.temperature = temperature;
      }
      
      const options = {
        hostname: 'api.openai.com',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
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
            const textContent = response.choices && 
                                response.choices[0] && 
                                response.choices[0].message && 
                                response.choices[0].message.content;
            
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

module.exports = new OpenAIParser();