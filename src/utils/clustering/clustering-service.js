// src/utils/clustering/clustering-service.js
import * as adaptiveClustering from './adaptive-clustering.js';
import * as embeddingService from '../embedding/embedding-service.js';
import logger from '../logger.js';

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
    
    // Check if we have existing clusters to preserve (for incremental processing)
    const existingClusters = options.existingClusters || null;
    const preserveExisting = existingClusters !== null;
    
    if (preserveExisting && verbose) {
      logger.debug('Using existing clusters for incremental processing');
    }
    
    // Generate embeddings for items
    const texts = items.map(item => item.statement);
    const embeddings = await embeddingService.getEmbeddings(texts);
    
    // Calculate similarity matrix
    const similarityMatrix = calculateSimilarityMatrix(embeddings);
    
    // First layer clustering - adapt based on whether we're preserving existing clusters
    let firstLayerClusters;
    let firstLayerResult;
    
    if (preserveExisting && Object.keys(existingClusters.layer1).length > 0) {
      // Use existing clusters and assign new items to the closest cluster
      if (verbose) {
        logger.debug(`Preserving ${Object.keys(existingClusters.layer1).length} existing first-layer clusters`);
      }
      
      // We're going to build a result that mimics what would come from adaptive clustering
      firstLayerResult = await preserveAndExtendClusters(
        items, 
        embeddings, 
        existingClusters.layer1,
        options.layer1Threshold
      );
      
      firstLayerClusters = firstLayerResult.clusters;
    } else {
      // Generate new clusters from scratch
      logger.debug(`Calculating optimal threshold for ${items.length} scenarios at layer 1`);
      firstLayerResult = await adaptiveClustering.findOptimalThreshold(
        similarityMatrix,
        items,
        (matrix, items, threshold) => clusterItems(matrix, items, threshold),
        { targetLayer: 1, verbose }
      );
      
      firstLayerClusters = firstLayerResult.clusters;
    }
    
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
      
      // Second layer clustering - handle existing clusters if preserving
      let secondLayerClusters;
      
      if (preserveExisting && Object.keys(existingClusters.layer2).length > 0) {
        // Use existing second-layer clusters
        if (verbose) {
          logger.debug(`Preserving ${Object.keys(existingClusters.layer2).length} existing second-layer clusters`);
        }
        
        // Preserve and extend second layer clusters
        const secondLayerResult = await preserveAndExtendLayerTwoClusters(
          firstLayerClusters,
          clusterEmbeddings,
          existingClusters.layer2,
          options.layer2Threshold
        );
        
        secondLayerClusters = secondLayerResult.clusters;
      } else {
        // Generate new second layer clusters
        logger.debug(`Calculating optimal threshold for ${firstLayerClusters.length} clusters at layer 2`);
        const secondLayerResult = await adaptiveClustering.findOptimalThreshold(
          clusterSimilarityMatrix,
          firstLayerClusters,
          (matrix, clusters, threshold) => clusterItems(matrix, clusters, threshold),
          { targetLayer: 2, verbose }
        );
        
        secondLayerClusters = secondLayerResult.clusters;
      }
      
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
 * Preserve existing clusters and extend them with new items
 * @param {Array} items - New items to cluster
 * @param {Array} embeddings - Embeddings for new items
 * @param {Object} existingClusters - Mapping of existing cluster IDs to their info
 * @param {number} threshold - Similarity threshold for new items
 * @returns {Promise<Object>} Result mimicking adaptive clustering output
 */
