// src/parsers/models/gemini-parser.js
const https = require('https');
const fs = require('fs-extra');
const path = require('path');
const BaseParser = require('../base-parser');
const config = require('../../config');
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
        throw new Error("No API key available for Gemini. Set GOOGLE_API_KEY in your .env file");
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
        
        // Log full response to console for debugging
        console.log("\n======= GEMINI RESPONSE START =======");
        console.log(response);
        console.log("======= GEMINI RESPONSE END =======\n");
        
        // Save raw response for debugging (always save it during parsing)
        const debugDir = path.join(process.cwd(), 'debug');
        fs.ensureDirSync(debugDir);
        const filename = `gemini_raw_${fileInfo.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.txt`;
        fs.writeFileSync(path.join(debugDir, filename), response);
        console.log(`Raw response saved to debug/${filename}`);
        
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
   * Call the Gemini API specifically for scenario extraction
   * @param {string} content - The content to parse
   * @param {Object} fileInfo - Information about the file
   * @param {string} specializedPrompt - Specialized prompt for scenario extraction 
   * @returns {Promise<Object>} Parsed scenarios
   */
  async callModelAPIForScenarios(content, fileInfo, specializedPrompt) {
    try {
      console.log("Calling Google Gemini API for scenario extraction...");
      
      const apiKey = config.google.apiKey;
      if (!apiKey) {
        throw new Error("No API key available for Gemini. Set GOOGLE_API_KEY in your .env file");
      }
      
      // Get model configuration from global config
      const model = config.model;
      const maxTokens = config.maxTokens;
      const temperature = config.temperature;
      
      // If no specialized prompt is provided, create one
      const prompt = specializedPrompt || this.createScenarioExtractionPrompt(content, fileInfo);
      
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
      console.error(`Gemini API call for scenario extraction failed: ${apiError.message}`);
      return { scenarios: [] };
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

YOU MUST RESPOND WITH A VALID JSON OBJECT ONLY.
DO NOT ADD ANY EXPLANATIONS, TEXT, OR FORMATTING OUTSIDE THE JSON OBJECT.
THE FIRST CHARACTER OF YOUR RESPONSE MUST BE '{' AND THE LAST CHARACTER MUST BE '}'.

USE THIS EXACT STRUCTURE:
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

CRITICAL: Your response MUST be valid JSON. All keys and string values must use double quotes. Do not use single quotes. Do not include any trailing commas in arrays or objects. Do not include any text, comments, or code outside the JSON object. The response should start with '{' and end with '}' with nothing before or after.`;
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

YOU MUST RESPOND WITH A VALID JSON OBJECT ONLY.
DO NOT ADD ANY EXPLANATIONS, TEXT, OR FORMATTING OUTSIDE THE JSON OBJECT.
THE FIRST CHARACTER OF YOUR RESPONSE MUST BE '{' AND THE LAST CHARACTER MUST BE '}'.

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
   * Extract JSON from the API response and attempt to fix common syntax issues
   * @param {string} response - API response text
   * @returns {Object|null} Parsed JSON or null if parsing fails
   */
  extractJSON(response) {
    if (!response) return null;
    
    // Log the first 100 characters of raw response to help with debugging
    const previewLength = Math.min(response.length, 100);
    console.log(`Response preview (first ${previewLength} chars): ${response.substring(0, previewLength).replace(/\n/g, '\\n')}...`);
    
    let parsedResponse = null;
    
    // Strategy 1: Try to find a JSON block with ```json markers
    const jsonBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch && jsonBlockMatch[1]) {
      try {
        const cleanedJson = this.repairJson(jsonBlockMatch[1].trim());
        parsedResponse = JSON.parse(cleanedJson);
        console.log("Successfully extracted JSON from code block");
        return parsedResponse;
      } catch (e) {
        console.log(`Found JSON code block but failed to parse it: ${e.message}, trying other methods`);
      }
    }
    
    // Strategy 2: Try to find anything that looks like a JSON object (with { at the start and } at the end)
    let jsonObjectMatch = response.match(/([\s\S]*?)?(\{[\s\S]*\})([\s\S]*?)?/);
    if (jsonObjectMatch && jsonObjectMatch[2]) {
      try {
        // Try to fix common JSON parsing issues
        let jsonCandidate = this.repairJson(jsonObjectMatch[2].trim());
        
        // Check if parsed successfully
        parsedResponse = JSON.parse(jsonCandidate);
        console.log("Successfully extracted JSON from object pattern");
        return parsedResponse;
      } catch (e) {
        console.log(`Found JSON-like object but failed to parse it: ${e.message}, trying more aggressive repair`);
        
        try {
          // Log the exact character and position that's causing the problem
          const errorMatch = e.message.match(/position (\d+)/);
          if (errorMatch && errorMatch[1]) {
            const errorPos = parseInt(errorMatch[1]);
            const errorContext = jsonObjectMatch[2].substring(Math.max(0, errorPos - 20), errorPos + 20);
            console.log(`Error context around position ${errorPos}: ${JSON.stringify(errorContext)}`);
          }
          
          // Try more aggressive JSON repair
          const aggressivelyCleanedJson = this.aggressiveJsonRepair(jsonObjectMatch[2]);
          parsedResponse = JSON.parse(aggressivelyCleanedJson);
          console.log("Successfully extracted JSON with aggressive repair");
          return parsedResponse;
        } catch (repairError) {
          console.log(`Aggressive repair failed: ${repairError.message}, trying other methods`);
        }
      }
    }
    
    // Strategy 3: Try to find multiple JSON objects and merge them
    try {
      const jtbdMatch = response.match(/"jtbds"\s*:\s*(\[[\s\S]*?\])/);
      const scenariosMatch = response.match(/"scenarios"\s*:\s*(\[[\s\S]*?\])/);
      
      if (jtbdMatch && scenariosMatch) {
        // Clean up both array parts before combining
        const cleanedJtbds = this.repairJsonArray(jtbdMatch[1]);
        const cleanedScenarios = this.repairJsonArray(scenariosMatch[1]);
        
        const combinedJson = `{"jtbds": ${cleanedJtbds}, "scenarios": ${cleanedScenarios}}`;
        parsedResponse = JSON.parse(combinedJson);
        console.log("Successfully constructed JSON by combining jtbds and scenarios arrays");
        return parsedResponse;
      }
    } catch (e) {
      console.log(`Failed to combine JSON parts: ${e.message}`);
    }
    
    // Strategy 4: Try to salvage and reconstruct the JSON structure
    try {
      const reconstructed = this.reconstructJson(response);
      if (reconstructed) {
        parsedResponse = JSON.parse(reconstructed);
        console.log("Successfully reconstructed JSON from fragments");
        // Ensure both keys exist as arrays
        if (parsedResponse && typeof parsedResponse === 'object') {
          if (!Array.isArray(parsedResponse.jtbds)) parsedResponse.jtbds = [];
          if (!Array.isArray(parsedResponse.scenarios)) parsedResponse.scenarios = [];
        }
        return parsedResponse;
      }
    } catch (e) {
      console.log(`Failed to reconstruct JSON: ${e.message}`);
    }

    // Ensure both keys exist as arrays before returning (final fallback)
    if (parsedResponse && typeof parsedResponse === 'object') {
      if (!Array.isArray(parsedResponse.jtbds)) parsedResponse.jtbds = [];
      if (!Array.isArray(parsedResponse.scenarios)) parsedResponse.scenarios = [];
    }

    return parsedResponse;
  }
  
  /**
   * Repair malformed JSON by fixing common issues
   * @param {string} jsonString - Potentially malformed JSON string
   * @returns {string} Repaired JSON string
   */
  repairJson(jsonString) {
    if (!jsonString) return "{}";
    
    let repaired = jsonString;
    
    // Remove any non-JSON text before the opening brace
    const firstBrace = repaired.indexOf('{');
    if (firstBrace > 0) {
      repaired = repaired.substring(firstBrace);
    }
    
    // Remove any non-JSON text after the closing brace
    const lastBrace = repaired.lastIndexOf('}');
    if (lastBrace > -1 && lastBrace < repaired.length - 1) {
      repaired = repaired.substring(0, lastBrace + 1);
    }
    
    // Replace single quotes with double quotes (but not inside already quoted strings)
    repaired = repaired.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":');
    
    // Replace single quotes in values with double quotes
    repaired = repaired.replace(/: ?'([^']*)'/g, ': "$1"');
    
    // Remove trailing commas in objects
    repaired = repaired.replace(/,(\s*})/g, '$1');
    
    // Remove trailing commas in arrays
    repaired = repaired.replace(/,(\s*\])/g, '$1');
    
    // Ensure array items are separated by commas
    repaired = repaired.replace(/}(\s*){/g, '},\n$1{');
    
    // Fix multi-line strings that are not properly quoted
    repaired = repaired.replace(/: ?([^"][^\s,}{][^,}{]*[^\s,}{])/g, ': "$1"');
    
    // Fix property values without commas between them
    repaired = repaired.replace(/"([^"]*)"(\s*)"([^"]*)"/g, '"$1",\n"$3"');
    
    // Fix properties without comma between them
    repaired = repaired.replace(/"([^"]*)":\s*("[^"]*"|[0-9]+)(\s*)"([^"]*)"/g, '"$1": $2,\n"$4"');
    
    // Clean up extra whitespace
    repaired = repaired.replace(/\s+/g, ' ');
    
    // Balance braces and brackets
    const openBraces = (repaired.match(/{/g) || []).length;
    const closeBraces = (repaired.match(/}/g) || []).length;
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/\]/g) || []).length;
    
    // Add missing closing braces or brackets
    for (let i = 0; i < openBraces - closeBraces; i++) {
      repaired += '}';
    }
    for (let i = 0; i < openBrackets - closeBrackets; i++) {
      repaired += ']';
    }
    
    return repaired;
  }
  
  /**
   * Aggressive JSON repair for severely malformed JSON
   * @param {string} jsonString - Malformed JSON string
   * @returns {string} Repaired JSON string
   */
  aggressiveJsonRepair(jsonString) {
    if (!jsonString) return "{}";
    
    let repaired = jsonString;
    
    // Ensure we start with a clean JSON object
    repaired = repaired.replace(/^[^{]*/, '');
    repaired = repaired.replace(/[^}]*$/, '');
    
    // Fix all possible syntax errors one by one
    
    // Fix property names - ensure they're quoted with double quotes
    repaired = repaired.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');
    
    // Fix property values - ensure strings are quoted with double quotes
    repaired = repaired.replace(/:\s*(?!'|")([a-zA-Z0-9_. ]+)(?!'|")(\s*[,}])/g, ': "$1"$2');
    
    // Fix missing commas between properties
    repaired = repaired.replace(/(["}0-9])\s*(?={?"[a-zA-Z0-9_]+")/g, '$1,');
    
    // Fix missing commas between array items
    repaired = repaired.replace(/(["}0-9]|\])\s*(?={|"[a-zA-Z0-9_]+"|[0-9]+|\[)/g, '$1,');
    
    // Remove trailing commas
    repaired = repaired.replace(/,(\s*[\]}])/g, '$1');
    
    // Fix extra commas
    repaired = repaired.replace(/,\s*,/g, ',');
    
    // Find all properties immediately after values and add commas
    repaired = repaired.replace(/("[^"]*")(\s*)("[^"]*"):/g, '$1,$2$3:');
    
    // Fix brackets - ensure each opening has a matching closing
    const bracketPairs = {
      '{': '}',
      '[': ']'
    };
    
    const stack = [];
    let fixed = '';
    
    for (let i = 0; i < repaired.length; i++) {
      const char = repaired[i];
      
      if (char === '{' || char === '[') {
        stack.push(char);
        fixed += char;
      } else if (char === '}' || char === ']') {
        if (stack.length === 0) {
          // Skip extra closing brackets
          continue;
        }
        
        const lastOpening = stack.pop();
        const expectedClosing = bracketPairs[lastOpening];
        
        if (char === expectedClosing) {
          fixed += char;
        } else {
          // If wrong closing bracket, use the correct one
          fixed += expectedClosing;
          
          // Push back this closing bracket if it's valid
          if (char === '}' || char === ']') {
            i--; // Reprocess this character
          }
        }
      } else {
        fixed += char;
      }
    }
    
    // Add any missing closing brackets
    while (stack.length > 0) {
      fixed += bracketPairs[stack.pop()];
    }
    
    // Replace multiple whitespace with single space
    fixed = fixed.replace(/\s+/g, ' ');
    
    return fixed;
  }
  
  /**
   * Repair malformed JSON array
   * @param {string} arrayStr - JSON array string that may have issues
   * @returns {string} Fixed JSON array string
   */
  repairJsonArray(arrayStr) {
    if (!arrayStr) return "[]";
    
    let repaired = arrayStr.trim();
    
    // Ensure the string starts with [ and ends with ]
    if (!repaired.startsWith('[')) repaired = '[' + repaired;
    if (!repaired.endsWith(']')) repaired = repaired + ']';
    
    // Remove trailing commas
    repaired = repaired.replace(/,(\s*\])/g, '$1');
    
    // Ensure objects in the array are separated by commas
    repaired = repaired.replace(/}(\s*){/g, '},\n$1{');
    
    // Replace unquoted keys with quoted keys
    repaired = repaired.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":');
    
    // Replace single quotes with double quotes
    repaired = repaired.replace(/: ?'([^']*)'/g, ': "$1"');
    
    // Fix missing commas between objects in arrays
    repaired = repaired.replace(/}(\s*){/g, '},\n$1{');
    
    return repaired;
  }
  
  /**
   * Attempt to reconstruct JSON from fragments
   * @param {string} text - Text that may contain JSON fragments
   * @returns {string|null} Reconstructed JSON or null if not possible
   */
  reconstructJson(text) {
    // Extract individual objects (JTBD and scenario objects)
    const objectPattern = /{\s*"id"\s*:\s*"[^"]+"\s*,[\s\S]*?}/g;
    const objectMatches = text.match(objectPattern);
    
    if (!objectMatches || objectMatches.length === 0) return null;
    
    // Separate JTBD and scenario objects
    const jtbds = [];
    const scenarios = [];
    
    objectMatches.forEach(objStr => {
      try {
        const cleanedObj = this.repairJson(objStr);
        const obj = JSON.parse(cleanedObj);
        
        if (obj.id && obj.id.startsWith('jtbd-')) {
          jtbds.push(cleanedObj);
        } else if (obj.id && obj.id.startsWith('scenario-')) {
          scenarios.push(cleanedObj);
        }
      } catch (e) {
        // Skip objects that can't be parsed
      }
    });
    
    if (jtbds.length === 0 && scenarios.length === 0) return null;
    
    // Construct a valid JSON structure
    const jtbdsArray = jtbds.join(',\n');
    const scenariosArray = scenarios.join(',\n');
    
    return `{
      "jtbds": [${jtbdsArray}],
      "scenarios": [${scenariosArray}]
    }`;
  }
}

module.exports = new GeminiParser();