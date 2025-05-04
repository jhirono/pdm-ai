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
      
      // Create system message - can be the same for both languages
      const systemMessage = `You are an expert product manager skilled at extracting user scenarios from customer feedback.
Focus exclusively on identifying user scenarios in the "As a [persona], I want to [action], so that I can [value/goal]" format.
Look for real user needs and pain points in the input text and formulate them as clear user scenarios.
Try to identify specific personas rather than using generic terms like "user" when possible.
Ensure each scenario clearly articulates what the user wants to accomplish and why.
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

FORMAT YOUR RESPONSE AS JSON with the structure:
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

IMPORTANT: Respond with ONLY the JSON object. Do not include any text outside the JSON.`;
      }

      const response = await this.openai.createChatCompletion({
        model: llmConfig.model || 'gpt-4o',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage }
        ],
        max_tokens: llmConfig.maxTokens || 4000,
        temperature: llmConfig.temperature || 0.7,
      });

      const result = response.data.choices[0].message.content.trim();
      
      // Parse the JSON result
      let parsedResult;
      try {
        parsedResult = JSON.parse(result);
      } catch (parseError) {
        // Try to extract JSON from text if the response is not properly formatted
        const jsonMatch = result.match(/({[\s\S]*})/);
        if (jsonMatch) {
          parsedResult = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Failed to parse LLM response as JSON');
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