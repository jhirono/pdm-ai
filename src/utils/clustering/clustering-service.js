// src/utils/clustering/clustering-service.js
const adaptiveClustering = require('./adaptive-clustering');
const embeddingService = require('../embedding/embedding-service');
const logger = require('../logger');

/**
 * Generate hierarchical clusters from a list of items
 * @param {Array} items - Items to cluster
 * @param {Object} options - Options for clustering
 * @returns {Promise<Object>} Hierarchical clusters
 */
async function generateHierarchicalClusters(items, options = {}) {
  try {
    const layerCount = options.layerCount || 2;
    const verbose = options.verbose || false;
    
    if (verbose) {
      logger.info(`Clustering ${items.length} scenarios...`);
    }
    
    // Generate embeddings for items
    const texts = items.map(item => item.statement);
    const embeddings = await embeddingService.getEmbeddings(texts);
    
    // Calculate similarity matrix
    const similarityMatrix = calculateSimilarityMatrix(embeddings);
    
    // First layer clustering
    logger.debug(`Calculating optimal threshold for ${items.length} scenarios at layer 1`);
    const firstLayerResult = await adaptiveClustering.findOptimalThreshold(
      similarityMatrix,
      items,
      (matrix, items, threshold) => clusterItems(matrix, items, threshold),
      { targetLayer: 1, verbose }
    );
    
    const firstLayerClusters = firstLayerResult.clusters;
    
    // Map items to first layer cluster IDs
    const itemToFirstLayerCluster = {};
    firstLayerClusters.forEach((cluster, index) => {
      const clusterId = `cluster1-${index + 1}`;
      cluster.forEach(item => {
        itemToFirstLayerCluster[item.id] = clusterId;
      });
    });
    
    // Create a structure for all layers
    const result = {
      layerCount,
      items,
      layers: [
        {
          layerId: 1,
          clusters: firstLayerClusters.map((cluster, index) => ({
            id: `cluster1-${index + 1}`,
            items: cluster,
            parentId: null // Will be filled later
          }))
        }
      ]
    };
    
    // Initialize firstLayerToSecondLayerCluster here to ensure it exists for all code paths
    const firstLayerToSecondLayerCluster = {};
    
    // Generate second layer clustering if requested
    if (layerCount >= 2) {
      // Create embeddings for first layer clusters by averaging their items
      const clusterEmbeddings = firstLayerClusters.map(cluster => {
        const clusterItemIndices = cluster.map(item => items.findIndex(i => i.id === item.id));
        return averageEmbeddings(embeddings, clusterItemIndices);
      });
      
      // Calculate similarity matrix for first layer clusters
      const clusterSimilarityMatrix = calculateSimilarityMatrix(clusterEmbeddings);
      
      // Second layer clustering
      logger.debug(`Calculating optimal threshold for ${firstLayerClusters.length} clusters at layer 2`);
      const secondLayerResult = await adaptiveClustering.findOptimalThreshold(
        clusterSimilarityMatrix,
        firstLayerClusters,
        (matrix, clusters, threshold) => clusterItems(matrix, clusters, threshold),
        { targetLayer: 2, verbose }
      );
      
      const secondLayerClusters = secondLayerResult.clusters;
      
      // Map first layer cluster IDs to second layer cluster IDs
      secondLayerClusters.forEach((clusterGroup, index) => {
        const secondLayerClusterId = `cluster2-${index + 1}`;
        
        // Each clusterGroup is an array of first-layer clusters
        clusterGroup.forEach((firstLayerCluster, firstLayerIndex) => {
          const firstLayerClusterId = `cluster1-${firstLayerClusters.indexOf(firstLayerCluster) + 1}`;
          firstLayerToSecondLayerCluster[firstLayerClusterId] = secondLayerClusterId;
        });
      });
      
      // Update parent IDs in first layer
      result.layers[0].clusters.forEach(cluster => {
        cluster.parentId = firstLayerToSecondLayerCluster[cluster.id] || null;
      });
      
      // Add second layer to result
      result.layers.push({
        layerId: 2,
        clusters: secondLayerClusters.map((clusterGroup, index) => {
          const secondLayerClusterId = `cluster2-${index + 1}`;
          
          // Find all first layer cluster IDs that belong to this second layer cluster
          const childIds = Object.entries(firstLayerToSecondLayerCluster)
            .filter(([_, parentId]) => parentId === secondLayerClusterId)
            .map(([childId, _]) => childId);
          
          // Get all items from the child clusters
          const clusterItems = [];
          childIds.forEach(childId => {
            const childCluster = result.layers[0].clusters.find(c => c.id === childId);
            if (childCluster) {
              clusterItems.push(...childCluster.items);
            }
          });
          
          return {
            id: secondLayerClusterId,
            childIds,
            items: clusterItems,
            parentId: null // Could be extended to more layers if needed
          };
        })
      });
    }
    
    // Add item to cluster mapping for convenience
    result.itemToClusterMap = {};
    
    // Map each item to its clusters at each layer
    items.forEach(item => {
      result.itemToClusterMap[item.id] = {
        layer1: itemToFirstLayerCluster[item.id] || null,
        layer2: itemToFirstLayerCluster[item.id] ? 
          firstLayerToSecondLayerCluster[itemToFirstLayerCluster[item.id]] || null : null
      };
    });
    
    return result;
  } catch (error) {
    logger.error(`Error generating hierarchical clusters: ${error.message}`);
    throw error;
  }
}

