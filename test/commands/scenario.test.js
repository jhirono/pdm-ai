/**
 * Tests for the Scenario Command functionality
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs-extra');
const { execute } = require('../../src/commands/scenario');

describe('Scenario Command', function() {
  // Create temporary directories for testing
  const testDataDir = path.join(__dirname, '../data');
  const testOutputDir = path.join(__dirname, '../output');
  let outputFile;

  before(async function() {
    // Create test directories
    await fs.ensureDir(testDataDir);
    await fs.ensureDir(testOutputDir);
    
    // Create sample test data
    const sampleContent = `
From: tech-lead@enterprise.com
Subject: Need for unified AI deployment strategy across clouds

Our team is evaluating the possibilities of deploying AI models consistently across multiple cloud environments.
Currently, we're running workloads on AWS, Azure, and GCP, but each team is using different approaches for
AI integration. This is creating operational headaches and inefficiencies.

Key challenges:
1. Inconsistent deployment patterns across cloud providers
2. Difficulty monitoring model performance in a unified way
3. Security and compliance concerns with different cloud-specific approaches
4. Training data management across environments

We'd like your platform to help us establish a standardized approach to AI deployment that works consistently
regardless of the underlying cloud infrastructure.

Let me know if you need more specific details about our environment.

Thanks,
Sarah Johnson
VP of Cloud Infrastructure
Enterprise Solutions Inc.
`;
    
    await fs.writeFile(path.join(testDataDir, 'sample_feedback.txt'), sampleContent);
  });

  after(async function() {
    // Clean up test directories and files
    await fs.remove(testDataDir);
    if (outputFile && fs.existsSync(outputFile)) {
      await fs.remove(outputFile);
    }
  });

  it('should extract scenarios from a text file using mock parser', async function() {
    const testSource = path.join(testDataDir, 'sample_feedback.txt');
    const testOutput = path.join(testOutputDir, 'test_scenarios.json');
    
    const options = {
      output: testOutput,
      mock: true,
      verbose: false
    };
    
    outputFile = await execute(testSource, options);
    
    // Check if output file was created
    assert.strictEqual(fs.existsSync(outputFile), true, 'Output file should be created');
    
    // Read and parse output file
    const outputData = await fs.readJSON(outputFile);
    
    // Verify structure and content
    assert.strictEqual(typeof outputData, 'object', 'Output should be a JSON object');
    assert.strictEqual(typeof outputData.metadata, 'object', 'Output should have metadata');
    assert.strictEqual(Array.isArray(outputData.sources), true, 'Output should have sources array');
    assert.strictEqual(Array.isArray(outputData.scenarios), true, 'Output should have scenarios array');
    assert.strictEqual(outputData.sources.length, 1, 'Should process one source file');
    assert.ok(outputData.scenarios.length > 0, 'Should extract at least one scenario');
    
    // Verify scenario structure
    const scenario = outputData.scenarios[0];
    assert.ok(scenario.id, 'Scenario should have ID');
    assert.strictEqual(scenario.format, 'user-story', 'Format should be user-story');
    assert.ok(scenario.statement, 'Scenario should have statement');
    assert.ok(scenario.persona, 'Scenario should have persona');
    assert.ok(scenario.action, 'Scenario should have action');
    assert.ok(scenario.value, 'Scenario should have value');
    assert.ok(Array.isArray(scenario.sources), 'Scenario should have sources array');
    assert.strictEqual(scenario.sources.length, 1, 'Scenario should reference one source');
  });

  it('should handle recursive directory processing', async function() {
    // Create subdirectory for testing recursive option
    const subDir = path.join(testDataDir, 'subdir');
    await fs.ensureDir(subDir);
    
    // Create additional test file in subdirectory
    const additionalContent = `
We need a platform that allows us to deploy consistent AI models across our hybrid cloud environment.
- Multi-cloud support
- Standardized deployment patterns
- Performance monitoring
`;
    
    await fs.writeFile(path.join(subDir, 'additional_feedback.txt'), additionalContent);
    
    const testOutput = path.join(testOutputDir, 'recursive_test_scenarios.json');
    
    const options = {
      output: testOutput,
      recursive: true,
      mock: true,
      verbose: false
    };
    
    outputFile = await execute(testDataDir, options);
    
    // Check if output file was created
    assert.strictEqual(fs.existsSync(outputFile), true, 'Output file should be created');
    
    // Read and parse output file
    const outputData = await fs.readJSON(outputFile);
    
    // Verify recursive processing
    assert.strictEqual(Array.isArray(outputData.sources), true, 'Output should have sources array');
    assert.strictEqual(outputData.sources.length, 2, 'Should process two source files');
    
    // Clean up subdirectory
    await fs.remove(subDir);
  });
});