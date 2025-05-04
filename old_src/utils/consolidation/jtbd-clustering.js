// src/utils/consolidation/jtbd-clustering.js
const config = require('../config');
const embeddingService = require('../embedding/embedding-service');

/**
 * Cluster scenarios based on semantic similarity
 * @param {Array} scenarios - Array of scenario objects
 * @param {Object} options - Clustering options
 * @returns {Promise<Array>} Array of scenario clusters
 */
async function clusterScenarios(scenarios, options = {}) {
  try {
    console.log(`Clustering ${scenarios.length} scenarios...`);
    
    // Set default options
    const threshold = options.threshold || 0.5;
    const verbose = options.verbose || false;
    
    if (verbose) {
      console.log(`Using similarity threshold: ${threshold}`);
    }
    
    // Extract statements for embedding
    const statements = scenarios.map(scenario => scenario.statement);
    
    // Get embeddings for all statements
    const embeddings = await embeddingService.getEmbeddings(statements);
    
    if (!embeddings || embeddings.length !== statements.length) {
      throw new Error("Failed to generate embeddings for scenarios");
    }
    
    // Create similarity matrix
    const similarityMatrix = calculateSimilarityMatrix(embeddings);
    
    // Apply clustering algorithm
    const clusters = clusterBySimilarity(similarityMatrix, scenarios, threshold);
    
    if (verbose) {
      console.log(`Created ${clusters.length} clusters`);
      clusters.forEach((cluster, index) => {
        console.log(`Cluster ${index + 1}: ${cluster.length} scenarios`);
      });
    }
    
    return clusters;
  } catch (error) {
    console.error(`Error clustering scenarios: ${error.message}`);
    // If clustering fails, put each scenario in its own cluster
    return scenarios.map(scenario => [scenario]);
  }
}

/**
 * Cluster JTBDs based on semantic similarity
 * @param {Array} jtbds - Array of JTBD objects
 * @param {Object} options - Clustering options
 * @returns {Promise<Array>} Array of JTBD clusters
 */
async function clusterJTBDs(jtbds, options = {}) {
  try {
    console.log(`Clustering ${jtbds.length} JTBDs...`);
    
    // Set default options
    const threshold = options.threshold || 0.5;
    const verbose = options.verbose || false;
    
    if (verbose) {
      console.log(`Using similarity threshold: ${threshold}`);
    }
    
    // Extract statements for embedding
    const statements = jtbds.map(jtbd => jtbd.statement);
    
    // Get embeddings for all statements
    const embeddings = await embeddingService.getEmbeddings(statements);
    
    if (!embeddings || embeddings.length !== statements.length) {
      throw new Error("Failed to generate embeddings for JTBDs");
    }
    
    // Create similarity matrix
    const similarityMatrix = calculateSimilarityMatrix(embeddings);
    
    // Apply clustering algorithm
    const clusters = clusterBySimilarity(similarityMatrix, jtbds, threshold);
    
    if (verbose) {
      console.log(`Created ${clusters.length} clusters`);
      clusters.forEach((cluster, index) => {
        console.log(`Cluster ${index + 1}: ${cluster.length} JTBDs`);
      });
    }
    
    return clusters;
  } catch (error) {
    console.error(`Error clustering JTBDs: ${error.message}`);
    // If clustering fails, put each JTBD in its own cluster
    return jtbds.map(jtbd => [jtbd]);
  }
}

/**
 * Calculate cosine similarity matrix between embeddings
 * @param {Array} embeddings - Array of embedding vectors
 * @returns {Array} Similarity matrix as 2D array
 */
function calculateSimilarityMatrix(embeddings) {
  const n = embeddings.length;
  const similarityMatrix = Array(n).fill().map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const similarity = cosineSimilarity(embeddings[i], embeddings[j]);
      similarityMatrix[i][j] = similarity;
      similarityMatrix[j][i] = similarity;
    }
  }
  
  return similarityMatrix;
}

/**
 * Calculate cosine similarity between two vectors
 * @param {Array} vec1 - First vector
 * @param {Array} vec2 - Second vector
 * @returns {number} Cosine similarity (0-1)
 */
function cosineSimilarity(vec1, vec2) {
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
  
  if (mag1 === 0 || mag2 === 0) return 0;
  
  return dotProduct / (mag1 * mag2);
}

/**
 * Cluster items by similarity using a hierarchical approach
 * @param {Array} similarityMatrix - 2D array of similarity scores
 * @param {Array} items - Array of items to cluster
 * @param {number} threshold - Similarity threshold (0-1)
 * @returns {Array} Array of clusters, each containing original items
 */
function clusterBySimilarity(similarityMatrix, items, threshold) {
  const n = items.length;
  
  // Initialize each item as its own cluster
  const clusters = items.map((item, index) => ({
    itemIndices: [index],
    items: [item]
  }));
  
  // Track which clusters are still active (not merged)
  const activeClusters = new Set(clusters.map((_, index) => index));
  
  let changed = true;
  
  // Continue merging until no more merges are possible
  while (changed && activeClusters.size > 1) {
    changed = false;
    
    // Convert active clusters to array for easier iteration
    const activeIndices = Array.from(activeClusters);
    
    // Find the most similar pair of clusters
    let maxSimilarity = -1;
    let mergeI = -1;
    let mergeJ = -1;
    
    for (let i = 0; i < activeIndices.length; i++) {
      const clusterIIndex = activeIndices[i];
      const clusterI = clusters[clusterIIndex];
      
      for (let j = i + 1; j < activeIndices.length; j++) {
        const clusterJIndex = activeIndices[j];
        const clusterJ = clusters[clusterJIndex];
        
        // Calculate average similarity between all pairs of items in the two clusters
        let sumSimilarity = 0;
        let pairCount = 0;
        
        for (const itemI of clusterI.itemIndices) {
          for (const itemJ of clusterJ.itemIndices) {
            sumSimilarity += similarityMatrix[itemI][itemJ];
            pairCount++;
          }
        }
        
        const avgSimilarity = sumSimilarity / pairCount;
        
        if (avgSimilarity > threshold && avgSimilarity > maxSimilarity) {
          maxSimilarity = avgSimilarity;
          mergeI = clusterIIndex;
          mergeJ = clusterJIndex;
        }
      }
    }
    
    // If we found clusters to merge
    if (mergeI !== -1 && mergeJ !== -1) {
      // Merge the two clusters
      clusters[mergeI].itemIndices.push(...clusters[mergeJ].itemIndices);
      clusters[mergeI].items.push(...clusters[mergeJ].items);
      
      // Mark the second cluster as inactive
      activeClusters.delete(mergeJ);
      
      changed = true;
    }
  }
  
  // Extract final clusters (just the items, not the indices)
  return Array.from(activeClusters).map(index => clusters[index].items);
}

module.exports = {
  clusterScenarios,
  clusterJTBDs,
  calculateSimilarityMatrix,
  cosineSimilarity
};