import { FastMCP } from "fastmcp";
import { z } from "zod";
import { execute as initProject } from "../commands/init.js";
import { execute as extractScenarios } from "../commands/scenario.js";
import { execute as generateJtbd } from "../commands/jtbd.js";
import { execute as visualize } from "../commands/visualize.js";
import fs from 'fs-extra';
import path from 'path';

const mcp = new FastMCP({ name: "pdm-ai", version: "0.4.0" });

mcp.addTool({
  name: "init_project",
  description: "Initialize a PDM project with proper directory structure",
  parameters: z.object({ 
    name: z.string().optional(),
    directory: z.string().optional()
  }),
  execute: async ({ name, directory }) => {
    try {
      const result = await initProject(name || 'PDM Project', directory || process.cwd());
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: result.success,
              projectName: result.projectName,
              projectDir: result.projectDir,
              message: result.message
            })
          }
        ]
      };
    } catch (error) {
      console.error("Error in init_project:", error);
      throw error;
    }
  }
});

mcp.addTool({
  name: "extract_scenarios",
  description: "Extract user scenarios",
  parameters: z.object({ 
    source: z.string(), 
    recursive: z.boolean().default(false),
    output: z.string().optional()
  }),
  execute: async ({ source, output, ...opts }) => {
    try {
      // Ensure we're in a PDM project or create default structure if needed
      const currentDir = process.cwd();
      const pdmDir = path.join(currentDir, '.pdm');
      
      if (!fs.existsSync(pdmDir)) {
        console.log(".pdm directory not found, creating default project structure...");
        await initProject('PDM Project', currentDir);
      }
      
      // If output is not specified, use default location in .pdm directory
      const outputOptions = { ...opts };
      if (output) {
        outputOptions.output = output;
      } else {
        const outputDir = path.join(currentDir, '.pdm', 'outputs', 'scenarios');
        fs.ensureDirSync(outputDir);
        const filename = path.basename(source, path.extname(source)) + '-scenarios.json';
        outputOptions.output = path.join(outputDir, filename);
      }
      
      const outputFile = await extractScenarios(source, outputOptions);
      const outputData = await fs.readJSON(outputFile);
      
      // Format response according to FastMCP expectations - using "text" type
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              ...outputData,
              outputPath: outputFile, // Include the output path for next steps
              success: true
            })
          }
        ]
      };
    } catch (error) {
      console.error("Error in extract_scenarios:", error);
      throw error;
    }
  }
});

mcp.addTool({
  name: "generate_jtbd",
  description: "Generate JTBD statements",
  parameters: z.object({ 
    source: z.string(), 
    layers: z.number().default(1),
    output: z.string().optional()
  }),
  execute: async ({ source, output, ...opts }) => {
    try {
      // Ensure we're in a PDM project
      const currentDir = process.cwd();
      const pdmDir = path.join(currentDir, '.pdm');
      
      if (!fs.existsSync(pdmDir)) {
        console.log(".pdm directory not found, creating default project structure...");
        await initProject('PDM Project', currentDir);
      }
      
      // If output is not specified, use default location in .pdm directory
      const outputOptions = { ...opts };
      if (output) {
        outputOptions.output = output;
      } else {
        const outputDir = path.join(currentDir, '.pdm', 'outputs', 'jtbds');
        fs.ensureDirSync(outputDir);
        const filename = path.basename(source, path.extname(source)) + '-jtbds.json';
        outputOptions.output = path.join(outputDir, filename);
      }
      
      // The execute function in jtbd.js returns the actual result object
      const result = await generateJtbd(source, outputOptions);
      
      // Format response according to FastMCP expectations
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              ...result,
              outputPath: outputOptions.output, // Include the output path for next steps
              success: true
            })
          }
        ]
      };
    } catch (error) {
      console.error("Error in generate_jtbd:", error);
      throw error;
    }
  }
});

mcp.addTool({
  name: "visualize",
  description: "Visualise JTBD or scenarios",
  parameters: z.object({ 
    source: z.string(), 
    format: z.enum(["mermaid","csv"]).default("mermaid"),
    output: z.string().optional()
  }),
  execute: async ({ source, output, ...opts }) => {
    try {
      // Ensure we're in a PDM project
      const currentDir = process.cwd();
      const pdmDir = path.join(currentDir, '.pdm');
      
      if (!fs.existsSync(pdmDir)) {
        console.log(".pdm directory not found, creating default project structure...");
        await initProject('PDM Project', currentDir);
      }
      
      // If output is not specified, use default location in .pdm directory
      const visualOptions = { ...opts };
      if (output) {
        visualOptions.output = output;
      } else {
        const outputDir = path.join(currentDir, '.pdm', 'outputs', 'visualizations');
        fs.ensureDirSync(outputDir);
        const format = opts.format || 'mermaid';
        const extension = format === 'csv' ? '.csv' : '.md';
        const filename = path.basename(source, path.extname(source)) + '-visualization' + extension;
        visualOptions.output = path.join(outputDir, filename);
      }
      
      const outputFile = await visualize(source, visualOptions);
      
      // Handle different output formats
      let outputData;
      if (visualOptions.format === "csv") {
        outputData = await fs.readFile(outputFile, 'utf8');
      } else {
        // For mermaid or other formats, try to read as JSON first
        try {
          outputData = await fs.readJSON(outputFile);
        } catch (err) {
          // If not JSON, read as text
          outputData = await fs.readFile(outputFile, 'utf8');
        }
      }
      
      // Format response according to FastMCP expectations - using "text" type
      return {
        content: [
          {
            type: "text",
            text: typeof outputData === 'string' ? outputData : JSON.stringify(outputData)
          }
        ],
        outputPath: outputFile,
        success: true
      };
    } catch (error) {
      console.error("Error in visualize:", error);
      throw error;
    }
  }
});

// Add improved error handling for timeouts
const originalStart = mcp.start.bind(mcp);
mcp.start = (options) => {
  // Set a higher timeout for the server
  const timeoutMs = parseInt(process.env.MCP_TIMEOUT || '120000', 10);
  
  // Apply timeout to each tool if tools are available
  if (mcp.tools && typeof mcp.tools === 'object') {
    for (const tool of Object.values(mcp.tools)) {
      const originalExecute = tool.execute;
      tool.execute = async (...args) => {
        return Promise.race([
          originalExecute(...args),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
          )
        ]);
      };
    }
  }
  
  return originalStart(options);
};

export const start = () => mcp.start({ transportType: "stdio" });