/**
 * Test script for CSV export functionality
 * Runs the visualize command with CSV format
 */

const path = require('path');
const fs = require('fs-extra');
const visualize = require('../src/commands/visualize');

async function runTest() {
  console.log('Testing CSV export functionality...');
  
  // Path to test data
  const inputFile = path.join(__dirname, 'test-data', 'test_viz_data.json');
  
  // Create output directory
  const outputDir = path.join(__dirname, 'output');
  await fs.ensureDir(outputDir);
  const outputFile = path.join(outputDir, 'test_csv_export.csv');
  
  // Clean up any existing output files
  const outputFilePattern = outputFile.replace('.csv', '');
  const existingFiles = await fs.readdir(outputDir);
  for (const file of existingFiles) {
    if (file.startsWith(path.basename(outputFilePattern)) && file.endsWith('.csv')) {
      await fs.unlink(path.join(outputDir, file));
    }
  }
  
  // Run the visualize command with CSV format
  try {
    console.log(`Input file: ${inputFile}`);
    console.log(`Output file: ${outputFile}`);
    
    // This simulates running: pdm visualize test/test-data/test_viz_data.json -f csv -o test/output/test_csv_export.csv
    await visualize.execute(inputFile, {
      format: 'csv',
      view: 'jtbd',
      output: outputFile,
      verbose: true,
      maxNodes: '100'
    });
    
    // Check for output files
    const files = await fs.readdir(outputDir);
    const csvFiles = files.filter(file => file.startsWith(path.basename(outputFilePattern)) && file.endsWith('.csv'));
    
    console.log('\nGenerated CSV files:');
    for (const file of csvFiles) {
      console.log(`- ${file}`);
      
      // Show a preview of the file contents
      const filePath = path.join(outputDir, file);
      const content = await fs.readFile(filePath, 'utf8');
      console.log('\nFile contents preview:');
      console.log(content.split('\n').slice(0, 10).join('\n'));
      console.log('...\n');
    }
    
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the test
runTest();