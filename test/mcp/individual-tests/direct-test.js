#!/usr/bin/env node

/**
 * Direct test script for PDM-AI MCP
 * This script tests the MCP server implementation directly
 */
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

// Create a temp directory for testing
const TEMP_DIR = path.join(os.tmpdir(), `pdm-test-${Date.now()}`);
// Path to Japanese test file
const JAPANESE_TEST_FILE = path.resolve(__dirname, '../inputs/japanese.txt');

// Get access to the server's tool definitions and functions
// Since the tools are registered directly on the server and not exposed,
// we need to create our own wrapper to simulate direct tool calls
async function testMcpDirectly() {
  try {
    console.log('Setting up direct MCP test');
    
    // Create test directory in a temporary location to avoid conflicts
    console.log(`Creating temporary test directory: ${TEMP_DIR}`);
    await fs.ensureDir(TEMP_DIR);
    
    // Change to the temporary directory for the test
    const originalDir = process.cwd();
    process.chdir(TEMP_DIR);
    console.log(`Changed working directory to: ${process.cwd()}`);
    
    try {
      // Import the commands directly to bypass the MCP server
      const init = require('../../../src/commands/init');
      const scenario = require('../../../src/commands/scenario');
      const jtbd = require('../../../src/commands/jtbd');
      const visualize = require('../../../src/commands/visualize');
      
      console.log('Testing PDM-AI MCP commands directly');
      console.log(`Testing with Japanese file: ${JAPANESE_TEST_FILE}`);
      
      // Prepare Japanese content for testing
      const japaneseContent = await fs.readFile(JAPANESE_TEST_FILE, 'utf8');
      const localJapaneseFile = path.join(TEMP_DIR, 'japanese.txt');
      await fs.writeFile(localJapaneseFile, japaneseContent);
      console.log(`Copied Japanese test content to ${localJapaneseFile}`);
      
      // Test project initialization
      console.log('\n--- Testing Project Initialization ---');
      try {
        const projectName = 'MCP-Test-Project';
        // Use current directory (which is now TEMP_DIR)
        const projectDir = process.cwd();
        
        console.log(`Initializing project "${projectName}" in "${projectDir}"`);
        const initResult = await init(projectName, projectDir);
        console.log('Initialization result:', initResult);
        
        if (initResult && initResult.success) {
          // Test scenario parsing with Japanese.txt
          console.log('\n--- Testing Japanese Scenario Parsing ---');
          
          const scenarioOptions = {
            output: path.join(projectDir, '.pdm', 'outputs', 'scenarios', 'japanese-scenarios.json'),
            recursive: false,
            model: 'gpt-4o',
            verbose: true
          };
          
          console.log(`Parsing scenarios from "${localJapaneseFile}" with options:`, scenarioOptions);
          const outputPath = await scenario.execute(localJapaneseFile, scenarioOptions);
          console.log('Scenario parsing completed with output path:', outputPath);
          
          if (outputPath) {
            // Test JTBD generation with the output from scenario parsing
            console.log('\n--- Testing JTBD Generation ---');
            
            const jtbdOptions = {
              output: path.join(projectDir, '.pdm', 'outputs', 'jtbds', 'japanese-jtbds.json'),
              model: 'gpt-4o',
              verbose: true
            };
            
            console.log(`Generating JTBDs from "${outputPath}" with options:`, jtbdOptions);
            const jtbdOutput = await jtbd.execute(outputPath, jtbdOptions);
            console.log('JTBD generation completed with output path:', jtbdOutput);
            
            if (jtbdOutput) {
              // Test visualization
              console.log('\n--- Testing Visualization ---');
              
              const visualOptions = {
                format: 'mermaid',
                output: path.join(projectDir, '.pdm', 'outputs', 'visualizations', 'japanese-visualization.md'),
                verbose: true
              };
              
              console.log(`Generating visualization from "${jtbdOutput}" with options:`, visualOptions);
              const visualOutput = await visualize.execute(jtbdOutput, visualOptions);
              console.log('Visualization completed with output path:', visualOutput);
            }
          }
        }
      } catch (error) {
        console.error('Test error:', error);
      }
    } finally {
      // Change back to the original directory
      process.chdir(originalDir);
      console.log(`Restored working directory to: ${process.cwd()}`);
      
      // Clean up the test directory if needed
      if (process.env.KEEP_TEMP !== 'true') {
        console.log(`Cleaning up temporary test directory: ${TEMP_DIR}`);
        await fs.remove(TEMP_DIR);
      } else {
        console.log(`Temporary test directory kept at: ${TEMP_DIR}`);
      }
    }
    
    console.log('\nDirect testing completed successfully!');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the direct test
testMcpDirectly().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});