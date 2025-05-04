/**
 * Scenario Parser
 * Extracts user scenarios from text content using LLM
 */
const { Configuration, OpenAIApi } = require('openai');
const config = require('../config');
const logger = require('../logger');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

class ScenarioParser {
  constructor() {
    this.openai = null;
    this.initializeOpenAI();
  }

  /**
   * Initialize OpenAI client with API key from config
   */
  initializeOpenAI() {
    try {
      const apiKey = process.env.LLM_API_KEY || config.getConfig().llm.apiKey;
      if (!apiKey) {
        logger.warn('OpenAI API key not found. Set LLM_API_KEY in your .env file.');
        return;
      }

      const configuration = new Configuration({ apiKey });
      this.openai = new OpenAIApi(configuration);
      logger.debug('OpenAI client initialized');
    } catch (error) {
      logger.error(`Failed to initialize OpenAI client: ${error.message}`);
    }
  }

  /**
   * Extract user scenarios from text content
   * @param {string} content - Text content to parse
   * @param {object} sourceInfo - Information about the source file
   * @returns {Promise<Array>} - Array of extracted scenarios
   */
  async extractScenarios(content, sourceInfo) {
    if (!this.openai) {
      this.initializeOpenAI();
      if (!this.openai) {
        throw new Error('OpenAI client not initialized. Check your API key.');
      }
    }

    logger.debug(`Extracting scenarios from source: ${sourceInfo.name}`);
    
    // Determine the language based on config
    const language = config.getConfig().language || 'en';
    logger.debug(`Using language setting: ${language}`);

    try {
      const llmConfig = config.getConfig().llm;
      
      // Get model name from environment variable or config, with proper priority
      const model = process.env.LLM_MODEL || llmConfig.model || 'gpt-4o';
      logger.debug(`Using model: ${model} (from env or config)`);
      
      // List of all OpenAI reasoning models
      const reasoningModels = ['o4-mini', 'o3', 'o3-mini', 'o1', 'o1-mini', 'o1-pro'];
      const isReasoningModel = reasoningModels.some(rm => model.includes(rm));
      
      // Create system message - can be the same for both languages
      const systemMessage = `You are an expert product manager skilled at extracting user scenarios from customer feedback.
Focus exclusively on identifying user scenarios in the "As a [persona], I want to [action], so that I can [value/goal]" format.
Look for real user needs and pain points in the input text and formulate them as clear user scenarios.
Try to identify specific personas rather than using generic terms like "user" when possible.
Ensure each scenario clearly articulates what the user wants to accomplish and why.
${isReasoningModel ? 'IMPORTANT: Your response MUST be a valid JSON object with no additional text, explanations, or markdown.' : ''}
Always provide your output as a valid JSON object with the structure specified in the prompt.
Do not include ANY text outside of the JSON object.`;
      
      // Create user message based on language
      let userMessage;
      
      if (language === 'ja') {
        userMessage = `
以下のテキストからユーザーシナリオを「〜として、私は〜したい、それによって〜できる」の形式で抽出してください。

また、言及されている顧客や企業名も特定してください。

以下の構造でJSONフォーマットで回答してください：
{
  "scenarios": [
    {
      "statement": "[ペルソナ]として、私は[アクション]したい、それによって[価値/目標]できる",
      "persona": "[ペルソナ]",
      "action": "[アクション]",
      "value": "[価値/目標]"
    }
  ],
  "customer": "[特定された企業名または複数の企業名、特定されない場合はnull]"
}

分析するテキスト：
${content}

重要: JSONオブジェクトのみを返し、JSON以外のテキストを含めないでください。`;
      } else {
        userMessage = `
Extract user scenarios from the following text in the format:
"As a [persona], I want to [action], so that I can [value/goal]"

Also identify any customer or company names mentioned.

FORMAT YOUR RESPONSE AS JSON with this exact structure:
{
  "scenarios": [
    {
      "statement": "As a [persona], I want to [action], so that I can [value/goal]",
      "persona": "[persona]",
      "action": "[action]",
      "value": "[value/goal]"
    }
  ],
  "customer": "[Company name or names if identified, otherwise null]"
}

Text to analyze:
${content}

${isReasoningModel ? 'EXTREMELY IMPORTANT: Your response MUST be valid JSON only, with NO explanations, NO markdown formatting, and NO text outside the JSON structure. Use double quotes for all keys and string values.' : ''}
IMPORTANT: Respond with ONLY the JSON object. Do not include any text outside the JSON.`;
      }

      // Prepare API request parameters
      const requestParams = {
        model: model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage }
        ]
      };
      
