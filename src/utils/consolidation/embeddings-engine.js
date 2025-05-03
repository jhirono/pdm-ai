// src/utils/consolidation/embeddings-engine.js
const https = require('https');
const config = require('../config');

/**
 * Engine for generating embeddings for JTBD statements and calculating similarity
 */
class EmbeddingsEngine {
  constructor() {
    // Use embedding configuration from config
    this.apiKey = config.embedding.apiKey;
    this.embeddingModel = config.embedding.model;
    
    this.embeddings = {}; // Cache of generated embeddings
  }

  /**
   * Generate an embedding for a given text using OpenAI's API
   * @param {string} text - Text to generate embedding for
   * @returns {Promise<number[]>} Vector embedding
   */
  async generateEmbedding(text) {
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid text provided for embedding generation');
    }

    // Check if we already have this embedding cached
    const cacheKey = this._getCacheKey(text);
    if (this.embeddings[cacheKey]) {
      return this.embeddings[cacheKey];
    }

    try {
      if (!this.apiKey) {
        throw new Error("No API key available for OpenAI. Set LLM_API_KEY in your .env file");
      }

      const response = await this._callOpenAIEmbeddingsAPI(text);
      const embedding = response.data[0].embedding;
      
      // Cache the embedding
      this.embeddings[cacheKey] = embedding;
      
      return embedding;
    } catch (error) {
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for a batch of texts
   * @param {string[]} texts - Array of texts to generate embeddings for
   * @returns {Promise<Object>} Map of texts to their embeddings
   */
  async generateBatchEmbeddings(texts) {
    const result = {};
    
    // Process in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const promises = batch.map(text => this.generateEmbedding(text)
        .then(embedding => {
          result[text] = embedding;
        })
        .catch(error => {
          console.error(`Error generating embedding for "${text.substring(0, 30)}...": ${error.message}`);
        })
      );
      
      await Promise.all(promises);
      
      // Small delay between batches to avoid rate limits
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return result;
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param {number[]} vec1 - First vector
   * @param {number[]} vec2 - Second vector
   * @returns {number} Similarity score between 0 and 1
   */
  calculateSimilarity(vec1, vec2) {
    if (!vec1 || !vec2 || !Array.isArray(vec1) || !Array.isArray(vec2)) {
      throw new Error('Invalid vectors provided for similarity calculation');
    }
    
    if (vec1.length !== vec2.length) {
      throw new Error(`Vector dimensions don't match: ${vec1.length} vs ${vec2.length}`);
    }
    
    // Calculate dot product
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      mag1 += vec1[i] * vec1[i];
      mag2 += vec2[i] * vec2[i];
    }
    
    mag1 = Math.sqrt(mag1);
    mag2 = Math.sqrt(mag2);
    
    if (mag1 === 0 || mag2 === 0) {
      return 0;
    }
    
    // Cosine similarity
    return dotProduct / (mag1 * mag2);
  }

  /**
   * Calculate similarity between two texts
   * @param {string} text1 - First text
   * @param {string} text2 - Second text
   * @returns {Promise<number>} Similarity score between 0 and 1
   */
  async calculateTextSimilarity(text1, text2) {
    const embedding1 = await this.generateEmbedding(text1);
    const embedding2 = await this.generateEmbedding(text2);
    
    return this.calculateSimilarity(embedding1, embedding2);
  }

  /**
   * Generate a cache key for a text
   * @param {string} text - Text to generate cache key for
   * @returns {string} Cache key
   * @private
   */
  _getCacheKey(text) {
    // Simple cache key generation - in production you might want to use a hash
    return text.trim().toLowerCase().substring(0, 100);
  }

  /**
   * Call OpenAI's embeddings API
   * @param {string} text - Text to generate embedding for
   * @returns {Promise<Object>} API response
   * @private
   */
  _callOpenAIEmbeddingsAPI(text) {
    return new Promise((resolve, reject) => {
      // Set a timeout for the API call
      const TIMEOUT_MS = 30000;
      
      const requestData = {
        model: this.embeddingModel,
        input: text.trim()
      };
      
      const options = {
        hostname: 'api.openai.com',
        port: 443,
        path: '/v1/embeddings',
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
            resolve(response);
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
}

module.exports = new EmbeddingsEngine();