/**
 * Cluster items based on similarity matrix and threshold
 * @param {Array<Array<number>>} similarityMatrix - Similarity matrix
 * @param {Array} items - Items to cluster
 * @param {number} threshold - Similarity threshold for clustering
 * @returns {Array<Array>} Array of clusters (each cluster is an array of items)
 */
function clusterItems(similarityMatrix, items, threshold) {
  // Initialize each item as its own cluster
  const clusters = items.map(item => [item]);
  const clusterIndices = items.map((_, i) => i);
  
  // Keep track of which items are already merged
  const merged = new Set();
  
  // Merge clusters until no more merges are possible
  let mergeHappened = true;
  while (mergeHappened) {
    mergeHappened = false;
    
    // Find the most similar pair of clusters
    let bestPair = null;
    let bestSimilarity = 0;
    
    for (let i = 0; i < clusterIndices.length; i++) {
      // Skip if this cluster is already merged
      if (merged.has(i)) continue;
      
      for (let j = i + 1; j < clusterIndices.length; j++) {
        // Skip if this cluster is already merged
        if (merged.has(j)) continue;
        
        // Calculate average similarity between clusters
        let totalSim = 0;
        let count = 0;
        
        for (const itemI of clusters[i]) {
          const indexI = items.findIndex(item => item.id === itemI.id);
          
          for (const itemJ of clusters[j]) {
            const indexJ = items.findIndex(item => item.id === itemJ.id);
            
            if (indexI !== -1 && indexJ !== -1) {
              totalSim += similarityMatrix[indexI][indexJ];
              count++;
            }
          }
        }
        
        const avgSim = count > 0 ? totalSim / count : 0;
        
        // If similarity is above threshold and better than current best
        if (avgSim >= threshold && avgSim > bestSimilarity) {
          bestPair = [i, j];
          bestSimilarity = avgSim;
        }
      }
    }
    
    // Merge the best pair if found
    if (bestPair) {
      const [i, j] = bestPair;
      clusters[i] = [...clusters[i], ...clusters[j]];
      merged.add(j);
      mergeHappened = true;
    }
  }
  
  // Filter out merged clusters
  return clusters.filter((_, i) => !merged.has(i));
}

/**
 * Calculate cosine similarity matrix between embeddings
 * @param {Array<Array<number>>} embeddings - Array of embedding vectors
 * @returns {Array<Array<number>>} Similarity matrix
 */
function calculateSimilarityMatrix(embeddings) {
  const count = embeddings.length;
  const matrix = Array(count).fill().map(() => Array(count).fill(0));
  
  for (let i = 0; i < count; i++) {
    matrix[i][i] = 1; // Self-similarity is always 1
    
    for (let j = i + 1; j < count; j++) {
      const similarity = cosineSimilarity(embeddings[i], embeddings[j]);
      matrix[i][j] = similarity;
      matrix[j][i] = similarity; // Matrix is symmetric
    }
  }
  
  return matrix;
}

/**
 * Calculate cosine similarity between two vectors
 * @param {Array<number>} a - First vector
 * @param {Array<number>} b - Second vector
 * @returns {number} Cosine similarity (0-1)
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Average multiple embeddings
 * @param {Array<Array<number>>} embeddings - Array of all embedding vectors
 * @param {Array<number>} indices - Indices of embeddings to average
 * @returns {Array<number>} Averaged embedding
 */
function averageEmbeddings(embeddings, indices) {
  if (!indices.length) return null;
  
  const validEmbeddings = indices
    .map(i => embeddings[i])
    .filter(Boolean);
  
  if (!validEmbeddings.length) return null;
  
  const result = Array(validEmbeddings[0].length).fill(0);
  
  for (const embedding of validEmbeddings) {
    for (let i = 0; i < embedding.length; i++) {
      result[i] += embedding[i];
    }
  }
  
  for (let i = 0; i < result.length; i++) {
    result[i] /= validEmbeddings.length;
  }
  
  return result;
}

module.exports = {
  generateHierarchicalClusters,
  clusterItems,
  calculateSimilarityMatrix,
  cosineSimilarity
};