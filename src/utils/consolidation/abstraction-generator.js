// src/utils/consolidation/abstraction-generator.js
const https = require('https');
const config = require('../config');

/**
 * Class for generating abstract JTBDs from clusters of concrete JTBDs
 */
class AbstractionGenerator {
  constructor() {
    // Use API keys from config or environment
    this.openaiApiKey = process.env.OPENAI_API_KEY || config.openai?.apiKey;
    this.googleApiKey = process.env.GOOGLE_API_KEY || config.google?.apiKey;
    this.anthropicApiKey = process.env.ANTHROPIC_API_KEY || config.anthropic?.apiKey;
  }

  /**
   * Generate an abstract JTBD or scenario from a cluster of concrete items
   * @param {Array} itemCluster - Array of concrete JTBD or scenario objects
   * @param {Object} options - Generation options
   * @param {string} options.model - LLM model to use
   * @param {string} options.type - Type of items ('jtbd' or 'scenario')
   * @returns {Promise<Object>} Generated abstract item
   */
  async generateAbstraction(itemCluster, options = {}) {
    if (!itemCluster || !Array.isArray(itemCluster) || itemCluster.length === 0) {
      throw new Error('Invalid or empty item cluster provided');
    }

    // If the cluster has only one item, return it as is
    if (itemCluster.length === 1) {
      console.log('Cluster has only one item, returning as is');
      return {
        ...itemCluster[0],
        childIds: [],
        isAbstract: false,
        level: 1
      };
    }

    // Get the model from options or environment - no fallback to a default model
    // Only use what's in the LLM_MODEL environment variable or passed explicitly
    const selectedModel = options.model || process.env.LLM_MODEL || config.llm?.model;
    
    if (!selectedModel) {
      throw new Error('No LLM model specified. Please set LLM_MODEL in your .env file.');
    }
    
    console.log(`Using model ${selectedModel} for abstraction generation`);
    
    try {
      // Extract statements from each item in the cluster
      const statements = itemCluster.map(item => item.statement);
      
      // Generate an abstract item using the LLM
      const response = await this._callLLMForAbstraction(statements, selectedModel, options.type || 'jtbd');
      
      if (!response) {
        throw new Error('Failed to generate abstraction');
      }
      
      // Create the abstract item
      const abstractItem = this._createAbstractItem(response, itemCluster, options.type || 'jtbd');
      
      return abstractItem;
    } catch (error) {
      throw new Error(`Failed to generate abstraction: ${error.message}`);
    }
  }

