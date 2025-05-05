// test/jtbd-clustering/test-adaptive-clustering.js
const jtbdCommand = require('../../src/commands/jtbd');
const fs = require('fs-extra');
const path = require('path');

/**
 * Test script to verify adaptive clustering for JTBD generation works properly
 */
async function testAdaptiveClustering() {
  try {
    console.log('Starting test for adaptive clustering in JTBD generation');
    
    // Path to example input scenarios file
    const scenariosPath = path.resolve(__dirname, '../output/test_scenarios.json');
    
    // Check if test file exists, otherwise use real data
    let inputPath;
    if (fs.existsSync(scenariosPath)) {
      console.log(`Using test scenarios from ${scenariosPath}`);
      inputPath = scenariosPath;
    } else {
      // Look for real scenarios in outputs directory
      const outputsDir = path.resolve(process.cwd(), 'outputs', 'scenarios');
      const files = fs.readdirSync(outputsDir);
      
      if (files.length === 0) {
        throw new Error('No scenario files found for testing');
      }
      
      // Use the most recent scenarios file
      const mostRecentFile = files.sort().reverse()[0];
      inputPath = path.join(outputsDir, mostRecentFile);
      console.log(`Using real scenarios from ${inputPath}`);
    }
    
    // Create a temporary output path for the test
    const outputPath = path.resolve(__dirname, '../output/test_jtbds.json');
    
    // Test options for the JTBD command
    const testOptions = {
      output: outputPath,
      model: 'gpt-4o', // Using the default model to avoid API key issues
      layers: 2,       // Enable hierarchical clustering
      verbose: true,   // Enable detailed output
      // Not specifying thresholds to test adaptive threshold finding
    };
    
    console.log('Executing JTBD command with adaptive clustering...');
    const result = await jtbdCommand.execute(inputPath, testOptions);
    
    console.log('\nTest results:');
    console.log(`Total JTBDs generated: ${result.jtbds.length}`);
    
    if (result.hierarchyInfo) {
      console.log(`Layer 1 JTBDs: ${result.hierarchyInfo.layer1Count}`);
      console.log(`Layer 2 JTBDs: ${result.hierarchyInfo.layer2Count}`);
      
      // Check if hierarchical structure is correct
      const hasValidHierarchy = result.jtbds.some(jtbd => jtbd.level === 2 && 
        jtbd.childIds && jtbd.childIds.length > 0);
      
      console.log(`Has valid hierarchical structure: ${hasValidHierarchy ? 'Yes' : 'No'}`);
    }
    
    console.log(`\nOutput saved to: ${outputPath}`);
    console.log('Test completed successfully!');
    
  } catch (error) {
    console.error(`Test failed with error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testAdaptiveClustering();