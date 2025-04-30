// src/utils/consolidation/consolidation-manager.js
const fs = require('fs-extra');
const path = require('path');
const embeddingsEngine = require('./embeddings-engine');
const jtbdClustering = require('./jtbd-clustering');
const abstractionGenerator = require('./abstraction-generator');
const config = require('../config');

/**
 * Manager class that orchestrates the JTBD consolidation process
 */
class ConsolidationManager {
  /**
   * Consolidate JTBDs in a parsed file
   * @param {string} inputFile - Path to input JSON file
   * @param {string} outputFile - Path to output JSON file (if not provided, generates a new filename)
   * @param {Object} options - Consolidation options
   * @returns {Promise<Object>} Consolidated results
   */
  async consolidateJTBDs(inputFile, outputFile, options = {}) {
    try {
      // Set default options
      const defaultOptions = {
        type: 'jtbd',           // 'jtbd' or 'scenario'
        threshold: 0.7,         // Similarity threshold
        method: 'semantic',     // 'semantic' or 'keyword'
        model: process.env.LLM_MODEL || config.llm?.model, // Use environment variable or config
        verbose: false          // Whether to log detailed information
      };
      
      const opts = { ...defaultOptions, ...options };
      
      // Read input file
      const inputData = await fs.readJson(inputFile);
      
      // Determine what to consolidate (JTBDs or scenarios)
      const itemsToConsolidate = opts.type === 'scenario' ? inputData.scenarios : inputData.jtbds;
      
      if (!itemsToConsolidate || itemsToConsolidate.length === 0) {
        throw new Error(`No ${opts.type}s found in input file`);
      }
      
      // Only consolidate concrete items that don't have a parent
      const concreteItems = itemsToConsolidate.filter(item => 
        !item.isAbstract && !item.parentId);
      
      if (concreteItems.length === 0) {
        console.log(`No concrete ${opts.type}s without parents found to consolidate`);
        // Generate a new output file even if no items to consolidate
        const defaultOutputFile = this._generateDefaultOutputFilename(inputFile, 'consolidated');
        const targetFile = outputFile || defaultOutputFile;
        await fs.ensureDir(path.dirname(targetFile));
        await fs.writeJson(targetFile, inputData, { spaces: 2 });
        console.log(`Results written to: ${targetFile}`);
        return inputData;
      }
      
      console.log(`Found ${concreteItems.length} concrete ${opts.type}s to consolidate`);
      
      // Cluster the concrete items
      const clusters = await jtbdClustering.clusterJTBDs(concreteItems, {
        threshold: opts.threshold,
        method: opts.method,
        type: opts.type  // Pass the item type to properly display in logs
      });
      
      console.log(`Generated ${clusters.length} clusters`);
      
      if (opts.verbose) {
        // Log detailed cluster information
        clusters.forEach((cluster, i) => {
          console.log(`\nCluster ${i + 1} (${cluster.length} items):`);
          cluster.forEach(item => {
            console.log(`- ${item.statement.substring(0, 100)}...`);
          });
        });
      }
      
      // Filter out singleton clusters if needed
      const significantClusters = clusters.filter(cluster => cluster.length > 1);
      
      if (significantClusters.length === 0) {
        console.log('No significant clusters found (all are singletons)');
        // Generate a new output file even if no significant clusters
        const defaultOutputFile = this._generateDefaultOutputFilename(inputFile, 'consolidated');
        const targetFile = outputFile || defaultOutputFile;
        await fs.ensureDir(path.dirname(targetFile));
        await fs.writeJson(targetFile, inputData, { spaces: 2 });
        console.log(`Results written to: ${targetFile}`);
        return inputData;
      }
      
      console.log(`Found ${significantClusters.length} significant clusters (with multiple items)`);
      
      // Generate abstract items from each significant cluster
      const abstractItems = [];
      
      for (let i = 0; i < significantClusters.length; i++) {
        const cluster = significantClusters[i];
        console.log(`Generating abstraction for cluster ${i + 1} (${cluster.length} items)...`);
        
        try {
          const abstractItem = await abstractionGenerator.generateAbstraction(cluster, {
            model: opts.model,
            type: opts.type  // Pass the type (jtbd or scenario) to the abstraction generator
          });
          
          abstractItems.push(abstractItem);
          
          // Update the parent IDs of the concrete items
          cluster.forEach(item => {
            const index = itemsToConsolidate.findIndex(i => i.id === item.id);
            if (index !== -1) {
              itemsToConsolidate[index].parentId = abstractItem.id;
            }
          });
          
          if (opts.verbose) {
            console.log(`Generated abstract ${opts.type}: ${abstractItem.statement.substring(0, 100)}...`);
          }
        } catch (error) {
          console.error(`Error generating abstraction for cluster ${i + 1}: ${error.message}`);
        }
      }
      
      console.log(`Generated ${abstractItems.length} abstract ${opts.type}s`);
      
      // Add abstract items to the original data
      if (opts.type === 'scenario') {
        inputData.scenarios = [...itemsToConsolidate, ...abstractItems];
      } else {
        inputData.jtbds = [...itemsToConsolidate, ...abstractItems];
      }
      
      // Add consolidation metadata
      inputData.consolidation = {
        type: opts.type,
        timestamp: new Date().toISOString(),
        method: opts.method,
        threshold: opts.threshold,
        clusters: significantClusters.length,
        abstractItems: abstractItems.length
      };
      
      // Generate default output filename if not provided
      const defaultOutputFile = this._generateDefaultOutputFilename(inputFile, 'consolidated');
      
      // Write to output file
      const targetFile = outputFile || defaultOutputFile;
      await fs.ensureDir(path.dirname(targetFile));
      await fs.writeJson(targetFile, inputData, { spaces: 2 });
      
      console.log(`Consolidated results written to: ${targetFile}`);
      
      return inputData;
    } catch (error) {
      throw new Error(`Consolidation failed: ${error.message}`);
    }
  }