  /**
   * Call the LLM to generate an abstraction from a list of JTBD statements
   * @param {Array<string>} statements - List of JTBD statements
   * @param {string} model - LLM model to use
   * @param {string} type - Type of items ('jtbd' or 'scenario')
   * @returns {Promise<Object>} LLM response with abstraction
   * @private
   */
  async _callLLMForAbstraction(statements, model, type = 'jtbd') {
    // Determine which API to call based on the model name
    const provider = this._determineProviderFromModel(model);
    
    if (!this._hasValidApiKeyFor(provider)) {
      throw new Error(`No API key available for ${provider}. Please set the appropriate API key in your .env file.`);
    }

    // Format statements for the prompt
    const formattedStatements = statements.map((stmt, i) => `${i + 1}. ${stmt}`).join('\n');

    // Create prompt for generating abstraction based on type
    let prompt;
    if (type === 'scenario') {
      prompt = `I have a cluster of similar user scenarios from customer feedback. 
Please create a higher-level abstract scenario that encompasses all of these more specific scenarios.

Here are the specific scenarios:
${formattedStatements}

Please generate:
1. A higher-level abstract scenario statement that encompasses all of these
2. A priority score (1-10) for this abstract scenario
3. A brief explanation of how this abstraction relates to the specific scenarios

Format your response as a JSON object with these keys:
- statement: The full abstract scenario statement
- situation: The situation component (if applicable)
- motivation: The motivation component (if applicable)
- outcome: The outcome component (if applicable)
- priority: A number between 1-10
- explanation: A brief explanation of this abstraction
`;
    } else {
      // Default JTBD prompt
      prompt = `I have a cluster of similar Jobs-to-be-Done (JTBD) statements from customer feedback. 
Please create a higher-level abstract JTBD that encompasses all of these more specific JTBDs.

Each JTBD follows the format: "When [situation], I want to [motivation], so I can [expected outcome]"

Here are the specific JTBDs:
${formattedStatements}

Please generate:
1. A higher-level abstract JTBD statement that encompasses all of these, using the same "When... I want to... so I can..." format
2. The extracted situation, motivation, and outcome components
3. A priority score (1-10) for this abstract JTBD
4. A brief explanation of how this abstraction relates to the specific JTBDs

Format your response as a JSON object with these keys:
- statement: The full abstract JTBD statement
- situation: The situation component
- motivation: The motivation component
- outcome: The outcome component
- priority: A number between 1-10
- explanation: A brief explanation of this abstraction
`;
    }

    try {
      let response;
      
      // Call the appropriate API based on the provider
      switch (provider) {
        case 'openai':
          response = await this._callOpenAIAPI(prompt, model);
          break;
        case 'google':
          response = await this._callGoogleAPI(prompt, model);
          break;
        case 'anthropic':
          response = await this._callAnthropicAPI(prompt, model);
          break;
        default:
          throw new Error(`Unknown provider for model: ${model}`);
      }
      
      return this._parseResponse(response);
    } catch (error) {
      console.error(`Error calling LLM for abstraction: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Determine the provider based on the model name
   * @param {string} model - Model name
   * @returns {string} Provider name ('openai', 'google', or 'anthropic')
   * @private
   */
  _determineProviderFromModel(model) {
    const modelLower = model.toLowerCase();
    
    // Check OpenAI models
    if (modelLower.includes('gpt') || modelLower.includes('o4')) {
      return 'openai';
    }
    
    // Check Google models
    if (modelLower.includes('gemini')) {
      return 'google';
    }
    
    // Check Anthropic models
    if (modelLower.includes('claude')) {
      return 'anthropic';
    }
    
    // Default to OpenAI if unknown
    console.log(`Unknown model type: ${model}, defaulting to OpenAI`);
    return 'openai';
  }
  
  /**
   * Check if we have a valid API key for the given provider
   * @param {string} provider - Provider name
   * @returns {boolean} Whether we have a valid API key
   * @private
   */
  _hasValidApiKeyFor(provider) {
    switch (provider) {
      case 'openai':
        return !!this.openaiApiKey;
      case 'google':
        return !!this.googleApiKey;
      case 'anthropic':
        return !!this.anthropicApiKey;
      default:
        return false;
    }
  }

  /**
   * Call OpenAI API with a prompt
   * @param {string} prompt - Prompt to send to the API
   * @param {string} model - Model to use
   * @returns {Promise<string>} API response
   * @private
   */
  async _callOpenAIAPI(prompt, model) {
    return new Promise((resolve, reject) => {
      // Set a timeout for the API call
      const TIMEOUT_MS = 60000;
      
      // Use values from environment or config, with fallbacks
      const maxTokens = parseInt(process.env.MAX_TOKENS || '4000', 10);
      const temperature = parseFloat(process.env.TEMPERATURE || '0.7');
      
      const requestData = {
        model: model,
        messages: [
          {
            role: "system",
            content: "You are an expert product manager who specializes in creating product insights that concisely capture user needs, whether as Jobs-to-be-Done (JTBD) statements or user scenarios."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      };
      
      // Handle model-specific parameters
      if (model.startsWith('o3') || model.startsWith('o4')) {
        // o3 and o4 models (including o4-mini) use max_completion_tokens instead of max_tokens
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
          'Authorization': `Bearer ${this.openaiApiKey}`
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
            const content = response.choices && 
                            response.choices[0] && 
                            response.choices[0].message && 
                            response.choices[0].message.content;
            
            resolve(content || "");
          } catch (e) {
            reject(new Error(`Failed to parse API response: ${e.message}`));
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
   * Call Google Gemini API with a prompt
   * @param {string} prompt - Prompt to send to the API
   * @param {string} model - Model to use
   * @returns {Promise<string>} API response
   * @private
   */
  async _callGoogleAPI(prompt, model) {
    return new Promise((resolve, reject) => {
      // Set a timeout for the API call
      const TIMEOUT_MS = 60000;
      
      // Use values from environment or config, with fallbacks
      const maxTokens = parseInt(process.env.MAX_TOKENS || '4000', 10);
      const temperature = parseFloat(process.env.TEMPERATURE || '0.7');
      
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
        key: this.googleApiKey
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
      
      console.log(`Calling Google Gemini API with model: ${model}`);
      
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
              console.error(`Google API error (status ${res.statusCode}):`, data);
              reject(new Error(`API returned status code ${res.statusCode}: ${data}`));
              return;
            }
            
            const response = JSON.parse(data);
            
            // For debugging - log the structure of the response
            console.log("Google API response structure:", 
              Object.keys(response).join(", "),
              response.candidates ? `candidates: ${response.candidates.length}` : "no candidates"
            );
            
            // Check for errors in the response
            if (response.error) {
              console.error("Google API error:", response.error);
              reject(new Error(`API error: ${JSON.stringify(response.error)}`));
              return;
            }
            
            // Check for finish reasons other than "STOP"
            if (response.candidates && 
                response.candidates[0] && 
                response.candidates[0].finishReason && 
                response.candidates[0].finishReason !== "STOP") {
              console.warn(`Warning: Generation ended with reason: ${response.candidates[0].finishReason}`);
            }
            
            const textContent = response.candidates && 
                              response.candidates[0] && 
                              response.candidates[0].content && 
                              response.candidates[0].content.parts && 
                              response.candidates[0].content.parts[0] && 
                              response.candidates[0].content.parts[0].text;
            
            if (!textContent) {
              console.error("No text content found in Google API response:", JSON.stringify(response));
              
              // If we got a MAX_TOKENS error and the candidate exists but doesn't have text,
              // try to generate a simpler response with fewer requirements
              if (response.candidates && 
                  response.candidates[0] && 
                  response.candidates[0].finishReason === "MAX_TOKENS") {
                console.log("Detected MAX_TOKENS error, falling back to OpenAI for this abstraction");
                // Try to use OpenAI for this specific request if we have an API key
                if (this.openaiApiKey) {
                  this._callOpenAIAPI(prompt, "gpt-4o")
                    .then(resolve)
                    .catch(reject);
                  return;
                }
              }
              
              reject(new Error(`No text content in API response`));
              return;
            }
            
            // Log a preview of the response for debugging
            console.log(`Google API response (first 100 chars): ${textContent.substring(0, 100)}...`);
            
            resolve(textContent || "");
          } catch (e) {
            console.error("Error parsing Google API response:", e, "Data received:", data);
            reject(new Error(`Failed to parse API response: ${e.message}`));
          }
        });
      });
      
      req.on('error', (e) => {
        clearTimeout(timer);
        console.error("Google API request error:", e);
        reject(e);
      });
      
      req.on('timeout', () => {
        req.destroy();
        clearTimeout(timer);
        console.error("Google API request timed out");
        reject(new Error('Request timed out'));
      });
      
      req.write(JSON.stringify(requestData));
      req.end();
    });
  }
  
  /**
   * Call Anthropic API with a prompt
   * @param {string} prompt - Prompt to send to the API
   * @param {string} model - Model to use
   * @returns {Promise<string>} API response
   * @private
   */
  async _callAnthropicAPI(prompt, model) {
    return new Promise((resolve, reject) => {
      // Set a timeout for the API call
      const TIMEOUT_MS = 60000;
      
      // Use values from environment or config, with fallbacks
      const maxTokens = parseInt(process.env.MAX_TOKENS || '4000', 10);
      const temperature = parseFloat(process.env.TEMPERATURE || '0.7');
      
      console.log(`Calling Anthropic API with model: ${model}`);
      
      // Claude API requires correct structure with system prompt
      const requestData = {
        model: model,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: maxTokens,
        temperature: temperature
      };
      
      const options = {
        hostname: 'api.anthropic.com',
        port: 443,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.anthropicApiKey,
          'anthropic-version': '2023-06-01'
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
              console.error(`Anthropic API error (status ${res.statusCode}):`, data);
              reject(new Error(`API returned status code ${res.statusCode}: ${data}`));
              return;
            }
            
            const response = JSON.parse(data);
            
            // For debugging - log the structure of the response
            console.log("Anthropic API response structure:", 
              Object.keys(response).join(", ")
            );
            
            // Extract the content from Claude's response format
            const content = response.content && 
                            response.content[0] && 
                            response.content[0].text;
            
            if (!content) {
              console.error("No text content found in Anthropic API response:", JSON.stringify(response));
              reject(new Error(`No text content in API response`));
              return;
            }
            
            // Log a preview of the response for debugging
            console.log(`Anthropic API response (first 100 chars): ${content.substring(0, 100)}...`);
            
            resolve(content || "");
          } catch (e) {
            console.error("Error parsing Anthropic API response:", e, "Data received:", data);
            reject(new Error(`Failed to parse API response: ${e.message}`));
          }
        });
      });
      
      req.on('error', (e) => {
        clearTimeout(timer);
        console.error("Anthropic API request error:", e);
        reject(e);
      });
      
      req.on('timeout', () => {
        req.destroy();
        clearTimeout(timer);
        console.error("Anthropic API request timed out");
        reject(new Error('Request timed out'));
      });
      
      req.write(JSON.stringify(requestData));
      req.end();
    });
  }

  /**
   * Parse LLM response to extract the generated abstraction
   * @param {string} response - LLM response
   * @returns {Object|null} Parsed abstraction or null if parsing fails
   * @private
   */
  _parseResponse(response) {
    if (!response) return null;
    
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        return JSON.parse(jsonStr);
      }
      
      // If no JSON found, try to parse the response manually
      // Extract the statement, situation, motivation, outcome, and priority from the text
      const statement = this._extractValue(response, 'statement', 'situation');
      const situation = this._extractValue(response, 'situation', 'motivation');
      const motivation = this._extractValue(response, 'motivation', 'outcome');
      const outcome = this._extractValue(response, 'outcome', 'priority');
      const priorityMatch = response.match(/priority:\s*(\d+)/i);
      const priority = priorityMatch ? parseInt(priorityMatch[1], 10) : 8;
      const explanation = this._extractValue(response, 'explanation', null);
      
      return {
        statement,
        situation,
        motivation,
        outcome,
        priority,
        explanation
      };
    } catch (error) {
      console.error(`Failed to parse LLM response: ${error.message}`);
      return null;
    }
  }

  /**
   * Extract a value from a text response
   * @param {string} text - Full text
   * @param {string} key - Key to extract value for
   * @param {string|null} nextKey - Next key to extract (for determining end of value)
   * @returns {string} Extracted value
   * @private
   */
  _extractValue(text, key, nextKey) {
    const keyRegex = new RegExp(`${key}:\\s*(.+?)(?=\\s*${nextKey}:|$)`, 'is');
    const match = text.match(keyRegex);
    return match ? match[1].trim() : '';
  }

  /**
   * Create an abstract JTBD or scenario from LLM response and child items
   * @param {Object} response - Parsed LLM response
   * @param {Array} childItems - Array of child JTBD or scenario objects
   * @param {string} type - Type of items ('jtbd' or 'scenario')
   * @returns {Object} Abstract item object
   * @private
   */
  _createAbstractItem(response, childItems, type) {
    // Generate a unique ID for the abstract item with the proper prefix
    const timestamp = Date.now().toString(36);
    const id = type === 'scenario' 
      ? `scenario-abstract-${timestamp}`  // Use scenario-abstract-* for scenarios
      : `jtbd-abstract-${timestamp}`;     // Use jtbd-abstract-* for JTBDs
    
    // Set default priority based on average of child items if not provided
    let priority = response.priority;
    if (!priority) {
      const sum = childItems.reduce((acc, item) => acc + (item.priority || 0), 0);
      priority = Math.round(sum / childItems.length);
    }
    
    // Combine all sources from child items
    const sources = [...new Set(childItems.flatMap(item => item.sources || []))];
    
    // Get IDs of all child items
    const childIds = childItems.map(item => item.id);
    
    // Combine related scenarios from all child items
    const relatedScenarios = [...new Set(childItems.flatMap(item => item.relatedScenarios || []))];
    
    // Create the abstract item object
    return {
      id,
      statement: response.statement,
      situation: response.situation,
      motivation: response.motivation,
      outcome: response.outcome,
      priority,
      sourceQuotes: [`Abstract ${type} generated from ${childItems.length} concrete items`],
      relatedScenarios,
      sources,
      parentId: null,
      childIds,
      isAbstract: true,
      level: 0,
      occurrenceCount: childItems.length,
      similarityScore: 1.0,
      lastUpdated: new Date().toISOString(),
      explanation: response.explanation || `Abstract ${type} that encompasses ${childItems.length} similar items`
    };
  }
}

module.exports = new AbstractionGenerator();