// src/utils/jtbd/jtbd-generator.js
import { v4 as uuidv4 } from 'uuid';
import logger from '../logger.js';
import config from '../config.js';
import * as clusteringService from '../clustering/clustering-service.js';

/**
 * Generate JTBDs from scenarios with adaptive clustering
 * @param {Array} scenarios - Array of scenario objects
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Generated JTBDs with metadata
 */
async function generateJTBDs(scenarios, options = {}) {
  try {
    logger.info(`Generating JTBDs from ${scenarios.length} scenarios...`);
    
    // Check if we have scenarios
    if (!scenarios || scenarios.length === 0) {
      throw new Error('No scenarios provided');
    }
    
    // Get generation options
    const layerCount = options.layers || 1;
    const verbose = options.verbose || false;
    const incremental = options.incremental || false;
    const preserveExistingClusters = options.preserveExistingClusters || false;
    
    logger.info(`Generating ${layerCount} layer(s) of JTBDs${incremental ? ' in incremental mode' : ''}`);
    
    // For incremental mode, we need to load previous JTBDs
    let previousJTBDs = [];
    let previousScenarioIds = new Set();
    
    if (incremental && options.previousResults) {
      if (verbose) {
        logger.debug('Loading previous results for incremental processing');
      }
      
      // Extract previous JTBDs
      previousJTBDs = options.previousResults.jtbds || [];
      
      // Track scenario IDs that have been already processed
      previousScenarioIds = new Set(
        previousJTBDs
          .flatMap(jtbd => jtbd.scenarioIds || [])
      );
      
      if (verbose) {
        logger.debug(`Found ${previousJTBDs.length} previous JTBDs covering ${previousScenarioIds.size} scenarios`);
      }
    }
    
    // Filter out scenarios that have already been processed in incremental mode with preserved clusters
    let scenariosToProcess = scenarios;
    if (incremental && preserveExistingClusters) {
      scenariosToProcess = scenarios.filter(scenario => !previousScenarioIds.has(scenario.id));
      
      if (verbose) {
        logger.debug(`Processing ${scenariosToProcess.length} new scenarios (${scenarios.length - scenariosToProcess.length} already processed)`);
      }
    }
    
    // Step 1: Generate hierarchical clusters from scenarios
    const clusterResult = await clusteringService.generateHierarchicalClusters(
      incremental && preserveExistingClusters ? scenariosToProcess : scenarios, 
      {
        layerCount,
        verbose,
        layer1Threshold: options.layer1Threshold,
        layer2Threshold: options.layer2Threshold,
        // If incremental and preserving clusters, pass existing cluster information
        existingClusters: incremental && preserveExistingClusters ? extractClusterInfo(previousJTBDs) : null
      }
    );
    
    // Step 2: Get the LLM provider for JTBD generation
    const llmProvider = getLLMProvider();
    
    // Step 3: Generate first-layer JTBDs
    const firstLayerJTBDs = [];
    const clusterToJTBDMap = {};
    
    // Get first layer clusters from the result
    const firstLayerClusters = clusterResult.layers[0].clusters;
    
    // Process each cluster to generate a JTBD
    for (let i = 0; i < firstLayerClusters.length; i++) {
      const clusterObj = firstLayerClusters[i];
      const clusterId = clusterObj.id;
      const cluster = clusterObj.items;
      
      // Generate JTBD for this cluster
      const jtbd = await generateJTBDFromCluster(cluster, llmProvider);
      
      // Add layer information and cluster ID reference
      jtbd.level = 1;
      jtbd.clusterId = clusterId;
      jtbd.parentId = clusterObj.parentId;  // Updated to use the parentId from cluster object
      jtbd.childIds = [];    // No children for first-layer JTBDs
      
      // Store the JTBD
      firstLayerJTBDs.push(jtbd);
      
      // Map the cluster ID to the JTBD for hierarchical linking
      clusterToJTBDMap[clusterId] = jtbd.id;
    }
    
    // If only one layer requested, return the results
    if (layerCount === 1) {
      // In incremental mode, merge with previous JTBDs if not preserving clusters
      if (incremental && !preserveExistingClusters) {
        return {
          jtbds: mergeJTBDs(previousJTBDs, firstLayerJTBDs),
          hierarchyInfo: null
        };
      } else if (incremental && preserveExistingClusters) {
        return {
          jtbds: [...previousJTBDs, ...firstLayerJTBDs],
          hierarchyInfo: null
        };
      } else {
        return {
          jtbds: firstLayerJTBDs,
          hierarchyInfo: null
        };
      }
    }
    
    // Step 4: Generate second-layer JTBDs (abstracted from first-layer JTBDs)
    const secondLayerJTBDs = [];
    
    // Check if we have a second layer in the cluster result
    if (clusterResult.layers.length >= 2) {
      const secondLayerClusters = clusterResult.layers[1].clusters;
      
      // Process each second-layer cluster to generate a higher-level JTBD
      for (let i = 0; i < secondLayerClusters.length; i++) {
        const superClusterObj = secondLayerClusters[i];
        const superClusterId = superClusterObj.id;
        const childIds = superClusterObj.childIds || [];
        
        // Collect the first-layer JTBDs that belong to this super-cluster
        const relatedFirstLayerJTBDs = [];
        
        // Find the corresponding JTBDs for those clusters
        for (const childId of childIds) {
          const jtbdId = clusterToJTBDMap[childId];
          const jtbd = firstLayerJTBDs.find(j => j.id === jtbdId);
          if (jtbd) {
            relatedFirstLayerJTBDs.push(jtbd);
          }
        }
        
        // Only generate a second-layer JTBD if we have child JTBDs
        if (relatedFirstLayerJTBDs.length > 0) {
          // Generate a second-layer JTBD from the first-layer JTBDs
          const abstractJTBD = await generateAbstractJTBD(relatedFirstLayerJTBDs, llmProvider);
          
          // Add layer information and hierarchy reference
          abstractJTBD.level = 2;
          abstractJTBD.clusterId = superClusterId;
          abstractJTBD.childIds = relatedFirstLayerJTBDs.map(j => j.id);
          
          // Store the second-layer JTBD
          secondLayerJTBDs.push(abstractJTBD);
        } else if (superClusterObj.items.length > 0) {
          // If we don't have related first-layer JTBDs but do have items, 
          // generate JTBD directly from items
          const abstractJTBD = await generateJTBDFromCluster(superClusterObj.items, llmProvider);
          
          // Add layer information
          abstractJTBD.level = 2;
          abstractJTBD.clusterId = superClusterId;
          abstractJTBD.childIds = [];
          
          // Store the second-layer JTBD
          secondLayerJTBDs.push(abstractJTBD);
        } else {
          logger.warn(`No child JTBDs or items found for super cluster ${superClusterId}`);
        }
      }
    }
    
    // Combine all JTBDs
    let allJTBDs = [...firstLayerJTBDs, ...secondLayerJTBDs];
    
    // In incremental mode, merge with previous JTBDs if not preserving clusters,
    // otherwise just add the new JTBDs to previous ones
    if (incremental) {
      if (preserveExistingClusters) {
        // Keep previous JTBDs and add new ones
        allJTBDs = [...previousJTBDs, ...allJTBDs];
      } else {
        // Merge previous and new JTBDs
        allJTBDs = mergeJTBDs(previousJTBDs, allJTBDs);
      }
    }
    
    // Return the results with hierarchy information
    return {
      jtbds: allJTBDs,
      hierarchyInfo: {
        layer1Count: firstLayerJTBDs.length,
        layer2Count: secondLayerJTBDs.length,
        previousJTBDsCount: incremental ? previousJTBDs.length : 0
      }
    };
  } catch (error) {
    logger.error(`Error generating JTBDs: ${error.message}`);
    throw error;
  }
}

