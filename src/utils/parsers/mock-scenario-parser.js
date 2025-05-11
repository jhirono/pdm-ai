/**
 * Mock Scenario Parser
 * For testing: Returns predefined scenarios without making API calls
 */
import { v4 as uuidv4 } from 'uuid';
import logger from '../logger.js';

class MockScenarioParser {
  /**
   * Mock extraction of scenarios - returns predefined data
   * @param {string} content - Text content to parse (not used in mock)
   * @param {object} sourceInfo - Information about the source file
   * @returns {Promise<Array>} - Array of mock scenarios
   */
  async extractScenarios(content, sourceInfo) {
    logger.debug(`MOCK: Extracting scenarios from source: ${sourceInfo.name}`);
    
    // Create some sample mock scenarios
    const mockScenarios = [
      {
        statement: "As a product manager, I want to understand user needs, so that I can build better products",
        persona: "product manager",
        action: "understand user needs",
        value: "build better products"
      },
      {
        statement: "As a developer, I want to automate testing, so that I can deliver more reliable code",
        persona: "developer",
        action: "automate testing",
        value: "deliver more reliable code"
      },
      {
        statement: "As a business user, I want to analyze data quickly, so that I can make informed decisions",
        persona: "business user",
        action: "analyze data quickly",
        value: "make informed decisions"
      }
    ];
    
    const timestamp = new Date().toISOString();
    const mockCustomer = sourceInfo.name.includes('lazuli') ? 'Lazuli Corp' : null;
    
    // Transform mock scenarios to match our data structure
    const transformedScenarios = mockScenarios.map(scenario => ({
      id: `scenario-${uuidv4()}`,
      format: "user-story",
      statement: scenario.statement,
      persona: scenario.persona,
      action: scenario.action,
      value: scenario.value,
      sources: [sourceInfo.id],
      customer: mockCustomer,
      version: "1.0",
      timestamp: timestamp
    }));
    
    logger.debug(`MOCK: Generated ${transformedScenarios.length} mock scenarios`);
    
    // Simulate async behavior
    return new Promise(resolve => {
      setTimeout(() => resolve(transformedScenarios), 300);
    });
  }
}

const mockScenarioParser = new MockScenarioParser();
export default mockScenarioParser;