      // Handle model-specific parameters (both temperature and token limits)
      if (isReasoningModel) {
        // Reasoning models use max_completion_tokens and don't support temperature
        requestParams.max_completion_tokens = llmConfig.maxTokens || 4000;
        logger.debug(`Using reasoning model: ${model} with max_completion_tokens: ${requestParams.max_completion_tokens}`);
        
        // For some reasoning models that might have issues with JSON output,
        // use a simpler prompt structure to increase chances of successful parsing
        if (model === 'o4-mini') {
          // Add response_format parameter to explicitly request JSON
          requestParams.response_format = { type: "json_object" };
          logger.debug("Added response_format: json_object for o4-mini model");
        }
      } else if (model.startsWith('o3') || model.startsWith('o4') || model.startsWith('o1')) {
        // Other o-series models use max_completion_tokens but support temperature
        requestParams.max_completion_tokens = llmConfig.maxTokens || 4000;
        requestParams.temperature = llmConfig.temperature || 0.7;
        logger.debug(`Using model ${model} with max_completion_tokens and temperature: ${requestParams.temperature}`);
      } else {
        // Legacy models use max_tokens parameter
        requestParams.max_tokens = llmConfig.maxTokens || 4000;
        requestParams.temperature = llmConfig.temperature || 0.7;
        logger.debug(`Using legacy model ${model} with max_tokens: ${requestParams.max_tokens} and temperature: ${requestParams.temperature}`);
      }

      const response = await this.openai.createChatCompletion(requestParams);

      const result = response.data.choices[0].message.content.trim();
      
      // Log just a snippet of the response for debugging
      logger.debug(`Response snippet (first 50 chars): ${result.substring(0, 50)}...`);
      
      // Check for empty response
      if (!result || result.length === 0) {
        logger.error(`Empty response received from ${model}. This may indicate an issue with the model's ability to handle your prompt or content.`);
        logger.info(`Switching to fallback scenario extraction for ${sourceInfo.name}`);
        return this.transformScenarios(this.createFallbackResult(content), sourceInfo);
      }
      
      // Parse the JSON result
      let parsedResult;
      try {
        // First try: direct JSON parse
        parsedResult = JSON.parse(result);
        logger.debug("Successfully parsed response as JSON directly");
      } catch (parseError) {
        logger.debug(`Direct JSON parse failed: ${parseError.message}`);
        
        try {
          // Second try: Look for JSON object pattern
          const jsonMatch = result.match(/({[\s\S]*})/);
          if (jsonMatch) {
            parsedResult = JSON.parse(jsonMatch[0]);
            logger.debug("Successfully parsed JSON using object pattern match");
          } else {
            // Third try: Look for JSON with backticks
            const codeBlockMatch = result.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (codeBlockMatch) {
              parsedResult = JSON.parse(codeBlockMatch[1]);
              logger.debug("Successfully parsed JSON from code block");
            } else {
              // Fourth try: Sometimes reasoning models might add explanations - try to clean and parse
              let cleanedResult = this.extractAndCleanJson(result);
              if (cleanedResult) {
                try {
                  parsedResult = JSON.parse(cleanedResult);
                  logger.debug("Successfully parsed cleaned JSON");
                } catch (cleanError) {
                  logger.debug(`Cleaning and parsing failed: ${cleanError.message}`);
                  parsedResult = this.createFallbackResult(content);
                }
              } else {
                logger.warn(`Could not parse response as JSON. Using fallback.`);
                parsedResult = this.createFallbackResult(content);
              }
            }
          }
        } catch (nestedError) {
          logger.error(`All JSON parsing attempts failed: ${nestedError.message}`);
          parsedResult = this.createFallbackResult(content);
        }
      }

      logger.debug(`Successfully extracted scenarios in ${language} language`);
      