/**
 * Extract cluster information from existing JTBDs for incremental clustering
 * @param {Array} jtbds - Previous JTBDs with cluster information
 * @returns {Object|null} Cluster information or null if none available
 */
function extractClusterInfo(jtbds) {
  if (!jtbds || jtbds.length === 0) {
    return null;
  }
  
  const clusterInfo = {
    layer1: {},
    layer2: {}
  };
  
  // Extract cluster information for each layer
  jtbds.forEach(jtbd => {
    if (jtbd.level === 1 && jtbd.clusterId && jtbd.scenarioIds) {
      clusterInfo.layer1[jtbd.clusterId] = {
        scenarioIds: jtbd.scenarioIds,
        jtbdId: jtbd.id
      };
    } else if (jtbd.level === 2 && jtbd.clusterId && jtbd.childIds) {
      clusterInfo.layer2[jtbd.clusterId] = {
        childClusterIds: jtbd.childIds.map(childId => {
          const childJTBD = jtbds.find(j => j.id === childId);
          return childJTBD ? childJTBD.clusterId : null;
        }).filter(Boolean),
        jtbdId: jtbd.id
      };
    }
  });
  
  return clusterInfo;
}

/**
 * Merge previous JTBDs with newly generated ones to avoid duplication
 * @param {Array} previousJTBDs - JTBDs from previous runs
 * @param {Array} newJTBDs - Newly generated JTBDs
 * @returns {Array} Merged array of JTBDs
 */
