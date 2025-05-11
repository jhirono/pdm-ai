/**
 * CSV generator for PDM-AI
 * Handles the generation of CSV files for JTBDs and scenarios for Figma and Miro
 */

import fs from 'fs-extra';
import path from 'path';

/**
 * Escape text for CSV format
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeCSV(text) {
  if (!text) return '';
  // Escape quotes with double quotes and wrap in quotes if contains comma, newline or quote
  const needsQuotes = text.includes(',') || text.includes('\n') || text.includes('"');
  text = text.replace(/"/g, '""');
  return needsQuotes ? `"${text}"` : text;
}

/**
 * Generate CSVs for JTBDs and scenarios
 * @param {Object} data - Input data with JTBDs and scenarios
 * @param {Object} options - Visualization options
 * @param {string} outputPath - Base output path
 * @returns {Object} Result object with file paths and stats
 */
export async function generateCSVFiles(data, options, outputPath) {
  // Initialize stats for tracking
  const stats = {
    fileCount: 0,
    jtbdCount: 0,
    scenarioCount: 0
  };

  const { jtbds, scenarios } = data;
  
  // Ensure we have valid JTBDs to process
  if (!jtbds || !Array.isArray(jtbds) || jtbds.length === 0) {
    throw new Error('No valid JTBDs found in input data');
  }
  
  // Create maps for looking up JTBDs and scenarios
  const jtbdMap = {};
  const jtbdToScenariosMap = new Map();
  
  // Separate JTBDs by layer
  const layer1Jtbds = [];
  const layer2Jtbds = [];
  
  jtbds.forEach(jtbd => {
    jtbdMap[jtbd.id] = jtbd;
    
    if (jtbd.level === 2) {
      layer2Jtbds.push(jtbd);
    } else {
      // Default to layer 1 if level not specified
      layer1Jtbds.push(jtbd);
    }
  });
  
  // Map scenarios to JTBDs - first from JTBD to scenarios
  jtbds.forEach(jtbd => {
    if (!jtbdToScenariosMap.has(jtbd.id)) {
      jtbdToScenariosMap.set(jtbd.id, new Set());
    }
    
    // Check for scenario references in the JTBD
    const scenarioIds = jtbd.scenarioIds || jtbd.relatedScenarios || [];
    if (Array.isArray(scenarioIds)) {
      scenarioIds.forEach(id => jtbdToScenariosMap.get(jtbd.id).add(id));
    }
  });
  
  // Then map from scenarios to JTBDs
  if (scenarios && Array.isArray(scenarios)) {
    scenarios.forEach(scenario => {
      const relatedJtbdIds = scenario.relatedJtbds || [];
      if (Array.isArray(relatedJtbdIds)) {
        relatedJtbdIds.forEach(jtbdId => {
          if (jtbdMap[jtbdId]) {
            if (!jtbdToScenariosMap.has(jtbdId)) {
              jtbdToScenariosMap.set(jtbdId, new Set());
            }
            jtbdToScenariosMap.get(jtbdId).add(scenario.id);
          }
        });
      }
    });
  }
  
  // Create scenario map for quick lookups
  const scenarioMap = {};
  if (scenarios && Array.isArray(scenarios)) {
    scenarios.forEach(scenario => {
      if (scenario && scenario.id) {
        scenarioMap[scenario.id] = scenario;
      }
    });
  }
  
  // Build parent-child relationships between JTBDs
  const childToParentMap = new Map();
  const parentToChildrenMap = new Map();
  
  // Process layer 2 JTBDs (parent JTBDs)
  layer2Jtbds.forEach(parentJtbd => {
    // Look for childIds in parent JTBD
    const childIds = parentJtbd.childIds || parentJtbd.jtbdIds || [];
    if (Array.isArray(childIds) && childIds.length > 0) {
      childIds.forEach(childId => {
        childToParentMap.set(childId, parentJtbd.id);
        
        if (!parentToChildrenMap.has(parentJtbd.id)) {
          parentToChildrenMap.set(parentJtbd.id, new Set());
        }
        parentToChildrenMap.get(parentJtbd.id).add(childId);
      });
    }
  });
  
  // Process layer 1 JTBDs for parent references
  layer1Jtbds.forEach(childJtbd => {
    if (childJtbd.parentId) {
      childToParentMap.set(childJtbd.id, childJtbd.parentId);
      
      if (!parentToChildrenMap.has(childJtbd.parentId)) {
        parentToChildrenMap.set(childJtbd.parentId, new Set());
      }
      parentToChildrenMap.get(childJtbd.parentId).add(childJtbd.id);
    }
  });
  
  // File paths to return
  const files = [];
  
  // If we have layer 2 JTBDs, create an overview CSV for top-level JTBDs
  if (layer2Jtbds.length > 0) {
    const overviewFileName = path.join(path.dirname(outputPath), `${path.basename(outputPath, '.csv')}_overview.csv`);
    
    // Create content only with JTBD statements, one per row
    let overviewContent = 'jtbd\n';
    
    layer2Jtbds.forEach(jtbd => {
      overviewContent += `${escapeCSV(jtbd.statement || '')}\n`;
      stats.jtbdCount++;
    });
    
    await fs.writeFile(overviewFileName, overviewContent);
    stats.fileCount++;
    files.push({
      path: overviewFileName,
      type: 'overview',
      jtbdCount: layer2Jtbds.length
    });
  }
  
  // For each JTBD in layer 1, create a CSV with the JTBD and its scenarios in tabular format
  for (const jtbd of layer1Jtbds) {
    // Generate a file for each layer 1 JTBD
    const fileName = path.join(
      path.dirname(outputPath),
      `${path.basename(outputPath, '.csv')}_${jtbd.id}.csv`
    );
    
    // Collect all scenarios for this JTBD and its children
    const allScenarios = [];
    
    // Add scenarios for this JTBD
    if (jtbdToScenariosMap.has(jtbd.id)) {
      const scenarioIds = Array.from(jtbdToScenariosMap.get(jtbd.id));
      for (const scenarioId of scenarioIds) {
        const scenario = scenarioMap[scenarioId];
        if (scenario) {
          allScenarios.push(scenario);
        }
      }
    }
    
    // Add scenarios for any child JTBDs
    if (parentToChildrenMap.has(jtbd.id)) {
      const childIds = parentToChildrenMap.get(jtbd.id);
      for (const childId of childIds) {
        if (jtbdToScenariosMap.has(childId)) {
          const scenarioIds = Array.from(jtbdToScenariosMap.get(childId));
          for (const scenarioId of scenarioIds) {
            const scenario = scenarioMap[scenarioId];
            if (scenario) {
              allScenarios.push(scenario);
            }
          }
        }
      }
    }
    
    // Group scenarios by persona
    const personaGroups = {};
    allScenarios.forEach(scenario => {
      const persona = scenario.persona || 'Unknown';
      if (!personaGroups[persona]) {
        personaGroups[persona] = [];
      }
      personaGroups[persona].push(scenario);
    });
    
    // Create tabular CSV structure
    // First, get all unique personas
    const personas = Object.keys(personaGroups);
    
    // Create the header row with "jtbd" and all persona names
    let fileContent = `jtbd${personas.length > 0 ? ',' : ''}${personas.join(',')}\n`;
    
    // Fixed: Create a structured tabular format with proper row alignment
    // Find the maximum number of scenarios across all personas
    let maxScenarios = 0;
    personas.forEach(persona => {
      const count = personaGroups[persona].length;
      if (count > maxScenarios) {
        maxScenarios = count;
      }
    });
    
    // Create rows with proper alignment
    let rows = [];
    
    // First row contains the JTBD statement and the first scenario for each persona
    let firstRow = [escapeCSV(jtbd.statement || '')];
    
    // Add the first scenario for each persona (or empty if none exists)
    personas.forEach(persona => {
      const scenariosForPersona = personaGroups[persona];
      if (scenariosForPersona && scenariosForPersona.length > 0) {
        firstRow.push(escapeCSV(scenariosForPersona[0].statement || ''));
        stats.scenarioCount++;
      } else {
        firstRow.push('');
      }
    });
    rows.push(firstRow.join(','));
    
    // Create subsequent rows with empty first cell (for JTBD) and scenarios aligned by persona column
    for (let i = 1; i < maxScenarios; i++) {
      let row = [''];  // Empty cell for JTBD column
      
      personas.forEach(persona => {
        const scenariosForPersona = personaGroups[persona];
        if (scenariosForPersona && i < scenariosForPersona.length) {
          row.push(escapeCSV(scenariosForPersona[i].statement || ''));
          stats.scenarioCount++;
        } else {
          row.push('');  // Empty cell if this persona doesn't have a scenario at this position
        }
      });
      
      rows.push(row.join(','));
    }
    
    // Join all rows with newlines
    fileContent += rows.join('\n');
    
    await fs.writeFile(fileName, fileContent);
    stats.fileCount++;
    files.push({
      path: fileName,
      type: 'jtbd_with_scenarios',
      jtbdId: jtbd.id
    });
  }
  
  // Create a result object
  const result = {
    files,
    stats
  };
  
  return result;
}