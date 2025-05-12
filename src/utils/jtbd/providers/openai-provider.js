// src/utils/jtbd/providers/openai-provider.js
import https from 'https';
import config from '../../config.js';
import logger from '../../logger.js';

/**
 * Generate a JTBD using OpenAI API
 * @param {Array} scenarios - Array of scenario objects
 * @returns {Promise<Object>} Generated JTBD object
 */
async function generateJTBD(scenarios) {
  try {
    logger.info("Using OpenAI API for JTBD generation...");
    
    // Use LLM_API_KEY as specified in the PRD
    const apiKey = config.llmApiKey || process.env.LLM_API_KEY;
    if (!apiKey) {
      throw new Error("No API key available. Set LLM_API_KEY in your .env file");
    }
    
    // Get model configuration
    const model = config.model || 'gpt-4o';
    const maxTokens = config.maxTokens || 1000;
    const temperature = config.temperature || 0.7;
    
    // Log language being used
    logger.debug(`Using language: ${config.language}`);
    
    // Create prompts
    const systemPrompt = createSystemPrompt();
    const userPrompt = createUserPrompt(scenarios);
    
    // Call OpenAI API
    const response = await makeOpenAIAPIRequest(
      apiKey, 
      systemPrompt, 
      userPrompt, 
      model,
      maxTokens,
      temperature
    );
    
    // Extract JSON from response
    return extractJTBDFromResponse(response, scenarios);
  } catch (error) {
    logger.error(`OpenAI API error: ${error.message}`);
    return createFallbackJTBD(scenarios);
  }
}

/**
 * Generate an abstract JTBD from multiple lower-level JTBDs
 * @param {Array} jtbds - Array of JTBD objects
 * @returns {Promise<Object>} Generated abstract JTBD object
 */
async function generateAbstractJTBD(jtbds) {
  try {
    logger.info(`Using OpenAI API to generate abstract JTBD from ${jtbds.length} JTBDs...`);
    
    const apiKey = config.llmApiKey || process.env.LLM_API_KEY;
    if (!apiKey) {
      throw new Error("No API key available. Set LLM_API_KEY in your .env file");
    }
    
    // Get model configuration
    const model = config.model || 'gpt-4o';
    const maxTokens = config.maxTokens || 1000;
    const temperature = config.temperature || 0.7;
    
    // Create prompts
    const systemPrompt = createSystemPromptForAbstraction();
    const userPrompt = createUserPromptForAbstraction(jtbds);
    
    // Call OpenAI API
    const response = await makeOpenAIAPIRequest(
      apiKey, 
      systemPrompt, 
      userPrompt, 
      model,
      maxTokens,
      temperature
    );
    
    // Extract JSON from response
    return extractJTBDFromResponse(response, null, jtbds);
  } catch (error) {
    logger.error(`OpenAI API error for abstract JTBD: ${error.message}`);
    return createFallbackAbstractJTBD(jtbds);
  }
}

/**
 * Create system prompt for OpenAI
 * @returns {string} System prompt
 */
function createSystemPrompt() {
  return `You are an expert product manager skilled at extracting Jobs-to-be-Done (JTBDs) from user scenarios.
You can identify the underlying job that multiple user scenarios are trying to accomplish.
Always provide your output as a valid JSON object with the structure specified in the prompt.
Do not include ANY text outside of the JSON object.`;
}

/**
 * Create system prompt for JTBD abstraction
 * @returns {string} System prompt
 */
function createSystemPromptForAbstraction() {
  return `You are an expert product manager skilled at identifying higher-level Jobs-to-be-Done (JTBDs) from more specific JTBDs.
You can identify the underlying job that connects multiple more specific JTBDs.
Always provide your output as a valid JSON object with the structure specified in the prompt.
Your abstract JTBD should be more general but still specific enough to be meaningful and actionable.
Do not include ANY text outside of the JSON object.`;
}

/**
 * Create user prompt for OpenAI
 * @param {Array} scenarios - Array of scenario objects
 * @returns {string} User prompt
 */
