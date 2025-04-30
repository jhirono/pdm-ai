// src/utils/consolidation/jtbd-clustering.js
const embeddingsEngine = require('./embeddings-engine');

/**
 * Class for clustering similar JTBDs or scenarios together
 */
class JTBDClustering {
  /**
   * Cluster JTBDs or scenarios based on similarity
   * @param {Array} items - Array of JTBD or scenario objects
   * @param {Object} options - Clustering options
   * @param {number} options.threshold - Similarity threshold (0-1)
   * @param {string} options.method - Clustering method ('semantic' or 'keyword')
   * @param {string} options.type - Type of items ('jtbd' or 'scenario')
   * @returns {Promise<Array>} Array of clusters, each containing similar items
   */
  async clusterJTBDs(items, options = {}) {
    const { 
      threshold = 0.7, 
      method = 'semantic',
      type = 'jtbd'
    } = options;
    
    // Determine the item type label for logging
    const itemType = type === 'scenario' ? 'scenarios' : 'JTBDs';
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return [];
    }
    
    console.log(`Clustering ${items.length} ${itemType} with ${method} method, threshold: ${threshold}`);
    
    // For semantic method, calculate embeddings and cluster based on similarity
    if (method === 'semantic') {
      return this._semanticClustering(items, threshold, itemType);
    }
    
    // For keyword method, use a simpler approach based on text matching
    if (method === 'keyword') {
      return this._keywordClustering(items, threshold);
    }
    