  /**
   * Consolidate JTBDs first, then scenarios within each JTBD group
   * @param {string} inputFile - Path to input JSON file
   * @param {string} outputFile - Path to output JSON file (if not provided, generates a new filename)
   * @param {Object} options - Consolidation options
   * @returns {Promise<Object>} Consolidated results
   */
  async consolidateJTBDFirst(inputFile, outputFile, options = {}) {
    try {
      // Set default options
      const defaultOptions = {
        jtbdThreshold: 0.7,    // Similarity threshold for JTBDs
        scenarioThreshold: 0.7, // Similarity threshold for scenarios
        method: 'semantic',     // 'semantic' or 'keyword'
        model: process.env.LLM_MODEL || config.llm?.model, // Use environment variable or config
        verbose: false          // Whether to log detailed information
      };
      
      const opts = { ...defaultOptions, ...options };
      
      // Read input file
      const inputData = await fs.readJson(inputFile);
      
      // Validate input data
      if (!inputData.jtbds || !Array.isArray(inputData.jtbds) || inputData.jtbds.length === 0) {
        throw new Error('No JTBDs found in input file');
      }
      
      if (!inputData.scenarios || !Array.isArray(inputData.scenarios) || inputData.scenarios.length === 0) {
        console.log('No scenarios found in input file. Will only consolidate JTBDs.');
      }
      
      // Step 1: Consolidate JTBDs
      console.log('Step 1: Consolidating JTBDs...');
      const jtbdConsolidationResult = await this._consolidateItems(
        inputData.jtbds, 
        'jtbd',
        {
          threshold: opts.jtbdThreshold,
          method: opts.method,
          model: opts.model,
          verbose: opts.verbose
        }
      );
      
      const abstractJTBDs = jtbdConsolidationResult.abstractItems;
      const allJTBDs = jtbdConsolidationResult.allItems;
      
      console.log(`Generated ${abstractJTBDs.length} abstract JTBDs`);
      
      // Update the input data with consolidated JTBDs
      inputData.jtbds = allJTBDs;
      
      // Step 2: For each abstract JTBD, consolidate its related scenarios
      let allAbstractScenarios = [];
      let abstractScenarioCount = 0;
      
      if (inputData.scenarios && inputData.scenarios.length > 0) {
        console.log('Step 2: Consolidating scenarios within each abstract JTBD group...');
        
        // Build map of JTBD id to related scenario ids
        const jtbdToScenarioMap = this._buildJTBDToScenarioMap(inputData.jtbds, inputData.scenarios);
        
        // Process each abstract JTBD
        for (const abstractJTBD of abstractJTBDs) {
          // Get all scenarios related to this abstract JTBD's children
          const relatedScenarioIds = this._getRelatedScenarioIds(abstractJTBD, jtbdToScenarioMap);
          
          if (relatedScenarioIds.length <= 1) {
            console.log(`Abstract JTBD ${abstractJTBD.id} has ${relatedScenarioIds.length} related scenarios. Skipping scenario consolidation for this group.`);
            continue;
          }
          
          // Get the actual scenario objects
          const relatedScenarios = inputData.scenarios.filter(s => relatedScenarioIds.includes(s.id));
          
          console.log(`Consolidating ${relatedScenarios.length} scenarios related to abstract JTBD: ${abstractJTBD.id}`);
          
          // Consolidate these scenarios
          const scenarioConsolidationResult = await this._consolidateItems(
            relatedScenarios,
            'scenario',
            {
              threshold: opts.scenarioThreshold,
              method: opts.method,
              model: opts.model,
              verbose: opts.verbose
            }
          );
          
          // Add abstract scenarios to the list
          const abstractScenarios = scenarioConsolidationResult.abstractItems;
          abstractScenarioCount += abstractScenarios.length;
          
          // Link abstract scenarios to this abstract JTBD
          for (const abstractScenario of abstractScenarios) {
            abstractScenario.parentJtbdId = abstractJTBD.id;
            allAbstractScenarios.push(abstractScenario);
          }
          
          // Update related scenarios in abstract JTBD
          abstractJTBD.relatedAbstractScenarios = abstractScenarios.map(s => s.id);
        }
        
        // Update scenarios in input data
        const allScenarios = [...inputData.scenarios.filter(s => !s.isAbstract), ...allAbstractScenarios];
        inputData.scenarios = allScenarios;
        
        console.log(`Generated ${abstractScenarioCount} abstract scenarios across all JTBD groups`);
      }
      
      // Add consolidation metadata
      inputData.consolidation = {
        timestamp: new Date().toISOString(),
        method: opts.method,
        jtbdThreshold: opts.jtbdThreshold,
        scenarioThreshold: opts.scenarioThreshold,
        jtbdConsolidation: {
          abstractItems: abstractJTBDs.length,
          clusters: jtbdConsolidationResult.significantClusters?.length || 0
        },
        scenarioConsolidation: {
          abstractItems: abstractScenarioCount,
          groups: abstractJTBDs.length
        }
      };
      
      // Generate default output filename if not provided
      const defaultOutputFile = this._generateDefaultOutputFilename(inputFile, 'consolidated');
      
      // Write to output file
      const targetFile = outputFile || defaultOutputFile;
      await fs.ensureDir(path.dirname(targetFile));
      await fs.writeJson(targetFile, inputData, { spaces: 2 });
      
      console.log(`Consolidated results written to: ${targetFile}`);
      
      return inputData;
    } catch (error) {
      throw new Error(`JTBD-first consolidation failed: ${error.message}`);
    }
  }