function createUserPrompt(scenarios) {
  // Check if language should be Japanese, using the getter for direct access
  const isJapanese = config.language === 'ja';
  logger.debug(`Creating prompt with language setting: ${config.language}, isJapanese: ${isJapanese}`);
  
  // Format scenarios for display in the prompt
  const scenariosText = scenarios.map((scenario, index) => 
    `${index + 1}. ${scenario.statement}`
  ).join('\n');
  
  // Determine which prompt template to use based on language
  if (isJapanese) {
    return `以下のユーザーシナリオを分析し、これらのシナリオの根底にある「Jobs-to-be-Done (JTBD)」を抽出してください。
JTBDは「[状況]のとき、[モチベーション]したい、そうすれば[期待される結果]できる」の形式で表現してください。

ユーザーシナリオ:
${scenariosText}

優先度（1〜10、10が最高）を割り当て、JTBDをより具体的に説明するために状況、モチベーション、結果の要素を個別に特定してください。
また、このJTBDをサポートするための重要な引用や証拠を提供してください。

以下の形式で有効なJSONオブジェクトとして回答してください:
{
  "statement": "[状況]のとき、[モチベーション]したい、そうすれば[期待される結果]できる",
  "situation": "[状況]",
  "motivation": "[モチベーション]",
  "outcome": "[期待される結果]",
  "sourceQuotes": ["ユーザーシナリオからの証拠となる引用"]
}

重要: JSONオブジェクトのみを返し、JSON以外のテキストを含めないでください。`;
  }
  
  // Default English prompt
  return `Analyze the following user scenarios and extract the underlying Job-to-be-Done (JTBD) that these scenarios are trying to accomplish.
Express the JTBD in the format "When [situation], I want to [motivation], so I can [expected outcome]".

User Scenarios:
${scenariosText}

Identify the situation, motivation, and outcome elements separately to make the JTBD more specific.
Also provide key quotes or evidence that support this JTBD.

FORMAT YOUR RESPONSE AS A VALID JSON OBJECT WITH THIS STRUCTURE:
{
  "statement": "When [situation], I want to [motivation], so I can [expected outcome]",
  "situation": "[situation]",
  "motivation": "[motivation]",
  "outcome": "[expected outcome]",
  "sourceQuotes": ["supporting quotes from user scenarios"]
}

IMPORTANT: Respond with ONLY the JSON object. Do not include any text outside the JSON.`;
}

/**
 * Create user prompt for JTBD abstraction
 * @param {Array} jtbds - Array of JTBD objects
 * @returns {string} User prompt
 */
function createUserPromptForAbstraction(jtbds) {
  // Check if language should be Japanese
  const isJapanese = config.language === 'ja';
  
  // Format JTBDs for display in the prompt
  const jtbdsText = jtbds.map((jtbd, index) => 
    `${index + 1}. ${jtbd.statement}\n   Situation: ${jtbd.situation}\n   Motivation: ${jtbd.motivation}\n   Outcome: ${jtbd.outcome}`
  ).join('\n\n');
  
  if (isJapanese) {
    return `以下のJTBDを分析し、これらのJTBDをまとめるより抽象的な「高次のJTBD」を作成してください。
この高次のJTBDは、より具体的な複数のJTBDに共通する根本的なジョブを表現する必要があります。
JTBDは「[状況]のとき、[モチベーション]したい、そうすれば[期待される結果]できる」の形式で表現してください。

JTBDs:
${jtbdsText}

優先度（1〜10、10が最高）を割り当て、JTBDをより具体的に説明するために状況、モチベーション、結果の要素を個別に特定してください。
また、このJTBDをサポートするための重要な引用や証拠を提供してください。

以下の形式で有効なJSONオブジェクトとして回答してください:
{
  "statement": "[状況]のとき、[モチベーション]したい、そうすれば[期待される結果]できる",
  "situation": "[状況]",
  "motivation": "[モチベーション]",
  "outcome": "[期待される結果]",
  "sourceQuotes": ["元のJTBDからの証拠となる引用"]
}

重要: JSONオブジェクトのみを返し、JSON以外のテキストを含めないでください。`;
  }
  
  // Default English prompt
  return `Analyze the following Jobs-to-be-Done (JTBDs) and create a higher-level, more abstract JTBD that encompasses all of them.
This abstract JTBD should represent the fundamental job that connects these more specific JTBDs.
Express the JTBD in the format "When [situation], I want to [motivation], so I can [expected outcome]".

JTBDs:
${jtbdsText}

Identify the situation, motivation, and outcome elements separately to make the JTBD more specific.
Also provide key quotes or evidence from the original JTBDs that support this abstract JTBD.

FORMAT YOUR RESPONSE AS A VALID JSON OBJECT WITH THIS STRUCTURE:
{
  "statement": "When [situation], I want to [motivation], so I can [expected outcome]",
  "situation": "[situation]",
  "motivation": "[motivation]",
  "outcome": "[expected outcome]",
  "sourceQuotes": ["supporting quotes from original JTBDs"]
}

IMPORTANT: Respond with ONLY the JSON object. Do not include any text outside the JSON.`;
}

/**
 * Extract JTBD from OpenAI API response
 * @param {string} response - API response text
 * @param {Array} scenarios - Original scenarios (optional)
 * @param {Array} jtbds - Original JTBDs for abstraction (optional)
 * @returns {Object|null} Parsed JTBD or null if parsing fails
 */
