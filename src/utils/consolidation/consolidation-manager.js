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