function mergeJTBDs(previousJTBDs, newJTBDs) {
  if (!previousJTBDs || previousJTBDs.length === 0) {
    return newJTBDs;
  }
  
  if (!newJTBDs || newJTBDs.length === 0) {
    return previousJTBDs;
  }
  
  // Use a map to track existing scenario IDs in previous JTBDs
  const scenarioToJTBDs = {};
  
  // Map existing scenarios to their JTBDs
  previousJTBDs.forEach(jtbd => {
    if (jtbd.scenarioIds && jtbd.scenarioIds.length > 0) {
      jtbd.scenarioIds.forEach(scenarioId => {
        if (!scenarioToJTBDs[scenarioId]) {
          scenarioToJTBDs[scenarioId] = [];
        }
        scenarioToJTBDs[scenarioId].push(jtbd.id);
      });
    }
  });
  
  // Find JTBDs that need to be preserved (those not fully covered by new JTBDs)
  const preserveJTBDs = previousJTBDs.filter(jtbd => {
    // If no scenario IDs, keep it
    if (!jtbd.scenarioIds || jtbd.scenarioIds.length === 0) {
      return true;
    }
    
    // Check if all scenarios in this JTBD are covered by new JTBDs
    const allCovered = jtbd.scenarioIds.every(scenarioId => {
      const newJTBDWithScenario = newJTBDs.some(newJtbd => 
        newJtbd.scenarioIds && newJtbd.scenarioIds.includes(scenarioId)
      );
      return newJTBDWithScenario;
    });
    
    // If not all scenarios are covered by new JTBDs, preserve this JTBD
    return !allCovered;
  });
  
  // Combine preserved JTBDs with new ones
  return [...preserveJTBDs, ...newJTBDs];
}

/**
 * Generate a JTBD from a cluster of scenarios
 * @param {Array} cluster - Cluster of scenario objects
 * @param {Object} llmProvider - LLM provider
 * @returns {Promise<Object>} Generated JTBD
 */
