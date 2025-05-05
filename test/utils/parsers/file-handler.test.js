/**
 * Tests for the File Handler utility
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs-extra');
const fileHandler = require('../../../src/utils/parsers/file-handler');

describe('File Handler', function() {
  // Create temporary directories for testing
  const testDataDir = path.join(__dirname, '../../data');
  
  before(async function() {
    // Create test directories
    await fs.ensureDir(testDataDir);
    
    // Create test files with different naming patterns
    const files = [
      {
        name: 'ai-integration_tech-decision-maker_platform-feedback.txt',
        content: 'Technical feedback about AI integration in multi-cloud environments.'
      },
      {
        name: 'interview_enterprise-it_security-concerns.md',
        content: 'Notes from interview with Enterprise IT security team about AI deployment concerns.'
      },
      {
        name: 'customer-acme_feedback_business-decision-maker.txt',
        content: 'Feedback from Acme Corporation business team regarding cost efficiency of AI deployments.'
      }
    ];
    
    for (const file of files) {
      await fs.writeFile(path.join(testDataDir, file.name), file.content);
    }
    
    // Create a subdirectory with additional files
    const subDir = path.join(testDataDir, 'customer-globalcorp');
    await fs.ensureDir(subDir);
    
    await fs.writeFile(
      path.join(subDir, 'survey_finance_cost-analysis.txt'), 
      'Survey results from Global Corp finance team about AI cost analysis.'
    );
  });

  after(async function() {
    // Clean up test directories
    await fs.remove(testDataDir);
  });

  describe('processSource', function() {
    it('should process a single file', async function() {
      const sourcePath = path.join(testDataDir, 'ai-integration_tech-decision-maker_platform-feedback.txt');
      const sources = await fileHandler.processSource(sourcePath);
      
      assert.strictEqual(Array.isArray(sources), true, 'Should return an array');
      assert.strictEqual(sources.length, 1, 'Should process one file');
      assert.strictEqual(sources[0].name, 'ai-integration_tech-decision-maker_platform-feedback.txt', 'Source name should match file name');
      assert.strictEqual(sources[0].type, 'document', 'Source type should be detected');
      assert.ok(sources[0].content, 'Source should have content');
    });

    it('should process a directory non-recursively', async function() {
      const sources = await fileHandler.processSource(testDataDir, false);
      
      assert.strictEqual(Array.isArray(sources), true, 'Should return an array');
      assert.strictEqual(sources.length, 3, 'Should process three files in root directory');
    });

    it('should process a directory recursively', async function() {
      const sources = await fileHandler.processSource(testDataDir, true);
      
      assert.strictEqual(Array.isArray(sources), true, 'Should return an array');
      assert.strictEqual(sources.length, 4, 'Should process all four files in directory tree');
    });
  });

  describe('Metadata detection', function() {
    it('should detect file type from filename', async function() {
      const interviewFile = path.join(testDataDir, 'interview_enterprise-it_security-concerns.md');
      const sources = await fileHandler.processSource(interviewFile);
      
      assert.strictEqual(sources[0].type, 'interview', 'Should detect interview file type');
    });

    it('should detect persona from filename', async function() {
      const techLeaderFile = path.join(testDataDir, 'ai-integration_tech-decision-maker_platform-feedback.txt');
      const sources = await fileHandler.processSource(techLeaderFile);
      
      assert.strictEqual(sources[0].metadata.persona, 'tech', 'Should detect tech persona');
    });

    it('should detect customer from directory structure', async function() {
      const customerFile = path.join(testDataDir, 'customer-globalcorp', 'survey_finance_cost-analysis.txt');
      const sources = await fileHandler.processSource(customerFile);
      
      assert.strictEqual(sources[0].metadata.customer, 'globalcorp', 'Should detect customer from directory name');
    });
  });
});