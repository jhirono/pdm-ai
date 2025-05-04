// src/commands/scenario.js
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const parsers = require('../utils/parsers');
const config = require('../utils/config');

/**
 * Generates a default output filename based on the input file
 * @param {string} sourcePath - Path to input source
 * @returns {string} Default output filename
 */
function generateDefaultOutputFilename(sourcePath) {
  const baseName = path.basename(sourcePath, path.extname(sourcePath));
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  return path.join(process.cwd(), 'output', `${baseName}_scenarios_${timestamp}.json`);
}

/**
 * Add the scenario command to the CLI program
 * @param {Object} program - Commander program instance
 */
function scenarioCommand(program) {
  program
    .command('scenario')
    .description('Extract user scenarios from input text in the format "As a [persona], I want to [action], so that I can [value/goal]"')
    .argument('<source>', 'Source file or directory to parse')
    .option('-o, --output <path>', 'Output file path for JSON results')
    .option('-r, --recursive', 'Recursively parse directories', false)
    .option('-m, --model <model>', 'LLM model to use (defaults to value in .env)', process.env.LLM_MODEL || config.model)
    .option('-l, --language <language>', 'Language to use for extraction (en or ja)', process.env.LANGUAGE || 'en')
    .action(async (source, options) => {
      try {
        console.log(chalk.blue(`Extracting user scenarios from: ${source}`));
        console.log(chalk.blue(`Using model: ${options.model}, language: ${options.language}`));
        
        // Override config with command-line options
        config.model = options.model;
        config.language = options.language;
        
        // Get the appropriate parser
        const parser = parsers.getParser();
        
        const sourcePath = path.resolve(process.cwd(), source);
        
        // Check if source exists
        if (!fs.existsSync(sourcePath)) {
          console.error(chalk.red(`Error: Source path does not exist: ${sourcePath}`));
          process.exit(1);
        }
        
        // Determine if source is a file or directory
        const stats = fs.statSync(sourcePath);
        let results;
        
        if (stats.isFile()) {
          console.log(chalk.green(`Extracting scenarios from file: ${sourcePath}`));
          results = await extractScenariosFromFile(sourcePath, parser);
        } else if (stats.isDirectory()) {
          console.log(chalk.green(`Extracting scenarios from directory: ${sourcePath}`));
          results = await extractScenariosFromDirectory(sourcePath, options.recursive, parser);
        } else {
          console.error(chalk.red(`Error: Source is neither a file nor directory: ${sourcePath}`));
          process.exit(1);
        }
        
        // Determine output path
        const outputPath = options.output || generateDefaultOutputFilename(sourcePath);
        
        // Ensure output directory exists
        fs.ensureDirSync(path.dirname(outputPath));
        
        // Write results to output file
        fs.writeJsonSync(outputPath, results, { spaces: 2 });
        
        console.log(chalk.green(`✓ Results written to: ${outputPath}`));
        console.log(chalk.green(`Extracted ${results.scenarios.length} scenarios from ${results.sources.length} sources`));
        
        // Verify unique IDs
        const scenarioIds = new Set(results.scenarios.map(s => s.id));
        
        if (scenarioIds.size !== results.scenarios.length) {
          console.log(chalk.yellow(`Warning: Found duplicate scenario IDs, even after unique ID generation`));
        }
        
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        console.error(error.stack);
        process.exit(1);
      }
    });
}

/**
 * Extract scenarios from a single file
 * @param {string} filePath - Path to the file
 * @param {Object} parser - Parser to use
 * @returns {Object} Extracted scenarios
 */
