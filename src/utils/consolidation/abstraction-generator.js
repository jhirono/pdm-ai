// src/utils/consolidation/abstraction-generator.js
const https = require('https');
const config = require('../config');

/**
 * Class for generating abstract JTBDs from clusters of concrete JTBDs
 */
class AbstractionGenerator {
  constructor() {
    this.apiKey = config.openai.apiKey;
    this.model = null; // No default model in constructor, use environment variable at runtime
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

    // Get the currently selected model from environment or explicit parameter
    // Look at config in case it stores the selected model
    const selectedModel = options.model || process.env.LLM_MODEL || config.llm?.model || 'gpt-3.5-turbo';
    console.log(`Using model ${selectedModel} for abstraction generation`);
    
    try {
      // Extract statements from each item in the cluster
      const statements = itemCluster.map(item => item.statement);
      
      // Generate an abstract item using the LLM
      const response = await this._callLLMForAbstraction(statements, selectedModel);
      
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
   * @returns {Promise<Object>} LLM response with abstraction
   * @private
   */
  async _callLLMForAbstraction(statements, model) {
    if (!this.apiKey) {
      throw new Error("No API key available for OpenAI. Set LLM_API_KEY in your .env file");
    }

    // Format statements for the prompt
    const formattedStatements = statements.map((stmt, i) => `${i + 1}. ${stmt}`).join('\n');

    // Create prompt for generating abstraction
    const prompt = `I have a cluster of similar Jobs-to-be-Done (JTBD) statements from customer feedback. 
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

    try {
      const response = await this._callOpenAIAPI(prompt, model);
      return this._parseResponse(response);
    } catch (error) {
      console.error(`Error calling LLM for abstraction: ${error.message}`);
      return null;
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
      
      const requestData = {
        model: model,
        messages: [
          {
            role: "system",
            content: "You are an expert product manager who specializes in creating Jobs-to-be-Done (JTBD) statements that concisely capture user needs."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      };
      
      const options = {
        hostname: 'api.openai.com',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
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