  /**
   * Internal method to consolidate a set of items (JTBDs or scenarios)
   * @param {Array} items - Array of JTBD or scenario objects
   * @param {string} type - Type of items ('jtbd' or 'scenario')
   * @param {Object} options - Consolidation options
   * @returns {Promise<Object>} Consolidation results
   * @private
   */
  async _consolidateItems(items, type, options) {
    // Only consolidate concrete items that don't have a parent
    const concreteItems = items.filter(item => !item.isAbstract && !item.parentId);
    
    if (concreteItems.length === 0) {
      console.log(`No concrete ${type}s without parents found to consolidate`);
      return { 
        abstractItems: [],
        allItems: items,
        significantClusters: []
      };
    }
    
    console.log(`Found ${concreteItems.length} concrete ${type}s to consolidate`);
    
    // Cluster the concrete items
    const clusters = await jtbdClustering.clusterJTBDs(concreteItems, {
      threshold: options.threshold,
      method: options.method,
      type: type
    });
    
    console.log(`Generated ${clusters.length} clusters`);
    
    if (options.verbose) {
      // Log detailed cluster information
      clusters.forEach((cluster, i) => {
        console.log(`\nCluster ${i + 1} (${cluster.length} items):`);
        cluster.forEach(item => {
          console.log(`- ${item.statement.substring(0, 100)}...`);
        });
      });
    }
    
    // Filter out singleton clusters
    const significantClusters = clusters.filter(cluster => cluster.length > 1);
    
    if (significantClusters.length === 0) {
      console.log(`No significant ${type} clusters found (all are singletons)`);
      return {
        abstractItems: [],
        allItems: items,
        significantClusters: []
      };
    }
    
    console.log(`Found ${significantClusters.length} significant clusters (with multiple items)`);
    
    // Generate abstract items from each significant cluster
    const abstractItems = [];
    
    for (let i = 0; i < significantClusters.length; i++) {
      const cluster = significantClusters[i];
      console.log(`Generating abstraction for ${type} cluster ${i + 1} (${cluster.length} items)...`);
      
      try {
        const abstractItem = await abstractionGenerator.generateAbstraction(cluster, {
          model: options.model,
          type: type
        });
        
        abstractItems.push(abstractItem);
        
        // Update the parent IDs of the concrete items
        cluster.forEach(item => {
          const index = items.findIndex(i => i.id === item.id);
          if (index !== -1) {
            items[index].parentId = abstractItem.id;
          }
        });
        
        if (options.verbose) {
          console.log(`Generated abstract ${type}: ${abstractItem.statement.substring(0, 100)}...`);
        }
      } catch (error) {
        console.error(`Error generating abstraction for ${type} cluster ${i + 1}: ${error.message}`);
      }
    }
    
    // Combine the original items and the abstract items
    const allItems = [...items, ...abstractItems.filter(item => !items.some(i => i.id === item.id))];
    
    return {
      abstractItems,
      allItems,
      significantClusters
    };
  }
  