async function preserveAndExtendClusters(items, embeddings, existingClusters, threshold) {
  // Create placeholder clusters for existing cluster IDs
  const existingClusterIds = Object.keys(existingClusters);
  const placeholderClusters = existingClusterIds.map(id => []);
  
  // Create cluster embeddings using random sample items (we'll update these)
  let clusterEmbeddings = placeholderClusters.map(() => null);
  
  // Function to find the most similar cluster for an item
  const findBestCluster = async (item, itemEmbedding) => {
    let bestCluster = 0;
    let bestSimilarity = -1;
    
    // For each cluster, calculate similarity with the item
    for (let i = 0; i < placeholderClusters.length; i++) {
      // Skip clusters with no embedding yet
      if (!clusterEmbeddings[i]) continue;
      
      // Calculate similarity
      const similarity = cosineSimilarity(itemEmbedding, clusterEmbeddings[i]);
      
      // If this is the best match so far, record it
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestCluster = i;
      }
    }
    
    // If best similarity is above threshold, assign to that cluster
    // Otherwise create a new cluster
    if (bestSimilarity >= (threshold || 0.5)) {
      return bestCluster;
    } else {
      return -1; // Indicates we need a new cluster
    }
  };
  
  // First pass: For each existing cluster, try to find items in the input that match
  // the scenarios we know should be in this cluster
  for (let clusterIdx = 0; clusterIdx < existingClusterIds.length; clusterIdx++) {
    const clusterId = existingClusterIds[clusterIdx];
    const clusterInfo = existingClusters[clusterId];
    
    // Find items that match existing scenario IDs
    for (const item of items) {
      if (clusterInfo.scenarioIds && clusterInfo.scenarioIds.includes(item.id)) {
        // If this item belongs to the current cluster, add it
        placeholderClusters[clusterIdx].push(item);
      }
    }
    
    // If we found items for this cluster, calculate the cluster embedding
    if (placeholderClusters[clusterIdx].length > 0) {
      const clusterItemIndices = placeholderClusters[clusterIdx]
        .map(item => items.findIndex(i => i.id === item.id))
        .filter(idx => idx !== -1);
      
      clusterEmbeddings[clusterIdx] = averageEmbeddings(embeddings, clusterItemIndices);
    }
  }
  
  // Second pass: Assign new items (those without existing cluster assignments) to the best matching cluster
  // or create new clusters if no good match
  const unassignedItems = items.filter(item => 
    !existingClusterIds.some(clusterId => 
      existingClusters[clusterId].scenarioIds && 
      existingClusters[clusterId].scenarioIds.includes(item.id)
    )
  );
  
  // New clusters we'll create
  const newClusters = [];
  
  // Process each unassigned item
  for (const item of unassignedItems) {
    const itemIndex = items.findIndex(i => i.id === item.id);
    if (itemIndex === -1) continue;
    
    const itemEmbedding = embeddings[itemIndex];
    if (!itemEmbedding) continue;
    
    // Find the best cluster for this item
    const bestCluster = await findBestCluster(item, itemEmbedding);
    
    if (bestCluster === -1) {
      // Create a new cluster for this item
      newClusters.push([item]);
    } else {
      // Assign to existing cluster
      placeholderClusters[bestCluster].push(item);
      
      // Update the cluster embedding
      const clusterItemIndices = placeholderClusters[bestCluster]
        .map(clusterItem => items.findIndex(i => i.id === clusterItem.id))
        .filter(idx => idx !== -1);
      
      clusterEmbeddings[bestCluster] = averageEmbeddings(embeddings, clusterItemIndices);
    }
  }
  
  // Combine existing (now filled) and new clusters, removing any empty clusters
  const finalClusters = [...placeholderClusters.filter(cluster => cluster.length > 0), ...newClusters];
  
  // Return a result that mimics adaptive clustering output
  return {
    threshold: threshold || 0.5,
    clusters: finalClusters
  };
}

/**
 * Preserve existing second-layer clusters and extend them with new first-layer clusters
 * @param {Array} firstLayerClusters - All first layer clusters
 * @param {Array} clusterEmbeddings - Embeddings for first layer clusters
 * @param {Object} existingLayer2Clusters - Existing second layer cluster mappings
 * @param {number} threshold - Similarity threshold
 * @returns {Promise<Object>} Result mimicking adaptive clustering output
 */
