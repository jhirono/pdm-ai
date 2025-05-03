// src/utils/parsers/base-parser.js
const fs = require('fs');
const path = require('path');

/**
 * Base parser class that defines the interface for all model parsers
 */
class BaseParser {
  constructor() {
    // Initialize counter for generating unique IDs
    this.globalCounter = Date.now().toString(36);
  }

  /**
   * Parse content to extract JTBDs and scenarios
   * @param {string} content - Content to parse
   * @param {Object} fileInfo - Information about the file
   * @returns {Promise<Object>} Parsed results
   */
  async parse(content, fileInfo) {
    try {
      console.log(`Parsing ${fileInfo.name} with ${this.constructor.name}...`);
      
      // Get current date for source timestamp
      const currentDate = new Date().toISOString().split('T')[0];
      
      // Generate a unique source ID
      const sourceId = `source-${Date.now().toString(36)}`;
      
      // Call the model-specific API implementation
      const modelResults = await this.callModelAPI(content, fileInfo);
      
      if (!modelResults) {
        console.log(`No results from ${this.constructor.name}, using fallback`);
        return this.createFallbackResults(fileInfo, sourceId, currentDate);
      }
      
      // Ensure sources are properly formatted
      const source = {
        id: sourceId,
        name: fileInfo.name,
        path: fileInfo.path,
        date: currentDate
      };
      
      // Ensure unique IDs for JTBDs by prefixing with source ID
      const jtbds = modelResults.jtbds.map((jtbd, index) => {
        // Create a unique ID using source ID and a counter
        const uniqueId = this.ensureUniqueId(jtbd.id || `jtbd-${index + 1}`, sourceId);
        
        return {
          ...jtbd,
          id: uniqueId,
          sources: [sourceId],
          // Add hierarchical structure fields with default values for newly parsed JTBDs
          parentId: null,                 // No parent initially
          childIds: [],                   // No children initially
          isAbstract: false,              // All parsed JTBDs are concrete
          level: 1,                       // Level 1 for concrete JTBDs (0 would be abstract)
          // Add metrics for consolidation with default values
          occurrenceCount: 1,             // Initial occurrence count
          similarityScore: 1.0,           // Perfect similarity score with itself
          lastUpdated: new Date().toISOString() // Current timestamp
        };
      });
      
      // Ensure unique IDs for scenarios by prefixing with source ID
      const scenarios = modelResults.scenarios.map((scenario, index) => {
        // Create a unique ID using source ID and a counter
        const uniqueId = this.ensureUniqueId(scenario.id || `scenario-${index + 1}`, sourceId);
        
        return {
          ...scenario,
          id: uniqueId,
          sources: [sourceId],
          // Add hierarchical structure for scenarios with default values
          parentId: null,                 // No parent initially
          childIds: [],                   // No children initially
          isAbstract: false,              // All parsed scenarios are concrete
          level: 1,                       // Level 1 for concrete scenarios
          // Add metrics for consolidation with default values
          occurrenceCount: 1,             // Initial occurrence count
          similarityScore: 1.0,           // Perfect similarity score with itself
          lastUpdated: new Date().toISOString() // Current timestamp
        };
      });
      
      // Update relationships between JTBDs and scenarios with new unique IDs
      this.updateRelationships(jtbds, scenarios);
      
      return {
        sources: [source],
        jtbds,
        scenarios
      };
    } catch (error) {
      console.error(`Error in ${this.constructor.name}.parse: ${error.message}`);
      return this.createFallbackResults(fileInfo);
    }
  }
  
  /**
   * Ensure an ID is unique by combining with source ID
   * @param {string} id - Original ID
   * @param {string} sourceId - Source ID for prefixing
   * @returns {string} Unique ID
   */
  ensureUniqueId(id, sourceId) {
    // Extract the base part of sourceId (remove 'source-' prefix)
    const sourcePrefix = sourceId.replace('source-', '');
    
    // If ID already contains the source prefix, return as is
    if (id.includes(sourcePrefix)) {
      return id;
    }
    
    // Extract numeric/base part of the ID
    const idParts = id.split('-');
    const idBase = idParts.length > 1 ? idParts[1] : id;
    
    // Create a new unique ID by combining source prefix and original ID
    const uniqueId = `${idParts[0]}-${sourcePrefix}-${idBase}`;
    
    return uniqueId;
  }
  