function extractJTBDFromResponse(response, scenarios = null, jtbds = null) {
  if (!response) return scenarios ? createFallbackJTBD(scenarios) : createFallbackAbstractJTBD(jtbds);
  
  try {
    // Strategy 1: Try to find a JSON block with ```json markers
    const jsonBlockMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch && jsonBlockMatch[1]) {
      return JSON.parse(jsonBlockMatch[1].trim());
    }
    
    // Strategy 2: Try to find anything that looks like a JSON object
    const jsonObjectMatch = response.match(/(\{[\s\S]*\})/);
    if (jsonObjectMatch && jsonObjectMatch[1]) {
      // Try to fix common JSON parsing issues
      let jsonCandidate = jsonObjectMatch[1].trim();
      
      // Replace single quotes with double quotes
      jsonCandidate = jsonCandidate.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":');
      // Replace single quotes in values with double quotes
      jsonCandidate = jsonCandidate.replace(/: ?'([^']*)'/g, ': "$1"');
      
      return JSON.parse(jsonCandidate);
    }
    
    return scenarios ? createFallbackJTBD(scenarios) : createFallbackAbstractJTBD(jtbds);
  } catch (e) {
    logger.error(`Failed to parse API response: ${e.message}. Using fallback JTBD.`);
    return scenarios ? createFallbackJTBD(scenarios) : createFallbackAbstractJTBD(jtbds);
  }
}

/**
 * Create a fallback JTBD when API call or parsing fails
 * @param {Array} scenarios - Original scenarios
 * @returns {Object} Fallback JTBD
 */
function createFallbackJTBD(scenarios) {
  // Extract common personas
  const personas = scenarios.map(s => s.persona).filter(Boolean);
  let commonPersona = "user";
  if (personas.length > 0) {
    // Find the most frequent persona
    const personaCounts = {};
    let maxCount = 0;
    personas.forEach(persona => {
      personaCounts[persona] = (personaCounts[persona] || 0) + 1;
      if (personaCounts[persona] > maxCount) {
        maxCount = personaCounts[persona];
        commonPersona = persona;
      }
    });
  }
  
  // Extract actions and values
  const actions = scenarios.map(s => s.action).filter(Boolean);
  const values = scenarios.map(s => s.value).filter(Boolean);
  
  // Create a fallback statement
  let situation = "using a product or service";
  let motivation = "efficiently accomplish my goals";
  let outcome = "improve my overall experience";
  
  // Use actual data if available
  if (actions.length > 0) {
    motivation = actions[0] || motivation;
  }
  if (values.length > 0) {
    outcome = values[0] || outcome;
  }
  
  return {
    statement: `When ${situation}, I want to ${motivation}, so I can ${outcome}`,
    situation: situation,
    motivation: motivation,
    outcome: outcome,
    sourceQuotes: scenarios.map(s => s.statement).slice(0, 3)
  };
}

/**
 * Create a fallback abstract JTBD when API call or parsing fails
 * @param {Array} jtbds - Original JTBDs
 * @returns {Object} Fallback abstract JTBD
 */
function createFallbackAbstractJTBD(jtbds) {
  // Extract situations, motivations, and outcomes
  const situations = jtbds.map(j => j.situation).filter(Boolean);
  const motivations = jtbds.map(j => j.motivation).filter(Boolean);
  const outcomes = jtbds.map(j => j.outcome).filter(Boolean);
  
  // Create a fallback statement
  let situation = "facing a common challenge";
  let motivation = "find an effective solution";
  let outcome = "achieve my objectives efficiently";
  
  // Use actual data if available
  if (situations.length > 0 && situations[0]) {
    situation = situations[0];
  }
  if (motivations.length > 0 && motivations[0]) {
    motivation = motivations[0];
  }
  if (outcomes.length > 0 && outcomes[0]) {
    outcome = outcomes[0];
  }
  
  return {
    statement: `When ${situation}, I want to ${motivation}, so I can ${outcome}`,
    situation: situation,
    motivation: motivation,
    outcome: outcome,
    sourceQuotes: jtbds.map(j => j.statement).slice(0, 3)
  };
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
function makeOpenAIAPIRequest(apiKey, systemMessage, userMessage, model, maxTokens, temperature) {
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
    
    // Check if the model is a reasoning model
    const reasoningModels = ['o4-mini', 'o3', 'o3-mini', 'o1', 'o1-mini', 'o1-pro'];
    const isReasoningModel = reasoningModels.some(rm => model.includes(rm));
    
    // Handle model-specific parameters
    if (model.startsWith('o3') || model.startsWith('o4') || model.startsWith('o1')) {
      // o1, o3 and o4 models use max_completion_tokens instead of max_tokens
      requestData.max_completion_tokens = maxTokens;
      
      // Only add temperature for non-reasoning models
      if (!isReasoningModel) {
        requestData.temperature = temperature;
      } else {
        // Reasoning models don't support temperature parameter
        // https://platform.openai.com/docs/guides/reasoning
        logger.debug(`Using reasoning model ${model}, skipping temperature parameter`);
      }
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
          logger.error(`Failed to parse API response: ${e.message}. Using empty string.`);
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

export {
  generateJTBD,
  generateAbstractJTBD
};