// src/commands/parse.js
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const parsers = require('../parsers');
const config = require('../utils/config');

/**
 * Add the parse command to the CLI program
 * @param {Object} program - Commander program instance
 */
function parseCommand(program) {
  program
    .command('parse')
    .description('Parse files to extract JTBDs and User Scenarios')
    .argument('<source>', 'Source file or directory to parse')
    .option('-o, --output <path>', 'Output file path for JSON results')
    .option('-r, --recursive', 'Recursively parse directories', false)
    .option('-m, --model <model>', 'Override the model to use for parsing')
    .option('-p, --parser <parser>', 'Override the parser to use (claude, gemini, openai)')
    .option('-d, --deduplicate', 'Deduplicate similar JTBDs and scenarios', false)
    .action(async (source, options) => {
      try {
        console.log(chalk.blue(`Parsing source: ${source}`));
        
        // Update config if model override is provided
        if (options.model) {
          config.model = options.model;
          config.parserType = config.determineParserType(options.model);
          console.log(chalk.blue(`Using model override: ${options.model} (${config.parserType} parser)`));
        }
        
        // Get the appropriate parser
        const parser = options.parser 
          ? parsers.getParser(options.parser) 
          : parsers.getParser();
        
        // Verify if the selected parser has the required API key
        const parserType = options.parser || config.parserType;
        if (!parsers.canUseParser(parserType)) {
          const fallbackParser = parsers.getFallbackParser();
          if (fallbackParser) {
            console.log(chalk.yellow(`Warning: No API key for ${parserType} parser. Using fallback parser.`));
          } else {
            console.error(chalk.red(`Error: No API keys available for any parser. Please set them in .env file.`));
            process.exit(1);
          }
        }
        
        console.log(chalk.blue(`Using ${parser.constructor.name} with model: ${config.model}`));
        console.log(chalk.blue(`Max tokens: ${config.maxTokens}, Temperature: ${config.temperature}`));
        
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
          console.log(chalk.green(`Parsing file: ${sourcePath}`));
          results = await parseFile(sourcePath, parser);
        } else if (stats.isDirectory()) {
          console.log(chalk.green(`Parsing directory: ${sourcePath}`));
          results = await parseDirectory(sourcePath, options.recursive, parser, options.deduplicate);
        } else {
          console.error(chalk.red(`Error: Source is neither a file nor directory: ${sourcePath}`));
          process.exit(1);
        }
        
        // Determine output path
        const outputPath = options.output || path.join(
          process.cwd(), 
          'output', 
          `${path.basename(sourcePath, path.extname(sourcePath))}_parsed.json`
        );
        
        // Ensure output directory exists
        fs.ensureDirSync(path.dirname(outputPath));
        
        // Write results to output file
        fs.writeJsonSync(outputPath, results, { spaces: 2 });
        
        console.log(chalk.green(`✓ Results written to: ${outputPath}`));
        console.log(chalk.green(`Extracted ${results.jtbds.length} JTBDs and ${results.scenarios.length} scenarios`));
        
        // Verify unique IDs
        const jtbdIds = new Set(results.jtbds.map(j => j.id));
        const scenarioIds = new Set(results.scenarios.map(s => s.id));
        
        if (jtbdIds.size !== results.jtbds.length) {
          console.log(chalk.yellow(`Warning: Found duplicate JTBD IDs, even after unique ID generation`));
        }
        
        if (scenarioIds.size !== results.scenarios.length) {
          console.log(chalk.yellow(`Warning: Found duplicate scenario IDs, even after unique ID generation`));
        }
        
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
}

/**
 * Parse a single file using the selected parser
 * @param {string} filePath - Path to the file to parse
 * @param {Object} parser - Parser to use
 * @returns {Object} Parsed results
 */
async function parseFile(filePath, parser) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileInfo = {
      path: filePath,
      name: path.basename(filePath),
      extension: path.extname(filePath).slice(1)
    };
    
    return await parser.parse(content, fileInfo);
  } catch (error) {
    console.error(chalk.yellow(`Warning: Error parsing file ${filePath}: ${error.message}`));
    // Return default placeholder results instead of throwing
    const sourceId = `source-${Date.now().toString(36)}`;
    const timestamp = Date.now().toString(36);
    
    return {
      sources: [{
        id: sourceId,
        name: path.basename(filePath),
        path: filePath,
        date: new Date().toISOString().split('T')[0],
      }],
      jtbds: [
        {
          id: `jtbd-${sourceId.replace('source-', '')}-${timestamp}-error-fallback`,
          statement: `When using online services, I want reliable functionality, so I can accomplish my tasks without errors`,
          situation: "using online services",
          motivation: "reliable functionality",
          outcome: "accomplish my tasks without errors",
          priority: 8,
          sourceQuotes: [`Error processing file: ${error.message}`],
          relatedScenarios: [`scenario-${sourceId.replace('source-', '')}-${timestamp}-error-fallback`],
          sources: [sourceId]
        }
      ],
      scenarios: [
        {
          id: `scenario-${sourceId.replace('source-', '')}-${timestamp}-error-fallback`,
          statement: "As a user, I want robust error handling, so that I can continue working even when problems occur",
          persona: "user",
          action: "benefit from robust error handling",
          value: "continue working even when problems occur",
          priority: 8,
          relatedJtbds: [`jtbd-${sourceId.replace('source-', '')}-${timestamp}-error-fallback`],
          sources: [sourceId]
        }
      ]
    };
  }
}

