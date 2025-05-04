// src/utils/jtbd/providers/claude-provider.js
const https = require('https');
const config = require('../../config');

/**
 * Generate a JTBD using Claude API
 * @param {Array} scenarios - Array of scenario objects
 * @returns {Promise<Object>} Generated JTBD object
 */
async function generateJTBD(scenarios) {
  try {
    console.log("Using Claude API for JTBD generation...");
    
    const apiKey = config.anthropic.apiKey;
    if (!apiKey) {
      throw new Error("No API key available for Claude. Set ANTHROPIC_API_KEY in your .env file");
    }
    
    // Get model configuration
    const model = config.model;
    const maxTokens = config.maxTokens || 1000;
    const temperature = config.temperature || 0.7;
    
    // Create prompts
    const systemPrompt = createSystemPrompt();
    const userPrompt = createUserPrompt(scenarios);
    
    // Call Claude API
    const response = await makeClaudeAPIRequest(
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
    console.error(`Claude API error: ${error.message}`);
    return createFallbackJTBD(scenarios);
  }
}

/**
 * Create system prompt for Claude
 * @returns {string} System prompt
 */
function createSystemPrompt() {
  return `You are an expert product manager skilled at extracting Jobs-to-be-Done (JTBDs) from user scenarios.
You can identify the underlying job that multiple user scenarios are trying to accomplish.
Always provide your output as a valid JSON object with the structure specified in the prompt.
Do not include ANY text outside of the JSON object.`;
}

/**
 * Create user prompt for Claude
 * @param {Array} scenarios - Array of scenario objects
 * @returns {string} User prompt
 */
function createUserPrompt(scenarios) {
  // Check if language should be Japanese
  const isJapanese = config.language === 'ja';
  
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
  "id": "jtbd-[一意のID]",
  "statement": "[状況]のとき、[モチベーション]したい、そうすれば[期待される結果]できる",
  "situation": "[状況]",
  "motivation": "[モチベーション]",
  "outcome": "[期待される結果]",
  "priority": [1-10],
  "sourceQuotes": ["ユーザーシナリオからの証拠となる引用"]
}

重要: JSONオブジェクトのみを返し、JSON以外のテキストを含めないでください。`;
  }
  
  // Default English prompt
  return `Analyze the following user scenarios and extract the underlying Job-to-be-Done (JTBD) that these scenarios are trying to accomplish.
Express the JTBD in the format "When [situation], I want to [motivation], so I can [expected outcome]".

User Scenarios:
${scenariosText}

Assign a priority (1-10, with 10 being highest) and identify the situation, motivation, and outcome elements separately to make the JTBD more specific.
Also provide key quotes or evidence that support this JTBD.

FORMAT YOUR RESPONSE AS A VALID JSON OBJECT WITH THIS STRUCTURE:
{
  "id": "jtbd-[unique-id]",
  "statement": "When [situation], I want to [motivation], so I can [expected outcome]",
  "situation": "[situation]",
  "motivation": "[motivation]",
  "outcome": "[expected outcome]",
  "priority": [1-10],
  "sourceQuotes": ["supporting quotes from user scenarios"]
}

IMPORTANT: Respond with ONLY the JSON object. Do not include any text outside the JSON.`;
}

/**
 * Extract JTBD from Claude API response
 * @param {string} response - API response text
 * @param {Array} scenarios - Original scenarios
 * @returns {Object|null} Parsed JTBD or null if parsing fails
 */
function extractJTBDFromResponse(response, scenarios) {
  if (!response) return createFallbackJTBD(scenarios);
  
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
    
    return createFallbackJTBD(scenarios);
  } catch (e) {
    console.log(`Failed to parse API response: ${e.message}. Using fallback JTBD.`);
    return createFallbackJTBD(scenarios);
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
  
  return {
    id: `jtbd-${Date.now().toString(36)}`,
    statement: `When using a product or service, I want to efficiently accomplish my goals, so I can improve my overall experience`,
    situation: "using a product or service",
    motivation: "efficiently accomplish my goals",
    outcome: "improve my overall experience",
    priority: 7,
    sourceQuotes: scenarios.map(s => s.statement).slice(0, 3)
  };
}

/**
 * Make a direct HTTPS request to Claude API
 * @param {string} apiKey - Claude API key
 * @param {string} systemPrompt - System prompt
 * @param {string} userPrompt - User prompt
 * @param {string} model - Claude model to use
 * @param {number} maxTokens - Maximum tokens for response
 * @param {number} temperature - Temperature for response generation
 * @returns {Promise<string>} Claude API response
 */
function makeClaudeAPIRequest(apiKey, systemPrompt, userPrompt, model, maxTokens, temperature) {
  return new Promise((resolve, reject) => {
    // Set a 3-minute timeout for the API call
    const TIMEOUT_MS = 180000;
    
    const requestData = {
      model: model,
      max_tokens: maxTokens,
      temperature: temperature,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt
        }
      ]
    };
    
    const options = {
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
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
            reject(new Error(`API returned status code ${res.statusCode}: ${data}`));
            return;
          }
          
          const response = JSON.parse(data);
          resolve(response.content && response.content[0] && response.content[0].text ? response.content[0].text : "");
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

module.exports = {
  generateJTBD
};