async function generateJTBDFromCluster(cluster, llmProvider) {
  try {
    // Generate a JTBD using the LLM provider
    const jtbd = await llmProvider.generateJTBD(cluster);
    
    // Ensure the JTBD has an ID
    if (!jtbd.id) {
      jtbd.id = `jtbd-${uuidv4()}`;
    }
    
    // Add scenario references
    jtbd.scenarioIds = cluster.map(scenario => scenario.id);
    
    // Add sources by aggregating from scenarios
    const sourcesSet = new Set();
    cluster.forEach(scenario => {
      if (scenario.sources && Array.isArray(scenario.sources)) {
        scenario.sources.forEach(source => sourcesSet.add(source));
      }
    });
    jtbd.sources = Array.from(sourcesSet);
    
    // Add customers by aggregating from scenarios
    const customersSet = new Set();
    cluster.forEach(scenario => {
      if (scenario.customer) {
        customersSet.add(scenario.customer);
      }
    });
    jtbd.customers = Array.from(customersSet);
    
    // Add version info
    jtbd.version = "1.0";
    jtbd.timestamp = new Date().toISOString();
    
    return jtbd;
  } catch (error) {
    logger.error(`Error generating JTBD from cluster: ${error.message}`);
    throw error;
  }
}

/**
 * Generate an abstract JTBD from related first-layer JTBDs
 * @param {Array} relatedJTBDs - Array of related first-layer JTBD objects
 * @param {Object} llmProvider - LLM provider
 * @returns {Promise<Object>} Generated abstract JTBD
 */
async function generateAbstractJTBD(relatedJTBDs, llmProvider) {
  try {
    // Check if we have relatedJTBDs
    if (!relatedJTBDs || relatedJTBDs.length === 0) {
      throw new Error('No related JTBDs provided');
    }
    
    // Generate an abstract JTBD using the LLM provider
    const abstractJTBD = await llmProvider.generateAbstractJTBD(relatedJTBDs);
    
    // Ensure the JTBD has an ID
    if (!abstractJTBD.id) {
      abstractJTBD.id = `abstractjtbd-${uuidv4()}`;
    }
    
    // Add JTBD references
    abstractJTBD.jtbdIds = relatedJTBDs.map(jtbd => jtbd.id);
    
    // Aggregate scenario IDs from first-layer JTBDs
    const scenarioIdsSet = new Set();
    relatedJTBDs.forEach(jtbd => {
      if (jtbd.scenarioIds && Array.isArray(jtbd.scenarioIds)) {
        jtbd.scenarioIds.forEach(id => scenarioIdsSet.add(id));
      }
    });
    abstractJTBD.scenarioIds = Array.from(scenarioIdsSet);
    
    // Aggregate sources from first-layer JTBDs
    const sourcesSet = new Set();
    relatedJTBDs.forEach(jtbd => {
      if (jtbd.sources && Array.isArray(jtbd.sources)) {
        jtbd.sources.forEach(source => sourcesSet.add(source));
      }
    });
    abstractJTBD.sources = Array.from(sourcesSet);
    
    // Aggregate customers from first-layer JTBDs
    const customersSet = new Set();
    relatedJTBDs.forEach(jtbd => {
      if (jtbd.customers && Array.isArray(jtbd.customers)) {
        jtbd.customers.forEach(customer => customersSet.add(customer));
      }
    });
    abstractJTBD.customers = Array.from(customersSet);
    
    // Add version info
    abstractJTBD.version = "1.0";
    abstractJTBD.timestamp = new Date().toISOString();
    
    return abstractJTBD;
  } catch (error) {
    logger.error(`Error generating abstract JTBD: ${error.message}`);
    throw error;
  }
}

/**
 * Get the appropriate LLM provider based on configuration
 * @returns {Object} LLM provider
 */
function getLLMProvider() {
  // Determine which model to use from config
  const model = config.model?.toLowerCase() || '';
  
  if (model.includes('claude')) {
    return import('./providers/claude-provider.js');
  } else if (model.includes('gemini') || model.includes('google')) {
    return import('./providers/gemini-provider.js');
  } else {
    // Default to OpenAI
    return import('./providers/openai-provider.js');
  }
}

export {
  generateJTBDs,
  generateJTBDFromCluster,
  generateAbstractJTBD
};