// src/utils/embedding/embedding-service.js
const https = require('https');
const config = require('../config');
const logger = require('../logger');

/**
 * Get embeddings for a list of texts
 * @param {Array<string>} texts - Texts to generate embeddings for
 * @returns {Promise<Array>} Array of embedding vectors
 */
async function getEmbeddings(texts) {
  try {
    // Get the embedding model from config
    const embeddingModel = config.embedding?.model || 'text-embedding-3-large';
    
    logger.info(`Generating embeddings using ${embeddingModel}...`);
    
    // Use OpenAI's embedding API
    const embeddings = await getOpenAIEmbeddings(texts, embeddingModel);
    
    return embeddings;
  } catch (error) {
    logger.error(`Error getting embeddings: ${error.message}`);
    // Return dummy embeddings as fallback (very basic, just for graceful degradation)
    return texts.map(text => createDummyEmbedding(text));
  }
}

/**
 * Call OpenAI's embedding API to get embeddings for texts
 * @param {Array<string>} texts - Texts to generate embeddings for
 * @param {string} model - OpenAI embedding model to use
 * @returns {Promise<Array>} Array of embedding vectors
 */
async function getOpenAIEmbeddings(texts, model) {
  // Use LLM_API_KEY as specified in the PRD
  const apiKey = config.llmApiKey || process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error("No API key available. Set LLM_API_KEY in your .env file");
  }
  
  // Process in batches to avoid hitting API limits
  const BATCH_SIZE = 10;
  const batches = [];
  
  // Split texts into batches
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    batches.push(texts.slice(i, i + BATCH_SIZE));
  }
  
  // Process each batch
  const allEmbeddings = [];
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    
    logger.debug(`Processing batch ${i + 1}/${batches.length} (${batch.length} texts)...`);
    
    try {
      const batchEmbeddings = await makeOpenAIEmbeddingRequest(apiKey, batch, model);
      allEmbeddings.push(...batchEmbeddings);
      
      // Add a small delay between batches to avoid rate limits
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error) {
      logger.error(`Error processing batch ${i + 1}: ${error.message}`);
      // Create dummy embeddings for the failed batch
      const dummyBatchEmbeddings = batch.map(text => createDummyEmbedding(text));
      allEmbeddings.push(...dummyBatchEmbeddings);
    }
  }
  
  return allEmbeddings;
}

/**
 * Make a request to OpenAI's embedding API
 * @param {string} apiKey - OpenAI API key
 * @param {Array<string>} texts - Texts to embed
 * @param {string} model - Embedding model to use
 * @returns {Promise<Array>} Array of embedding vectors
 */
function makeOpenAIEmbeddingRequest(apiKey, texts, model) {
  return new Promise((resolve, reject) => {
    // Set a 30-second timeout for the API call
    const TIMEOUT_MS = 30000;
    
    const requestData = {
      model: model,
      input: texts
    };
    
    const options = {
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/embeddings',
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
          
          // Extract the embedding vectors from the response
          const embeddings = response.data.map(item => item.embedding);
          resolve(embeddings);
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
 * Create a simple dummy embedding for fallback
 * @param {string} text - Text to create a dummy embedding for
 * @returns {Array} Simple dummy embedding vector
 */
function createDummyEmbedding(text) {
  // Create a very basic embedding based on text features
  // This is just a fallback and not meant to be a good embedding
  const length = text.length;
  const words = text.split(/\s+/).length;
  const chars = Array.from(text.toLowerCase());
  
  // Count some basic features (very simplistic)
  const letterCounts = {};
  for (const char of chars) {
    if (/[a-z]/.test(char)) {
      letterCounts[char] = (letterCounts[char] || 0) + 1;
    }
  }
  
  // Create a 20-dimensional vector with some basic text features
  const embedding = Array(20).fill(0);
  
  // Add some naive "features" (this is really just a emergency placeholder)
  embedding[0] = length / 1000;
  embedding[1] = words / 100;
  
  // Add letter frequencies for some common letters
  const letters = 'etaoinshrdlucmfwypvbgkjqxz';
  letters.split('').forEach((letter, i) => {
    if (i < 18) { // We have 18 slots left (20 - 2)
      embedding[i + 2] = (letterCounts[letter] || 0) / length;
    }
  });
  
  return embedding;
}

module.exports = {
  getEmbeddings
};