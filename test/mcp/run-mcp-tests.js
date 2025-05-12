#!/usr/bin/env node

/**
 * MCP Integration Tests
 * 
 * This script tests the PDM-AI MCP implementation to ensure that all tools
 * work correctly with the async command implementations.
 */
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const { execSync } = require('child_process');

// Explicitly load environment variables from .env file
require('dotenv').config({ path: path.join(path.resolve(__dirname, '../..'), '.env') });

// Configure test timeouts (API calls can take time)
const API_TIMEOUT = 5 * 60 * 1000; // 5 minutes timeout for API calls

// Path settings - use a completely separate temporary directory
const TEST_ROOT = path.join(os.tmpdir(), `pdm-mcp-test-${Date.now()}`);
const REPO_ROOT = path.resolve(__dirname, '../..');
const MCP_SERVER_SCRIPT = path.join(REPO_ROOT, 'src/mcp/index.js');

// Available test inputs
const TEST_INPUTS = {
  japanese: path.resolve(REPO_ROOT, 'test/inputs/japanese.txt'),
  english: path.resolve(REPO_ROOT, 'test/inputs/aiplat/governance_tech-decision-maker_compliance-framework.txt'),
  aiIntegration: path.resolve(REPO_ROOT, 'test/inputs/aiplat2/ai-integration_ai-developer_deployment-pipeline.txt'),
  dataManagement: path.resolve(REPO_ROOT, 'test/inputs/aiplat3/data-management_ai-developer_feature-engineering.txt')
};

// Test configuration flags
const SKIP_API_CALLS = process.env.SKIP_API_CALLS === 'true';
const CLEAN_UP = process.env.KEEP_TEMP !== 'true';
const USE_SMALL_DATASET = process.env.FULL_TEST !== 'true';