async function preserveAndExtendLayerTwoClusters(firstLayerClusters, clusterEmbeddings, existingLayer2Clusters, threshold) {
  // Create mapping of first layer clusters to their indexes
  const firstLayerClusterIndices = {};
  firstLayerClusters.forEach((cluster, index) => {
    // Use a cluster key that can be matched against existing relationships
    const scenarioIds = cluster.map(item => item.id).sort().join(',');
    firstLayerClusterIndices[scenarioIds] = index;
  });
  
  // Create placeholder clusters for existing layer 2 cluster IDs
  const existingClusterIds = Object.keys(existingLayer2Clusters);
  const secondLayerClusters = existingClusterIds.map(() => []);
  
  // For each existing layer 2 cluster, try to find matching first layer clusters
  for (let clusterIdx = 0; clusterIdx < existingClusterIds.length; clusterIdx++) {
    const clusterId = existingClusterIds[clusterIdx];
    const clusterInfo = existingLayer2Clusters[clusterId];
    
    // For each child cluster ID in this second layer cluster
    if (clusterInfo.childClusterIds) {
      for (let i = 0; i < firstLayerClusters.length; i++) {
        const firstLayerCluster = firstLayerClusters[i];
        // See if this first layer cluster matches any of the child clusters
        const scenarioIds = firstLayerCluster.map(item => item.id).sort().join(',');
        
        // If this first layer cluster belongs to an existing second layer cluster, add it
        if (clusterInfo.childClusterIds.some(childId => {
          // Get all scenario IDs belonging to this child cluster ID
          const childScenarios = existingLayer2Clusters[clusterId]?.childClusterScenarioIds?.[childId];
          return childScenarios && scenaroIdsOverlap(
            childScenarios,
            firstLayerCluster.map(item => item.id)
          );
        })) {
          secondLayerClusters[clusterIdx].push(firstLayerCluster);
        }
      }
    }
  }
  
  // For first layer clusters not assigned to any second layer cluster,
  // assign them to the most similar second layer cluster or create new ones
  const unassignedIndices = [];
  for (let i = 0; i < firstLayerClusters.length; i++) {
    const isAssigned = secondLayerClusters.some(cluster => 
      cluster.some(c => c === firstLayerClusters[i])
    );
    
    if (!isAssigned) {
      unassignedIndices.push(i);
    }
  }
  
  // Calculate embeddings for existing second layer clusters
  const secondLayerEmbeddings = secondLayerClusters.map(cluster => {
    if (cluster.length === 0) return null;
    
    const indices = [];
    cluster.forEach(firstLayerCluster => {
      const index = firstLayerClusters.indexOf(firstLayerCluster);
      if (index !== -1) indices.push(index);
    });
    
    return averageEmbeddings(clusterEmbeddings, indices);
  });
  
  // New second layer clusters we'll create
  const newSecondLayerClusters = [];
  
  // Assign unassigned first layer clusters
  for (const unassignedIdx of unassignedIndices) {
    // Find the most similar second layer cluster
    let bestClusterIdx = -1;
    let bestSimilarity = 0;
    
    for (let i = 0; i < secondLayerClusters.length; i++) {
      // Skip if no embedding (empty cluster)
      if (!secondLayerEmbeddings[i]) continue;
      
      const similarity = cosineSimilarity(clusterEmbeddings[unassignedIdx], secondLayerEmbeddings[i]);
      
      if (similarity > threshold && similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestClusterIdx = i;
      }
    }
    
    if (bestClusterIdx !== -1) {
      // Assign to existing second layer cluster
      secondLayerClusters[bestClusterIdx].push(firstLayerClusters[unassignedIdx]);
      
      // Update embedding
      const indices = [];
      secondLayerClusters[bestClusterIdx].forEach(firstLayerCluster => {
        const index = firstLayerClusters.indexOf(firstLayerCluster);
        if (index !== -1) indices.push(index);
      });
      
      secondLayerEmbeddings[bestClusterIdx] = averageEmbeddings(clusterEmbeddings, indices);
    } else {
      // Create new second layer cluster
      newSecondLayerClusters.push([firstLayerClusters[unassignedIdx]]);
    }
  }
  
  // Combine existing (now filled) and new second layer clusters
  const finalClusters = [
    ...secondLayerClusters.filter(cluster => cluster.length > 0),
    ...newSecondLayerClusters
  ];
  
  // Return a result that mimics adaptive clustering output
  return {
    threshold: threshold || 0.5,
    clusters: finalClusters
  };
}

/**
 * Check if two sets of scenario IDs have significant overlap
 * @param {Array} setA - First set of scenario IDs
 * @param {Array} setB - Second set of scenario IDs
 * @returns {boolean} True if significant overlap exists
 */
function scenaroIdsOverlap(setA, setB) {
  // If either set is empty, no overlap
  if (!setA || !setB || setA.length === 0 || setB.length === 0) {
    return false;
  }
  
  // Count overlap
  const overlap = setA.filter(id => setB.includes(id)).length;
  
  // Check if overlap is significant (at least 50% of the smaller set)
  const smallerSetSize = Math.min(setA.length, setB.length);
  return overlap >= smallerSetSize * 0.5;
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
  const n = embeddings.length;
  const matrix = Array(n).fill().map(() => Array(n).fill(0));
  
  // Calculate similarity for each pair of embeddings
  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1; // Self-similarity is 1
    
    for (let j = i + 1; j < n; j++) {
      const similarity = cosineSimilarity(embeddings[i], embeddings[j]);
      matrix[i][j] = similarity;
      matrix[j][i] = similarity; // Similarity matrix is symmetric
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
  if (!a || !b) return 0;
  
  let dotProduct = 0;
  let magA = 0;
  let magB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  
  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);
  
  if (magA === 0 || magB === 0) return 0;
  
  return dotProduct / (magA * magB);
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

export {
  generateHierarchicalClusters,
  clusterItems,
  calculateSimilarityMatrix,
  cosineSimilarity
};