    throw new Error(`Unknown clustering method: ${method}`);
  }
  
  /**
   * Cluster items based on semantic similarity using embeddings
   * @param {Array} items - Array of JTBD or scenario objects
   * @param {number} threshold - Similarity threshold (0-1)
   * @param {string} itemType - Type of items for logging
   * @returns {Promise<Array>} Array of clusters
   * @private
   */
  async _semanticClustering(items, threshold, itemType) {
    // Generate embeddings for all items
    console.log(`Generating embeddings for ${itemType} statements...`);
    
    const statementTexts = items.map(item => item.statement);
    
    try {
      // Get embeddings for all statements
      const embeddings = {};
      
      // Process items in batches to generate embeddings
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const embedding = await embeddingsEngine.generateEmbedding(item.statement);
        embeddings[item.id] = embedding;
        
        // Log progress for large sets
        if (items.length > 20 && i % 10 === 0) {
          console.log(`Generated embeddings for ${i}/${items.length} ${itemType}...`);
        }
      }
      
      // Build similarity matrix
      const similarityMatrix = {};
      
      for (let i = 0; i < items.length; i++) {
        const item1 = items[i];
        similarityMatrix[item1.id] = {};
        
        for (let j = 0; j < items.length; j++) {
          const item2 = items[j];
          
          // Skip self-comparison
          if (i === j) {
            similarityMatrix[item1.id][item2.id] = 1.0;
            continue;
          }
          
          // Skip if we've already calculated this pair
          if (similarityMatrix[item2.id] && similarityMatrix[item2.id][item1.id] !== undefined) {
            similarityMatrix[item1.id][item2.id] = similarityMatrix[item2.id][item1.id];
            continue;
          }
          
          // Calculate similarity between the two items
          const similarity = embeddingsEngine.calculateSimilarity(
            embeddings[item1.id], 
            embeddings[item2.id]
          );
          
          similarityMatrix[item1.id][item2.id] = similarity;
        }
      }
      
      // Perform clustering
      return this._performClustering(items, similarityMatrix, threshold);
    } catch (error) {
      console.error(`Error during semantic clustering: ${error.message}`);
      // Fallback to keyword clustering if embeddings fail
      console.log('Falling back to keyword clustering...');
      return this._keywordClustering(items, threshold);
    }
  }
  
  /**
   * Cluster JTBDs based on keyword matching
   * @param {Array} items - Array of JTBD or scenario objects
   * @param {number} threshold - Similarity threshold (0-1)
   * @returns {Promise<Array>} Array of clusters
   * @private
   */
  async _keywordClustering(items, threshold) {
    // Extract keywords from each item statement
    const keywordSets = {};
    
    items.forEach(item => {
      const keywords = this._extractKeywords(item.statement);
      keywordSets[item.id] = keywords;
    });
    
    // Build similarity matrix based on keyword overlap
    const similarityMatrix = {};
    
    for (let i = 0; i < items.length; i++) {
      const item1 = items[i];
      similarityMatrix[item1.id] = {};
      
      for (let j = 0; j < items.length; j++) {
        const item2 = items[j];
        
        // Skip self-comparison
        if (i === j) {
          similarityMatrix[item1.id][item2.id] = 1.0;
          continue;
        }
        
        // Skip if we've already calculated this pair
        if (similarityMatrix[item2.id] && similarityMatrix[item2.id][item1.id] !== undefined) {
          similarityMatrix[item1.id][item2.id] = similarityMatrix[item2.id][item1.id];
          continue;
        }
        
        // Calculate Jaccard similarity between keyword sets
        const similarity = this._calculateJaccardSimilarity(
          keywordSets[item1.id], 
          keywordSets[item2.id]
        );
        
        similarityMatrix[item1.id][item2.id] = similarity;
      }
    }
    
    // Perform clustering
    return this._performClustering(items, similarityMatrix, threshold);
  }
  
  /**
   * Extract keywords from a string
   * @param {string} text - Text to extract keywords from
   * @returns {Set} Set of keywords
   * @private
   */
  _extractKeywords(text) {
    if (!text) return new Set();
    
    // Convert to lowercase and remove punctuation
    const cleanText = text.toLowerCase().replace(/[^\w\s]/g, '');
    
    // Split into words
    const words = cleanText.split(/\s+/);
    
    // Remove stopwords
    const stopwords = new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'if', 'in', 
      'into', 'is', 'it', 'no', 'not', 'of', 'on', 'or', 'such', 'that', 'the', 
      'their', 'then', 'there', 'these', 'they', 'this', 'to', 'was', 'will', 'with',
      'when', 'i', 'can', 'so', 'want', 'my', 'me'
    ]);
    
    const keywords = words.filter(word => word.length > 2 && !stopwords.has(word));
    
    return new Set(keywords);
  }
  
  /**
   * Calculate Jaccard similarity between two sets
   * @param {Set} set1 - First set
   * @param {Set} set2 - Second set
   * @returns {number} Similarity score between 0 and 1
   * @private
   */
  _calculateJaccardSimilarity(set1, set2) {
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }
  
  /**
   * Perform clustering based on a similarity matrix
   * @param {Array} items - Array of JTBD or scenario objects
   * @param {Object} similarityMatrix - Matrix of similarity scores
   * @param {number} threshold - Similarity threshold
   * @returns {Array} Array of clusters
   * @private
   */
  _performClustering(items, similarityMatrix, threshold) {
    // Use agglomerative hierarchical clustering
    const clusters = [];
    const assigned = new Set();
    
    // Start with each item as its own cluster
    for (let i = 0; i < items.length; i++) {
      if (assigned.has(items[i].id)) continue;
      
      const cluster = [items[i]];
      assigned.add(items[i].id);
      
      // Find similar items to add to this cluster
      for (let j = 0; j < items.length; j++) {
        if (i === j || assigned.has(items[j].id)) continue;
        
        const similarity = similarityMatrix[items[i].id][items[j].id];
        
        if (similarity >= threshold) {
          cluster.push(items[j]);
          assigned.add(items[j].id);
        }
      }
      
      // Add the cluster if it's not a singleton (or include singletons if needed)
      if (cluster.length > 1) {
        clusters.push(cluster);
      } else {
        // Handle singletons
        clusters.push(cluster);
      }
    }
    
    return clusters;
  }
}

module.exports = new JTBDClustering();