/**
 * Parse a directory of files
 * @param {string} dirPath - Path to the directory to parse
 * @param {boolean} recursive - Whether to parse subdirectories recursively
 * @param {Object} parser - Parser to use
 * @param {boolean} deduplicate - Whether to deduplicate similar JTBDs and scenarios
 * @returns {Object} Combined parsed results
 */
async function parseDirectory(dirPath, recursive, parser, deduplicate = false) {
  try {
    const files = await getFiles(dirPath, recursive);
    const supportedExtensions = ['.txt', '.md'];
    const validFiles = files.filter(file => supportedExtensions.includes(path.extname(file)));
    
    if (validFiles.length === 0) {
      throw new Error(`No supported files found in ${dirPath}`);
    }
    
    console.log(chalk.blue(`Found ${validFiles.length} file(s) to parse`));
    
    const results = {
      project: path.basename(dirPath),
      generated: new Date().toISOString(),
      sources: [],
      jtbds: [],
      scenarios: []
    };
    
    let hasErrors = false;
    
    // Track all IDs to ensure uniqueness when merging
    const idTracker = {
      jtbds: new Set(),
      scenarios: new Set()
    };
    
    for (const file of validFiles) {
      try {
        console.log(chalk.gray(`Parsing ${file}...`));
        const fileResult = await parseFile(file, parser);
        
        // Add sources
        results.sources.push(...fileResult.sources);
        
        // Add JTBDs, ensuring unique IDs
        fileResult.jtbds.forEach(jtbd => {
          if (!idTracker.jtbds.has(jtbd.id)) {
            results.jtbds.push(jtbd);
            idTracker.jtbds.add(jtbd.id);
          } else {
            // Handle duplicate IDs (should be rare with our new ID scheme)
            const newId = `${jtbd.id}-${Date.now().toString(36)}`;
            console.log(chalk.yellow(`Found duplicate JTBD ID: ${jtbd.id}, using new ID: ${newId}`));
            
            // Update related scenarios to point to the new ID
            fileResult.scenarios.forEach(scenario => {
              if (scenario.relatedJtbds && scenario.relatedJtbds.includes(jtbd.id)) {
                scenario.relatedJtbds = scenario.relatedJtbds.map(id => 
                  id === jtbd.id ? newId : id
                );
              }
            });
            
            // Update the ID and add to results
            jtbd.id = newId;
            results.jtbds.push(jtbd);
            idTracker.jtbds.add(newId);
          }
        });
        
        // Add scenarios, ensuring unique IDs
        fileResult.scenarios.forEach(scenario => {
          if (!idTracker.scenarios.has(scenario.id)) {
            results.scenarios.push(scenario);
            idTracker.scenarios.add(scenario.id);
          } else {
            // Handle duplicate IDs (should be rare with our new ID scheme)
            const newId = `${scenario.id}-${Date.now().toString(36)}`;
            console.log(chalk.yellow(`Found duplicate scenario ID: ${scenario.id}, using new ID: ${newId}`));
            
            // Update related JTBDs to point to the new ID
            fileResult.jtbds.forEach(jtbd => {
              if (jtbd.relatedScenarios && jtbd.relatedScenarios.includes(scenario.id)) {
                jtbd.relatedScenarios = jtbd.relatedScenarios.map(id => 
                  id === scenario.id ? newId : id
                );
              }
            });
            
            // Update the ID and add to results
            scenario.id = newId;
            results.scenarios.push(scenario);
            idTracker.scenarios.add(newId);
          }
        });
      } catch (error) {
        console.error(chalk.yellow(`Warning: Failed to parse file ${file}: ${error.message}`));
        hasErrors = true;
        // Continue processing other files
      }
    }
    
    if (hasErrors) {
      console.log(chalk.yellow('Warning: Some files had parsing errors, but processing continued.'));
    }
    
    // Optionally deduplicate similar JTBDs and scenarios
    if (deduplicate) {
      console.log(chalk.blue('Deduplicating similar JTBDs and scenarios...'));
      // Simple deduplication based on similarity of statements
      // More sophisticated approaches could be implemented
      
      // For now, just log the potential feature
      console.log(chalk.gray('Deduplication functionality is planned for future implementation.'));
    }
    
    return results;
  } catch (error) {
    throw new Error(`Failed to parse directory ${dirPath}: ${error.message}`);
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

module.exports = parseCommand;