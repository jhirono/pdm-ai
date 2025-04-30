// src/commands/abstract.js
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const abstractionGenerator = require('../utils/consolidation/abstraction-generator');
const jtbdClustering = require('../utils/consolidation/jtbd-clustering');
const config = require('../utils/config');

/**
 * Generate a default output filename based on the input file
 * @param {string} inputFile - Path to input file
 * @param {string} suffix - Suffix to add to the filename
 * @returns {string} Default output filename
 */
function generateDefaultOutputFilename(inputFile, suffix) {
  const inputDir = path.dirname(inputFile);
  const inputBasename = path.basename(inputFile, path.extname(inputFile));
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  
  return path.join(inputDir, `${inputBasename}_${suffix}_${timestamp}.json`);
}

/**
 * Add the abstract command to the CLI program
 * @param {Object} program - Commander program instance
 */
function abstractCommand(program) {
  program
    .command('abstract')
    .description('Generate higher-level abstractions from existing JTBDs or scenarios')
    .argument('<input>', 'Input JSON file with parsed JTBDs/scenarios')
    .option('-o, --output <path>', 'Output file path for results with abstractions (default: new file with timestamp)')
    .option('-t, --type <type>', 'Type of items to abstract (jtbd or scenario)', 'jtbd')
    .option('-s, --source-ids <ids>', 'Comma-separated list of IDs to abstract')
    .option('-m, --model <model>', 'LLM model to use for abstraction', process.env.LLM_MODEL || config.model)
    .option('-v, --verbose', 'Show detailed output during abstraction', false)
    .option('-ct, --cluster-threshold <value>', 'Similarity threshold for clustering (0-1)', '0.7')
    .option('-ml, --max-level <value>', 'Maximum levels of abstraction to generate', '1')
    .action(async (input, options) => {
      try {
        console.log(chalk.blue(`Generating abstractions from ${options.type}s in: ${input}`));
        
        // Validate input file exists
        const inputPath = path.resolve(process.cwd(), input);
        if (!fs.existsSync(inputPath)) {
          console.error(chalk.red(`Error: Input file does not exist: ${inputPath}`));
          process.exit(1);
        }
        
        // Determine output path
        const outputPath = options.output 
          ? path.resolve(process.cwd(), options.output) 
          : generateDefaultOutputFilename(inputPath, 'abstracted');
        
        console.log(chalk.blue(`Output will be saved to: ${outputPath}`));
        
        // Validate type
        if (!['jtbd', 'scenario'].includes(options.type)) {
          console.error(chalk.red(`Error: Type must be 'jtbd' or 'scenario'`));
          process.exit(1);
        }
        
        // Validate cluster threshold
        const clusterThreshold = parseFloat(options.clusterThreshold);
        if (isNaN(clusterThreshold) || clusterThreshold < 0 || clusterThreshold > 1) {
          console.error(chalk.red(`Error: Cluster threshold must be a number between 0 and 1`));
          process.exit(1);
        }
        
        // Validate max level
        const maxLevel = parseInt(options.maxLevel, 10);
        if (isNaN(maxLevel) || maxLevel < 1) {
          console.error(chalk.red(`Error: Max level must be a positive integer`));
          process.exit(1);
        }
        
        // Read input file
        const inputData = await fs.readJson(inputPath);
        
        // Determine items to abstract
        const allItems = options.type === 'jtbd' ? inputData.jtbds : inputData.scenarios;
        
        if (!allItems || allItems.length === 0) {
          console.error(chalk.red(`Error: No ${options.type}s found in input file`));
          process.exit(1);
        }
        
        let itemsToAbstract = [];
        
        // If source IDs are provided, use those specific items
        if (options.sourceIds) {
          const sourceIds = options.sourceIds.split(',').map(id => id.trim());
          
          itemsToAbstract = allItems.filter(item => sourceIds.includes(item.id));
          
          if (itemsToAbstract.length === 0) {
            console.error(chalk.red(`Error: None of the provided source IDs were found in the input file`));
            process.exit(1);
          }
          
          if (itemsToAbstract.length !== sourceIds.length) {
            console.log(chalk.yellow(`Warning: Only ${itemsToAbstract.length} of ${sourceIds.length} provided IDs were found`));
          }
        } else {
          // If no source IDs are provided, use all concrete items without a parent
          itemsToAbstract = allItems.filter(item => !item.isAbstract && !item.parentId);
          
          if (itemsToAbstract.length === 0) {
            console.error(chalk.red(`Error: No concrete ${options.type}s without parents found in input file`));
            process.exit(1);
          }
        }
        
        console.log(chalk.blue(`Found ${itemsToAbstract.length} ${options.type}s to abstract`));

        // Add abstraction metadata if not already present
        if (!inputData.abstractions) {
          inputData.abstractions = [];
        }
        
        // Generate hierarchical abstractions
        const abstractItems = [];
        let currentLevel = 1;
        let currentItems = itemsToAbstract;
        
        while (currentLevel <= maxLevel && currentItems.length > 0) {
          console.log(chalk.blue(`Generating level ${currentLevel} abstractions...`));
          
          // Cluster the items
          console.log(chalk.blue(`Clustering ${currentItems.length} items with threshold ${clusterThreshold}...`));
          const clusters = await jtbdClustering.clusterJTBDs(currentItems, {
            threshold: clusterThreshold,
            method: 'semantic'
          });
          
          // Filter clusters with more than one item if we're at level 1
          const significantClusters = currentLevel === 1 
            ? clusters.filter(cluster => cluster.length > 1)
            : clusters;
          
          console.log(chalk.blue(`Generated ${clusters.length} clusters, ${significantClusters.length} significant`));
          
          if (significantClusters.length === 0) {
            console.log(chalk.yellow(`No significant clusters found at level ${currentLevel}, stopping here`));
            break;
          }
          
          // Generate abstractions for each cluster
          const levelAbstractions = [];
          for (let i = 0; i < significantClusters.length; i++) {
            const cluster = significantClusters[i];
            console.log(chalk.blue(`Generating abstraction for cluster ${i + 1}/${significantClusters.length} (${cluster.length} items)...`));
            
            try {
              const abstractItem = await abstractionGenerator.generateAbstraction(cluster, {
                model: options.model
              });
              
              // Set the level of abstraction
              abstractItem.level = currentLevel;
              
              levelAbstractions.push(abstractItem);
              abstractItems.push(abstractItem);
              
              // Update parent IDs for items in the cluster
              cluster.forEach(item => {
                const index = allItems.findIndex(i => i.id === item.id);
                if (index !== -1) {
                  allItems[index].parentId = abstractItem.id;
                }
              });
              
              // Add to abstractions metadata
              inputData.abstractions.push({
                id: abstractItem.id,
                type: options.type,
                timestamp: new Date().toISOString(),
                model: options.model,
                level: currentLevel,
                childCount: cluster.length
              });
              
              if (options.verbose) {
                console.log(`Generated level ${currentLevel} abstract ${options.type}: ${abstractItem.statement.substring(0, 100)}...`);
                console.log(`Child count: ${abstractItem.childIds.length}`);
              }
            } catch (error) {
              console.error(chalk.red(`Error generating abstraction for cluster ${i + 1}: ${error.message}`));
            }
          }
          
          // Prepare for next level of abstraction if there are multiple abstractions at this level
          if (currentLevel < maxLevel && levelAbstractions.length > 1) {
            currentItems = levelAbstractions;
            currentLevel++;
          } else {
            break;
          }
        }
        
        // Update the data in the input/output file
        if (options.type === 'jtbd') {
          // Add all new abstract JTBDs
          inputData.jtbds = [...allItems, ...abstractItems.filter(item => !allItems.some(i => i.id === item.id))];
        } else {
          // Add all new abstract scenarios
          inputData.scenarios = [...allItems, ...abstractItems.filter(item => !allItems.some(i => i.id === item.id))];
        }
        
        // Write to output file
        await fs.ensureDir(path.dirname(outputPath));
        await fs.writeJson(outputPath, inputData, { spaces: 2 });
        
        // Print summary
        console.log(chalk.green(`✓ Abstraction complete!`));
        
        // Group abstractions by level
        const abstractionsByLevel = {};
        abstractItems.forEach(item => {
          if (!abstractionsByLevel[item.level]) {
            abstractionsByLevel[item.level] = [];
          }
          abstractionsByLevel[item.level].push(item);
        });
        
        // Print summary by level
        Object.keys(abstractionsByLevel).sort().forEach(level => {
          const items = abstractionsByLevel[level];
          console.log(chalk.green(`  - Level ${level}: ${items.length} abstract ${options.type}s`));
        });
        
        console.log(chalk.green(`  - Results written to: ${outputPath}`));
        
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
}

module.exports = abstractCommand;