      // Transform extracted scenarios to our data structure
      return this.transformScenarios(parsedResult, sourceInfo);
    } catch (error) {
      logger.error(`Error extracting scenarios: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract and clean JSON from various formats that might be returned by reasoning models
   * @param {string} text - Text that might contain JSON
   * @returns {string|null} - Cleaned JSON string or null if not found
   */
  extractAndCleanJson(text) {
    try {
      // Look for text that starts with { and ends with }
      const jsonPattern = /(\{[\s\S]*\})/;
      const match = text.match(jsonPattern);
      
      if (match) {
        let jsonCandidate = match[0];
        
        // Fix common JSON formatting issues
        // Replace single quotes with double quotes around keys
        jsonCandidate = jsonCandidate.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":');
        
        // Replace single quotes around string values with double quotes
        jsonCandidate = jsonCandidate.replace(/:\s*'([^']*)'/g, ': "$1"');

        // Fix trailing commas in arrays and objects (common JSON parsing error)
        jsonCandidate = jsonCandidate.replace(/,\s*}/g, '}').replace(/,\s*\]/g, ']');
        
        return jsonCandidate;
      }
      
      return null;
    } catch (error) {
      logger.error(`Error cleaning JSON: ${error.message}`);
      return null;
    }
  }

  /**
   * Attempt to extract scenarios from reasoning model output that might not be valid JSON
   * @param {string} text - Raw text from the model
   * @param {string} originalContent - Original content that was analyzed
   * @returns {Object|null} - Extracted scenarios or null if extraction failed
   */
  extractScenariosFromReasoningResponse(text, originalContent) {
    if (!text) {
      return null;
    }
    
    try {
      logger.debug('Attempting to extract scenarios from reasoning model response');
      
      // Look for scenario patterns in the text
      const scenarios = [];
      
      // Pattern for "As a [persona], I want to [action], so that I can [value]"
      const scenarioRegex = /As a(?:n)? ([^,]+),\s+I want to ([^,]+),\s+so (?:that )?I can ([^\.;\n]+)/gi;
      let match;
      
      while ((match = scenarioRegex.exec(text)) !== null) {
        if (match.length >= 4) {
          scenarios.push({
            statement: match[0],
            persona: match[1].trim(),
            action: match[2].trim(),
            value: match[3].trim()
          });
        }
      }
      
      // If we found scenarios, construct a result object
      if (scenarios.length > 0) {
        logger.debug(`Extracted ${scenarios.length} scenarios from reasoning model output`);
        
        // Try to extract company names
        const companyRegex = /(?:company|companies|customer|customers|enterprise|organization):\s*([^\.]+)/i;
        const companyMatch = text.match(companyRegex);
        
        let customer = null;
        if (companyMatch && companyMatch.length > 1) {
          customer = companyMatch[1].trim();
        } else {
          // Extract any company name mentioned in the content with Co., Inc., Ltd., etc.
          const companyNameRegex = /([A-Z][A-Za-z0-9\s]+(?:Co\.|Corp\.|Inc\.|Ltd\.|Limited|Company|Corporation))/g;
          const companyNames = [];
          let nameMatch;
          
          while ((nameMatch = companyNameRegex.exec(originalContent)) !== null) {
            if (nameMatch.length > 1) {
              companyNames.push(nameMatch[1].trim());
            }
          }
          
          if (companyNames.length > 0) {
            customer = companyNames.join(', ');
          }
        }
        
        return {
          scenarios: scenarios,
          customer: customer
        };
      }
      
      return null;
    } catch (error) {
      logger.error(`Error extracting scenarios from reasoning model output: ${error.message}`);
      return null;
    }
  }

  /**
   * Create a fallback result when JSON parsing fails
   * @param {string} content - Original content
   * @returns {Object} - Fallback result object
   */
  createFallbackResult(content) {
    // Create a simple fallback with one generic scenario
    return {
      scenarios: [
        {
          statement: "As a user, I want to accomplish my goals, so that I can improve my experience",
          persona: "user",
          action: "accomplish my goals",
          value: "improve my experience"
        }
      ],
      customer: null
    };
  }

  /**
   * Transform extracted scenarios into our data structure
   * @param {object} extractedData - Raw data from LLM
   * @param {object} sourceInfo - Information about the source file
   * @returns {Array} - Transformed scenarios
   */
  transformScenarios(extractedData, sourceInfo) {
    const { scenarios = [], customer = null } = extractedData;
    const timestamp = new Date().toISOString();
    
    return scenarios.map(scenario => ({
      id: `scenario-${uuidv4()}`,
      format: "user-story",
      statement: scenario.statement,
      persona: scenario.persona,
      action: scenario.action,
      value: scenario.value,
      sources: [sourceInfo.id],
      customer: customer || null,
      version: "1.0",
      timestamp: timestamp
    }));
  }
}

module.exports = new ScenarioParser();