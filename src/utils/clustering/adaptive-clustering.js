// src/utils/clustering/adaptive-clustering.js
const logger = require('../logger');

/**
 * Find the optimal threshold for clustering using binary search
 * @param {Array<Array<number>>} similarityMatrix - Similarity matrix
 * @param {Array} items - Items to cluster
 * @param {Function} clusterFunction - Function to cluster items with a given threshold
 * @param {Object} options - Options for threshold finding
 * @returns {Promise<Object>} Result containing optimal threshold and clusters
 */
async function findOptimalThreshold(similarityMatrix, items, clusterFunction, options = {}) {
  const targetLayer = options.targetLayer || 1;
  const verbose = options.verbose || false;
  
  // If user specified a threshold, use that instead of adaptive calculation
  if (options.threshold) {
    logger.info(`Using user-specified threshold for layer ${targetLayer}: ${options.threshold}`);
    const clusters = clusterFunction(similarityMatrix, items, options.threshold);
    return {
      threshold: options.threshold,
      clusterCount: clusters.length,
      clusters
    };
  }
  
  // Get target cluster counts based on layer
  let targetMinClusters, targetMaxClusters;
  if (targetLayer === 1) {
    // For first layer, aim for a reasonable number of clusters based on item count
    targetMinClusters = Math.max(3, Math.floor(items.length / 10));
    targetMaxClusters = Math.min(items.length / 2, Math.ceil(items.length / 5));
  } else {
    // For second layer, aim for fewer, more abstract clusters
    targetMinClusters = Math.max(2, Math.floor(items.length / 20));
    targetMaxClusters = Math.min(items.length / 2, Math.ceil(items.length / 8));
  }
  
  if (verbose) {
    logger.debug(`Adaptive clustering target for layer ${targetLayer}: ${targetMinClusters}-${targetMaxClusters} clusters`);
  }
  
  // Start with binary search boundaries
  let min = 0.1; // Minimum threshold
  let max = 0.9; // Maximum threshold
  let bestThreshold = 0.5; // Start with middle value
  let bestClusters = clusterFunction(similarityMatrix, items, bestThreshold);
  let iterations = 0;
  const maxIterations = 10;
  
  // Binary search for optimal threshold
  while (iterations < maxIterations) {
    const currentCount = bestClusters.length;
    
    if (verbose && iterations % 2 === 0) {
      logger.debug(`Iteration ${iterations}: threshold=${bestThreshold.toFixed(2)}, clusters=${currentCount}`);
    }
    
    // If we're in the target range, we're done
    if (currentCount >= targetMinClusters && currentCount <= targetMaxClusters) {
      break;
    }
    
    // Adjust threshold to try to get closer to target
    if (currentCount < targetMinClusters) {
      // Too few clusters, decrease threshold
      max = bestThreshold;
      bestThreshold = (min + bestThreshold) / 2;
    } else {
      // Too many clusters, increase threshold
      min = bestThreshold;
      bestThreshold = (bestThreshold + max) / 2;
    }
    
    // Try new threshold
    bestClusters = clusterFunction(similarityMatrix, items, bestThreshold);
    iterations++;
  }
  
  // If still outside target range, try a different approach
  if (bestClusters.length < targetMinClusters || bestClusters.length > targetMaxClusters) {
    logger.debug(`Binary search did not find optimal threshold; trying threshold sweep`);
    
    // Try a series of thresholds and pick the one that gets closest to our target
    const thresholds = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
    let bestDistance = Infinity;
    
    for (const threshold of thresholds) {
      const clusters = clusterFunction(similarityMatrix, items, threshold);
      const middleTarget = (targetMinClusters + targetMaxClusters) / 2;
      const distance = Math.abs(clusters.length - middleTarget);
      
      if (distance < bestDistance) {
        bestDistance = distance;
        bestThreshold = threshold;
        bestClusters = clusters;
      }
      
      if (verbose) {
        logger.debug(`Swept threshold ${threshold}: ${clusters.length} clusters (distance: ${distance.toFixed(2)})`);
      }
    }
  }
  
  logger.info(`Selected optimal threshold ${bestThreshold.toFixed(2)} for layer ${targetLayer} with ${bestClusters.length} clusters`);
  
  return {
    threshold: bestThreshold,
    clusterCount: bestClusters.length,
    clusters: bestClusters
  };
}

module.exports = {
  findOptimalThreshold
};