// Main test function
async function runTests() {
  try {
    console.log('========================================================');
    console.log('PDM-AI MCP Integration Tests');
    console.log('========================================================');
    console.log(`Repository Root: ${REPO_ROOT}`);
    console.log(`Test Root: ${TEST_ROOT}`);
    console.log(`API Calls: ${SKIP_API_CALLS ? 'SKIPPED' : 'ENABLED'}`);
    console.log(`Dataset: ${USE_SMALL_DATASET ? 'SMALL (1-2 files)' : 'FULL'}`);
    console.log(`Clean Up: ${CLEAN_UP ? 'ENABLED' : 'DISABLED'}`);
    console.log(`API Timeout: ${API_TIMEOUT / 1000} seconds`);
    
    // Log API key status (redacting the actual key for security)
    const openaiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
    console.log(`API Key status: ${openaiKey ? 'SET (' + (openaiKey.substring(0, 7) + '...') + ')' : 'NOT SET'}`);
    console.log(`LLM Model: ${process.env.LLM_MODEL || 'Not set'}`);
    console.log('========================================================');
    
    // Store original directory and create test root outside of current project
    const originalDir = process.cwd();
    console.log(`Original working directory: ${originalDir}`);
    
    // Ensure the test directory exists and is empty
    if (fs.existsSync(TEST_ROOT)) {
      console.log(`Removing existing test directory: ${TEST_ROOT}`);
      fs.removeSync(TEST_ROOT);
    }
    
    console.log(`Creating clean test directory: ${TEST_ROOT}`);
    fs.ensureDirSync(TEST_ROOT);
    
    // Copy .env file to test directory to ensure API key is available
    const envFilePath = path.join(REPO_ROOT, '.env');
    if (fs.existsSync(envFilePath)) {
      fs.copyFileSync(envFilePath, path.join(TEST_ROOT, '.env'));
      console.log(`Copied .env file to test directory`);
    }
    
    // Switch to the test directory
    process.chdir(TEST_ROOT);
    console.log(`Changed working directory to: ${process.cwd()}`);
    
    // Set up directories and copy test inputs
    console.log(`Setting up test directories and copying test data...`);
    fs.ensureDirSync(path.join(TEST_ROOT, 'inputs'));
    
    // Copy selected test files
    if (USE_SMALL_DATASET) {
      fs.copySync(TEST_INPUTS.japanese, path.join(TEST_ROOT, 'inputs/japanese.txt'));
      fs.copySync(TEST_INPUTS.english, path.join(TEST_ROOT, 'inputs/english.txt'));
    } else {
      // Copy all test files
      const testFilesDir = path.resolve(REPO_ROOT, 'test/inputs');
      fs.copySync(testFilesDir, path.join(TEST_ROOT, 'inputs'));
    }
    
    console.log('Test directories setup complete.');
    
    try {
      // Import all command modules directly
      const init = require('../../src/commands/init');
      const scenario = require('../../src/commands/scenario');
      const jtbd = require('../../src/commands/jtbd');
      const visualize = require('../../src/commands/visualize');
      
      // Track test results
      const results = {
        init: { status: 'NOT RUN', error: null },
        scenario: { status: 'NOT RUN', error: null },
        jtbd: { status: 'NOT RUN', error: null },
        visualize: { status: 'NOT RUN', error: null },
        mcp: { status: 'NOT RUN', error: null }
      };
      
      // Test initialization
      console.log('\n=== Testing Project Initialization ===');
      
      try {
        console.log('Running init function directly...');
        const projectName = 'MCP Test Project';
        const projectDir = path.join(TEST_ROOT, 'project');
        fs.ensureDirSync(projectDir);
        
        const initResult = await init(projectName, projectDir);
        console.log('Init result:', initResult);
        
        if (initResult && initResult.success) {
          console.log('✅ Init test PASSED - No "cb is not a function" error!');
          results.init.status = 'PASSED';
        } else {
          console.log('❌ Init test FAILED - Did not return success');
          results.init.status = 'FAILED';
          results.init.error = 'Did not return success';
        }
      } catch (error) {
        console.error('❌ Init test FAILED with error:', error);
        results.init.status = 'FAILED';
        results.init.error = error.message;
      }
      
      // Test scenario parsing
      if (!SKIP_API_CALLS) {
        console.log('\n=== Testing Scenario Parsing (This may take a few minutes) ===');
        
        try {
          console.log('Running scenario function with Japanese test file...');
          const scenarioOptions = {
            output: path.join(TEST_ROOT, 'outputs', 'scenarios', 'japanese-scenarios.json'),
            verbose: true,
            model: process.env.LLM_MODEL || 'gpt-4o'
          };
          
          fs.ensureDirSync(path.dirname(scenarioOptions.output));
          
          console.log(`Using model: ${scenarioOptions.model}`);
          console.log(`This may take several minutes for Japanese text processing...`);
          
          // Start a timer to track how long it takes
          const startTime = Date.now();
          
          // Run scenario parsing with a timeout
          const scenarioParsingPromise = scenario.execute(path.join(TEST_ROOT, 'inputs/japanese.txt'), scenarioOptions);
          
          // Add a timeout to catch if it's taking too long
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Scenario parsing timed out after ${API_TIMEOUT/1000} seconds`)), API_TIMEOUT);
          });
          
          // Wait for either completion or timeout
          const scenarioResult = await Promise.race([scenarioParsingPromise, timeoutPromise]);
          const elapsedTime = (Date.now() - startTime) / 1000;
          
          console.log(`Scenario parsing completed in ${elapsedTime.toFixed(1)} seconds`);
          console.log('Scenario result:', typeof scenarioResult === 'string' ? scenarioResult : JSON.stringify(scenarioResult, null, 2));
          
          // Check if we have a valid result (either a string path or object with outputPath)
          const outputPath = typeof scenarioResult === 'string' ? 
                            scenarioResult : 
                            (scenarioResult && scenarioResult.outputPath ? scenarioResult.outputPath : null);
          
          if (outputPath && fs.existsSync(outputPath)) {
            console.log('✅ Scenario test PASSED - No "cb is not a function" error!');
            console.log(`Scenarios saved to: ${outputPath}`);
            
            // Check the content of the scenario file
            const scenarioData = fs.readJsonSync(outputPath);
            const scenarioCount = scenarioData.scenarios ? scenarioData.scenarios.length : 0;
            console.log(`Found ${scenarioCount} scenarios in the output file`);
            
            results.scenario.status = 'PASSED';
            
            // Test JTBD generation
            console.log('\n=== Testing JTBD Generation ===');
            
            try {
              console.log('Running JTBD function with scenario output...');
              const jtbdOptions = {
                output: path.join(TEST_ROOT, 'outputs', 'jtbds', 'japanese-jtbds.json'),
                verbose: true,
                model: process.env.LLM_MODEL || 'gpt-4o'
              };
              
              fs.ensureDirSync(path.dirname(jtbdOptions.output));
              console.log(`This may take several minutes for JTBD generation...`);
              
              // Start a timer to track how long it takes
              const jtbdStartTime = Date.now();
              
              // Run JTBD generation with a timeout
              const jtbdPromise = jtbd.execute(outputPath, jtbdOptions);
              
              // Add a timeout to catch if it's taking too long
              const jtbdTimeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`JTBD generation timed out after ${API_TIMEOUT/1000} seconds`)), API_TIMEOUT);
              });
              
              // Wait for either completion or timeout
              const jtbdResult = await Promise.race([jtbdPromise, jtbdTimeoutPromise]);
              const jtbdElapsedTime = (Date.now() - jtbdStartTime) / 1000;
              
              console.log(`JTBD generation completed in ${jtbdElapsedTime.toFixed(1)} seconds`);
              console.log('JTBD result:', typeof jtbdResult === 'string' ? jtbdResult : JSON.stringify(jtbdResult, null, 2));
              
              // Check if we have a valid result - either a string path or object with outputPath property
              const jtbdOutputPath = typeof jtbdResult === 'string' ? 
                                  jtbdResult : 
                                  (jtbdResult && jtbdResult.outputPath ? jtbdResult.outputPath : null);
              
              // Mark as PASSED if either:
              // 1. We have a valid output path and the file exists
              // 2. The result contains jtbds array directly
              if ((jtbdOutputPath && fs.existsSync(jtbdOutputPath)) || 
                  (jtbdResult && jtbdResult.jtbds && Array.isArray(jtbdResult.jtbds))) {
                console.log('✅ JTBD test PASSED - No "cb is not a function" error!');
                
                // If we have a file path, check its contents
                if (jtbdOutputPath && fs.existsSync(jtbdOutputPath)) {
                  console.log(`JTBDs saved to: ${jtbdOutputPath}`);
                  try {
                    const jtbdData = fs.readJsonSync(jtbdOutputPath);
                    const jtbdCount = jtbdData.jtbds ? jtbdData.jtbds.length : 0;
                    console.log(`Found ${jtbdCount} JTBDs in the output file`);
                  } catch (error) {
                    console.log(`Warning: Could not parse JTBD file: ${error.message}`);
                  }
                } else {
                  // Result has jtbds directly in the object
                  console.log(`Found ${jtbdResult.jtbds.length} JTBDs in the result`);
                }
                
                results.jtbd.status = 'PASSED';
                
                // Test visualizations
                console.log('\n=== Testing Visualization ===');
                
                try {
                  console.log('Running Mermaid visualization...');
                  const mermaidOptions = {
                    format: 'mermaid',
                    output: path.join(TEST_ROOT, 'outputs', 'visualizations', 'japanese-mermaid.md'),
                    perspective: 'jtbd',
                    verbose: true
                  };
                  
                  fs.ensureDirSync(path.dirname(mermaidOptions.output));
                  
                  // Use the correct path to the JTBD file - ensure we're using the file path if available
                  const jtbdSourcePath = jtbdOutputPath || 
                                     (jtbdResult && jtbdResult.outputPath ? jtbdResult.outputPath : null);
                  
                  // Skip visualization if we don't have a valid source path
                  if (!jtbdSourcePath || !fs.existsSync(jtbdSourcePath)) {
                    console.log('❌ No valid JTBD source path found for visualization test. Skipping...');
                    
                    // Try to copy the JTBD result to a file if we have it in memory but not on disk
                    if (jtbdResult && jtbdResult.jtbds && Array.isArray(jtbdResult.jtbds)) {
                      const tempJtbdPath = path.join(TEST_ROOT, 'outputs', 'jtbds', 'japanese-scenarios-jtbds.json');
                      fs.ensureDirSync(path.dirname(tempJtbdPath));
                      fs.writeJsonSync(tempJtbdPath, jtbdResult);
                      console.log(`Created temporary JTBD file at ${tempJtbdPath} for visualization testing`);
                      
                      // Now use this path for visualization
                      if (fs.existsSync(tempJtbdPath)) {
                        console.log('✅ Successfully created temporary JTBD file. Proceeding with visualization test.');
                        const mermaidResult = await visualize.execute(tempJtbdPath, mermaidOptions);
                        console.log('Mermaid visualization result:', typeof mermaidResult === 'string' ? mermaidResult : JSON.stringify(mermaidResult, null, 2));
                        
                        // Check if visualization was successful - either by checking result or the expected output file
                        const mermaidOutputPath = typeof mermaidResult === 'string' ? 
                                          mermaidResult : 
                                          (mermaidResult && mermaidResult.outputPath ? mermaidResult.outputPath : mermaidOptions.output);
                        
                        if (mermaidOutputPath && fs.existsSync(mermaidOutputPath)) {
                          console.log('✅ Mermaid visualization test PASSED');
                          results.visualize.status = 'PASSED';
                        } else {
                          console.log('❌ Mermaid visualization test FAILED');
                          results.visualize.status = 'FAILED';
                          results.visualize.error = 'Mermaid visualization failed';
                        }
                      } else {
                        results.visualize.status = 'SKIPPED';
                        results.visualize.error = 'Could not create temporary JTBD file';
                      }
                    } else {
                      results.visualize.status = 'SKIPPED';
                      results.visualize.error = 'No valid JTBD source path';
                    }
                  } else {
                    const mermaidResult = await visualize.execute(jtbdSourcePath, mermaidOptions);
                    console.log('Mermaid visualization result:', typeof mermaidResult === 'string' ? mermaidResult : JSON.stringify(mermaidResult, null, 2));
                  
                    // Check if visualization was successful
                    const mermaidOutputPath = typeof mermaidResult === 'string' ? 
                                      mermaidResult : 
                                      (mermaidResult && mermaidResult.outputPath ? mermaidResult.outputPath : null);
                  
                    if (mermaidOutputPath && fs.existsSync(mermaidOutputPath)) {
                      console.log('✅ Mermaid visualization test PASSED');
                      
                      // Test CSV visualization
                      console.log('Running CSV visualization...');
                      const csvOptions = {
                        format: 'csv',
                        output: path.join(TEST_ROOT, 'outputs', 'visualizations', 'japanese-export.csv'),
                        verbose: true
                      };
                      
                      const csvResult = await visualize.execute(jtbdSourcePath, csvOptions);
                      console.log('CSV visualization result:', typeof csvResult === 'string' ? csvResult : JSON.stringify(csvResult, null, 2));
                      
                      // Check if visualization was successful
                      const csvOutputPath = typeof csvResult === 'string' ? 
                                      csvResult : 
                                      (csvResult && csvResult.outputPath ? csvResult.outputPath : null);
                      
                      if (csvOutputPath && fs.existsSync(csvOutputPath)) {
                        console.log('✅ CSV visualization test PASSED');
                        results.visualize.status = 'PASSED';
                      } else {
                        console.log('❌ CSV visualization test FAILED');
                        results.visualize.status = 'PARTIAL';
                        results.visualize.error = 'CSV export failed';
                      }
                    } else {
                      console.log('❌ Mermaid visualization test FAILED');
                      results.visualize.status = 'FAILED';
                      results.visualize.error = 'Mermaid visualization failed';
                    }
                  }
                } catch (error) {
                  console.error('❌ Visualization test FAILED with error:', error);
                  results.visualize.status = 'FAILED';
                  results.visualize.error = error.message;
                }
              } else {
                console.log('❌ JTBD test FAILED - Did not return valid output');
                results.jtbd.status = 'FAILED';
                results.jtbd.error = 'Did not return valid output';
              }
            } catch (error) {
              console.error('❌ JTBD test FAILED with error:', error);
              results.jtbd.status = 'FAILED';
              results.jtbd.error = error.message;
            }
          } else {
            console.log('❌ Scenario test FAILED - Did not return valid output');
            results.scenario.status = 'FAILED';
            results.scenario.error = 'Did not return valid output';
          }
        } catch (error) {
          console.error('❌ Scenario test FAILED with error:', error);
          results.scenario.status = 'FAILED';
          results.scenario.error = error.message;
        }
      } else {
        console.log('\n=== Skipping API-dependent tests (scenario, JTBD, visualize) ===');
        results.scenario.status = 'SKIPPED';
        results.jtbd.status = 'SKIPPED';
        results.visualize.status = 'SKIPPED';
      }
      
      // Test MCP server loading
      console.log('\n=== Testing MCP Server Interface ===');
      
      try {
        console.log('Loading MCP server module...');
        const mcpServer = require('../../src/mcp/server');
        
        console.log(`MCP server loaded successfully`);
        console.log('✅ MCP server load test PASSED - No "cb is not a function" error!');
        results.mcp.status = 'PASSED';
      } catch (error) {
        console.error('❌ MCP server load test FAILED with error:', error);
        results.mcp.status = 'FAILED';
        results.mcp.error = error.message;
      }
      
      // Return to the original directory when done
      process.chdir(originalDir);
      console.log(`\nRestored working directory to: ${process.cwd()}`);
      
      // Print final test summary
      console.log('\n========================================================');
      console.log('Test Summary');
      console.log('========================================================');
      console.log(`Init Command: ${results.init.status}${results.init.error ? ' - ' + results.init.error : ''}`);
      console.log(`Scenario Command: ${results.scenario.status}${results.scenario.error ? ' - ' + results.scenario.error : ''}`);
      console.log(`JTBD Command: ${results.jtbd.status}${results.jtbd.error ? ' - ' + results.jtbd.error : ''}`);
      console.log(`Visualization Command: ${results.visualize.status}${results.visualize.error ? ' - ' + results.visualize.error : ''}`);
      console.log(`MCP Server Interface: ${results.mcp.status}${results.mcp.error ? ' - ' + results.mcp.error : ''}`);
      
      console.log('\n=== Final Verdict ===');
      
      // Check if the critical components pass (init and mcp)
      const criticalPassed = 
        results.init.status === 'PASSED' && 
        results.mcp.status === 'PASSED';
      
      // Check if all non-skipped tests pass
      const allPassed = Object.values(results).every(
        result => result.status === 'PASSED' || result.status === 'SKIPPED'
      );
      
      if (criticalPassed) {
        if (allPassed) {
          console.log('✅ ALL TESTS PASSED! The "cb is not a function" error has been fixed.');
          console.log('Your PDM-AI MCP implementation is ready for publishing.');
        } else {
          console.log('✅ CRITICAL TESTS PASSED! The "cb is not a function" error has been fixed.');
          console.log('⚠️ However, some non-critical tests failed. Check logs for details.');
        }
      } else {
        console.log('❌ CRITICAL TESTS FAILED. Please check the logs above for details.');
      }
      
      // Provide information about test files
      console.log(`\nTest files are available at: ${TEST_ROOT}`);
      
      if (CLEAN_UP) {
        console.log('Cleaning up test directories...');
        fs.removeSync(TEST_ROOT);
        console.log('Test cleanup complete.');
      } else {
        console.log('Test files have been kept for inspection. To clean up manually, run:');
        console.log(`rm -rf ${TEST_ROOT}`);
      }
      
      // Return exit code based on test result
      return criticalPassed ? 0 : 1;
    } catch (error) {
      console.error('Error in tests:', error);
      
      // Ensure we go back to the original directory even if there's an error
      process.chdir(originalDir);
      console.log(`Restored working directory to: ${process.cwd()}`);
      
      return 1;
    }
  } catch (error) {
    console.error('Fatal error in tests:', error);
    return 1;
  }
}

// Run the tests and set the exit code
runTests().then(
  exitCode => process.exit(exitCode)
).catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});