  /**
   * Build a map of JTBD IDs to related scenario IDs
   * @param {Array} jtbds - Array of JTBD objects
   * @param {Array} scenarios - Array of scenario objects
   * @returns {Object} Map of JTBD ID to array of related scenario IDs
   * @private
   */
  _buildJTBDToScenarioMap(jtbds, scenarios) {
    const map = {};
    
    // Initialize map for all JTBDs
    for (const jtbd of jtbds) {
      map[jtbd.id] = [];
      
      // If JTBD has relatedScenarios property, use it to populate the map
      if (jtbd.relatedScenarios && Array.isArray(jtbd.relatedScenarios)) {
        map[jtbd.id] = [...jtbd.relatedScenarios];
      }
    }
    
    return map;
  }
  
  /**
   * Get all scenario IDs related to an abstract JTBD (including its children)
   * @param {Object} abstractJTBD - Abstract JTBD object
   * @param {Object} jtbdToScenarioMap - Map of JTBD ID to related scenario IDs
   * @returns {Array} Array of related scenario IDs
   * @private
   */
  _getRelatedScenarioIds(abstractJTBD, jtbdToScenarioMap) {
    const relatedScenarioIds = new Set();
    
    // Add scenarios directly related to the abstract JTBD
    const directlyRelated = jtbdToScenarioMap[abstractJTBD.id] || [];
    directlyRelated.forEach(id => relatedScenarioIds.add(id));
    
    // Add scenarios related to child JTBDs
    if (abstractJTBD.childIds && Array.isArray(abstractJTBD.childIds)) {
      for (const childId of abstractJTBD.childIds) {
        const childRelated = jtbdToScenarioMap[childId] || [];
        childRelated.forEach(id => relatedScenarioIds.add(id));
      }
    }
    
    return Array.from(relatedScenarioIds);
  }

  /**
   * Generate a default output filename based on the input file
   * @param {string} inputFile - Path to input file
   * @param {string} suffix - Suffix to add to the filename
   * @returns {string} Default output filename
   * @private
   */
  _generateDefaultOutputFilename(inputFile, suffix) {
    const inputDir = path.dirname(inputFile);
    const inputBasename = path.basename(inputFile, path.extname(inputFile));
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    
    return path.join(inputDir, `${inputBasename}_${suffix}_${timestamp}.json`);
  }
}

module.exports = new ConsolidationManager();