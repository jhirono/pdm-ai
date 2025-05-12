import { FastMCP } from "fastmcp";
import { z } from "zod";
import { execute as extractScenarios } from "../commands/scenario.js";
import { execute as generateJtbd } from "../commands/jtbd.js";
import { execute as visualize } from "../commands/visualize.js";
import fs from 'fs-extra';

const mcp = new FastMCP({ name: "pdm-ai", version: "0.4.0" });

mcp.addTool({
  name: "extract_scenarios",
  description: "Extract user scenarios",
  parameters: z.object({ 
    source: z.string(), 
    recursive: z.boolean().default(false) 
  }),
  execute: async ({ source, ...opts }) => {
    try {
      const outputFile = await extractScenarios(source, opts);
      const outputData = await fs.readJSON(outputFile);
      
      // Format response according to FastMCP expectations - using "text" type
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(outputData)
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
    input: z.string(), 
    layers: z.number().default(1) 
  }),
  execute: async ({ input, ...opts }) => {
    try {
      // The execute function in jtbd.js returns the actual result object, not a file path
      const result = await generateJtbd(input, opts);
      
      // No need to read from a file since we already have the result object
      // Format response according to FastMCP expectations - using "text" type
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result)
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
    input: z.string(), 
    format: z.enum(["mermaid","csv"]).default("mermaid") 
  }),
  execute: async ({ input, ...opts }) => {
    try {
      const outputFile = await visualize(input, opts);
      
      // Handle different output formats
      let outputData;
      if (opts.format === "csv") {
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
        ]
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