#!/usr/bin/env node
import { start as startMcp } from "./mcp/server.js";

const [sub = "help", ...rest] = process.argv.slice(2);

switch (sub) {
  case "mcp":
    startMcp();        // FastMCP server – blocks
    break;

  case "init":
  case "scenario":
  case "jtbd":
  case "visualize": {
    const mod = await import(`./commands/${sub}.js`);
    await mod.execute(...rest);
    break;
  }

  default:
    console.error(`Unknown sub-command: ${sub}`);
    console.error(`Available commands: init, scenario, jtbd, visualize, mcp`);
    process.exit(1);
}