  /**
   * Update relationships between JTBDs and scenarios with new unique IDs
   * @param {Array} jtbds - JTBD objects with unique IDs
   * @param {Array} scenarios - Scenario objects with unique IDs
   */
  updateRelationships(jtbds, scenarios) {
    // Create maps for quick lookup of new IDs
    const jtbdIdMap = new Map();
    const scenarioIdMap = new Map();
    
    // Map old IDs to new unique IDs
    jtbds.forEach(jtbd => {
      const oldId = jtbd.id.split('-').slice(-1)[0];
      jtbdIdMap.set(`jtbd-${oldId}`, jtbd.id);
    });
    
    scenarios.forEach(scenario => {
      const oldId = scenario.id.split('-').slice(-1)[0];
      scenarioIdMap.set(`scenario-${oldId}`, scenario.id);
    });
    
    // Update relationships
    jtbds.forEach(jtbd => {
      if (jtbd.relatedScenarios) {
        jtbd.relatedScenarios = jtbd.relatedScenarios.map(id => 
          scenarioIdMap.get(id) || id
        );
      }
    });
    
    scenarios.forEach(scenario => {
      if (scenario.relatedJtbds) {
        scenario.relatedJtbds = scenario.relatedJtbds.map(id => 
          jtbdIdMap.get(id) || id
        );
      }
    });
  }
  
  /**
   * Call model-specific API to extract JTBDs and scenarios
   * This method should be implemented by subclasses
   * @param {string} content - Content to parse
   * @param {Object} fileInfo - Information about the file
   * @returns {Promise<Object>} Model API results
   */
  async callModelAPI(content, fileInfo) {
    throw new Error('callModelAPI() must be implemented by subclass');
  }
  
  /**
   * Create fallback results when API call fails
   * @param {Object} fileInfo - Information about the file
   * @param {string} sourceId - Source ID
   * @param {string} date - Current date
   * @returns {Object} Fallback results
   */
  createFallbackResults(fileInfo, sourceId = `source-${Date.now().toString(36)}`, date = new Date().toISOString().split('T')[0]) {
    const timestamp = Date.now().toString(36);
    const jtbdId = `jtbd-${sourceId.replace('source-', '')}-${timestamp}-fallback`;
    const scenarioId = `scenario-${sourceId.replace('source-', '')}-${timestamp}-fallback`;
    const currentDateTime = new Date().toISOString();
    
    return {
      sources: [{
        id: sourceId,
        name: fileInfo.name,
        path: fileInfo.path,
        date: date
      }],
      jtbds: [
        {
          id: jtbdId,
          statement: "When using AI parsing tools, I want reliable backup mechanisms, so I can still get results even when the primary method fails",
          situation: "using AI parsing tools",
          motivation: "reliable backup mechanisms",
          outcome: "still get results even when the primary method fails",
          priority: 7,
          sourceQuotes: ["Fallback result generated due to parsing error or API limitation"],
          relatedScenarios: [scenarioId],
          sources: [sourceId],
          // Hierarchical structure fields with default values
          parentId: null,
          childIds: [],
          isAbstract: false,
          level: 1,
          // Metrics for consolidation with default values
          occurrenceCount: 1,
          similarityScore: 1.0,
          lastUpdated: currentDateTime
        }
      ],
      scenarios: [
        {
          id: scenarioId,
          statement: "As a product manager, I want fault-tolerant systems, so that I don't lose data when external services fail",
          persona: "product manager",
          action: "use fault-tolerant systems",
          value: "don't lose data when external services fail",
          priority: 7,
          relatedJtbds: [jtbdId],
          sources: [sourceId],
          // Hierarchical structure fields with default values
          parentId: null,
          childIds: [],
          isAbstract: false,
          level: 1,
          // Metrics for consolidation with default values
          occurrenceCount: 1,
          similarityScore: 1.0,
          lastUpdated: currentDateTime
        }
      ]
    };
  }
}

module.exports = BaseParser;