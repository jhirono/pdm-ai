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
   * Parse content to extract only scenarios (without JTBDs)
   * @param {string} content - The content to parse
   * @param {Object} fileInfo - Information about the file
   * @param {Object} options - Parsing options
   * @returns {Promise<Object>} Parsed scenarios
   */
  async parseScenarios(content, fileInfo, options = {}) {
    const sourceId = `source-${Date.now().toString(36)}`;
    
    // Create specialized prompt for scenario extraction
    const specializedPrompt = this.createScenarioExtractionPrompt(content, fileInfo);
    
    // Call the model API with the scenario-focused prompt
    const results = await this.callModelAPIForScenarios(content, fileInfo, specializedPrompt);
    
    if (!results || !results.scenarios || results.scenarios.length === 0) {
      console.log(`No valid scenario results obtained from the model API for ${fileInfo.name}.`);
      return this.generateScenarioFallbackResults(sourceId, fileInfo);
    }
    
    // Generate IDs for any scenarios without them
    this.ensureScenarioIds(results, sourceId);
    
    // Add the source to all scenarios if not already present
    this.addSourceToScenarios(results, sourceId, fileInfo);
    
    return {
      sources: [{
        id: sourceId,
        name: fileInfo.name,
        path: fileInfo.path,
        date: new Date().toISOString().split('T')[0]
      }],
      scenarios: results.scenarios || []
    };
  }

  /**
   * Call model API specifically for scenario extraction
   * @param {string} content - The content to parse
   * @param {Object} fileInfo - Information about the file
   * @param {string} specializedPrompt - Specialized prompt for scenario extraction
   * @returns {Promise<Object>} Parsed scenarios
   */
  async callModelAPIForScenarios(content, fileInfo, specializedPrompt) {
    // By default, use the regular API call but with a scenario-focused prompt
    // This should be overridden by model-specific implementations if needed
    try {
      const systemPrompt = this.createScenarioSystemPrompt();
      const results = await this.callModelAPI(content, fileInfo, systemPrompt, specializedPrompt);
      return results;
    } catch (error) {
      console.error(`Error calling model API for scenario extraction: ${error.message}`);
      return null;
    }
  }

  /**
   * Create a system prompt focused on scenario extraction
   * @returns {string} System prompt for scenario extraction
   */
  createScenarioSystemPrompt() {
    return `You are an expert product manager skilled at extracting user scenarios from customer feedback.
You specialize in identifying and formatting user scenarios in the format "As a [persona], I want to [action], so that I can [value/goal]".
Always provide your output as a valid JSON object with the structure specified in the prompt.
Do not include ANY text outside of the JSON object.`;
  }

  /**
   * Create a specialized prompt for scenario extraction
   * @param {string} content - The content to create a prompt for
   * @param {Object} fileInfo - Information about the file
   * @returns {string} Specialized prompt for scenario extraction
   */
  createScenarioExtractionPrompt(content, fileInfo) {
    return `Analyze the following customer feedback and extract user scenarios in the format "As a [persona], I want to [action], so that I can [value/goal]".

Extract as many relevant user scenarios as possible. Assign each scenario a priority from 1-10 (10 being highest).
Try to identify specific personas from the text rather than using generic terms like "user".
Focus on extracting actionable scenarios that reflect real user needs.

CUSTOMER INPUT:
${content}

FORMAT YOUR RESPONSE AS A VALID JSON OBJECT WITH THIS STRUCTURE:
{
  "scenarios": [
    {
      "id": "scenario-[unique-id]",
      "statement": "As a [persona], I want to [action], so that I can [value/goal]",
      "persona": "[persona]",
      "action": "[action]",
      "value": "[value/goal]",
      "priority": [1-10]
    }
  ]
}

IMPORTANT: Respond with ONLY the JSON object. Do not include any text outside the JSON.`;
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
   * Ensure all scenarios have unique IDs by completely replacing any LLM-generated IDs
   * @param {Object} results - The parsing results
   * @param {string} sourceId - The ID of the source
   */
  ensureScenarioIds(results, sourceId) {
    if (results && results.scenarios) {
      // Generate a unique timestamp-based prefix for this batch
      const batchPrefix = Date.now().toString(36);
      
      results.scenarios.forEach((scenario, index) => {
        // Always generate a new ID, ignoring any LLM-generated ID
        const sourcePrefix = sourceId.replace('source-', '');
        scenario.id = `scenario-${sourcePrefix}-${batchPrefix}-${index + 1}`;
      });
    }
  }

  /**
   * Add source information to scenarios
   * @param {Object} results - The parsing results
   * @param {string} sourceId - The ID of the source
   * @param {Object} fileInfo - Information about the file
   */
  addSourceToScenarios(results, sourceId, fileInfo) {
    if (results && results.scenarios) {
      results.scenarios.forEach(scenario => {
        if (!scenario.sources) {
          scenario.sources = [sourceId];
        } else if (!scenario.sources.includes(sourceId)) {
          scenario.sources.push(sourceId);
        }
      });
    }
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
   * Generate fallback results for scenario extraction when parsing fails
   * @param {string} sourceId - The ID of the source
   * @param {Object} fileInfo - Information about the file
   * @returns {Object} Fallback results
   */
  generateScenarioFallbackResults(sourceId, fileInfo) {
    return {
      sources: [{
        id: sourceId,
        name: fileInfo.name,
        path: fileInfo.path,
        date: new Date().toISOString().split('T')[0]
      }],
      scenarios: []
    };
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