async function extractScenariosFromFile(filePath, parser) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileInfo = {
      path: filePath,
      name: path.basename(filePath),
      extension: path.extname(filePath).slice(1)
    };
    
    // Modify parser behavior to focus only on scenarios
    const parseOptions = {
      extractScenarios: true,
      extractJtbds: false,
    };
    
    // Use the parser to extract only scenarios
    const results = await parser.parseScenarios(content, fileInfo, parseOptions);
    
    // Format results with proper metadata
    return {
      source: fileInfo.name,
      timestamp: new Date().toISOString(),
      sources: results.sources || [{
        id: `source-${Date.now().toString(36)}`,
        name: fileInfo.name,
        path: filePath,
        date: new Date().toISOString().split('T')[0],
      }],
      scenarios: results.scenarios || []
    };
  } catch (error) {
    console.error(chalk.yellow(`Warning: Error extracting scenarios from file ${filePath}: ${error.message}`));
    // Return default placeholder results instead of throwing
    const sourceId = `source-${Date.now().toString(36)}`;
    
    return {
      source: path.basename(filePath),
      timestamp: new Date().toISOString(),
      sources: [{
        id: sourceId,
        name: path.basename(filePath),
        path: filePath,
        date: new Date().toISOString().split('T')[0],
      }],
      scenarios: []
    };
  }
}

/**
 * Extract scenarios from a directory of files
 * @param {string} dirPath - Path to the directory
 * @param {boolean} recursive - Whether to parse subdirectories recursively
 * @param {Object} parser - Parser to use
 * @returns {Object} Combined extracted scenarios
 */
async function extractScenariosFromDirectory(dirPath, recursive, parser) {
  try {
    const files = await getFiles(dirPath, recursive);
    const supportedExtensions = ['.txt', '.md'];
    const validFiles = files.filter(file => supportedExtensions.includes(path.extname(file)));
    
    if (validFiles.length === 0) {
      throw new Error(`No supported files found in ${dirPath}`);
    }
    
    console.log(chalk.blue(`Found ${validFiles.length} file(s) to process`));
    
    const results = {
      project: path.basename(dirPath),
      timestamp: new Date().toISOString(),
      sources: [],
      scenarios: []
    };
    
    let hasErrors = false;
    
    // Track all IDs to ensure uniqueness when merging
    const idTracker = {
      scenarios: new Set()
    };
    
    for (const file of validFiles) {
      try {
        console.log(chalk.gray(`Processing ${file}...`));
        const fileResult = await extractScenariosFromFile(file, parser);
        
        // Add sources
        results.sources.push(...fileResult.sources);
        
        // Add scenarios, ensuring unique IDs
        fileResult.scenarios.forEach(scenario => {
          if (!idTracker.scenarios.has(scenario.id)) {
            results.scenarios.push(scenario);
            idTracker.scenarios.add(scenario.id);
          } else {
            // Handle duplicate IDs by generating a new unique ID
            const newId = `${scenario.id}-${Date.now().toString(36)}`;
            console.log(chalk.yellow(`Found duplicate scenario ID: ${scenario.id}, using new ID: ${newId}`));
            
            // Update the ID and add to results
            scenario.id = newId;
            results.scenarios.push(scenario);
            idTracker.scenarios.add(newId);
          }
        });
      } catch (error) {
        console.error(chalk.yellow(`Warning: Failed to process file ${file}: ${error.message}`));
        hasErrors = true;
        // Continue processing other files
      }
    }
    
    if (hasErrors) {
      console.log(chalk.yellow('Warning: Some files had processing errors, but extraction continued.'));
    }
    
    return results;
  } catch (error) {
    throw new Error(`Failed to process directory ${dirPath}: ${error.message}`);
  }
}

/**
 * Get all files in a directory
 * @param {string} dirPath - Path to the directory
 * @param {boolean} recursive - Whether to include files in subdirectories
 * @returns {Array<string>} Array of file paths
 */
async function getFiles(dirPath, recursive) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  
  const files = await Promise.all(entries.map(entry => {
    const fullPath = path.join(dirPath, entry.name);
    
    return entry.isDirectory() && recursive
      ? getFiles(fullPath, recursive)
      : fullPath;
  }));
  
  return files.flat().filter(file => fs.statSync(file).isFile());
}

module.exports = scenarioCommand;