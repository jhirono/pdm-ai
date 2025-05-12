
# FastMCP Implementation Plan for **PDM‑AI** CLI  
*(updated 2025-05-09)*

## Goal

Package **pdm‑ai** so that an MCP‑capable host can launch it with **npx** using the JSON snippet below:

```json
"pdm-ai": {
  "command": "npx",
  "args": ["-y", "--package=pdm-ai", "pdm", "mcp"],
  "env": {
    "LLM_API_KEY": "...",
    "LLM_MODEL": "gpt-4o",
    "LLM_MAX_TOKENS": "4000",
    "LLM_TEMPERATURE": "0.7",
    "LANGUAGE": "en"
  }
}
```

That means:

* **`pdm`** is the CLI entry exposed in *package.json → bin*  
* **`mcp`** is a **sub‑command** that boots the FastMCP server **inside the same process**  
* All env‑vars must flow through to your business logic & tool handlers  

---

## 1  Project layout

```
pdm-ai/
├─ src/
│  ├─ cli/                # legacy command files
│  │   ├─ init.js
│  │   ├─ scenario.js
│  │   ├─ jtbd.js
│  │   └─ visualize.js
│  ├─ mcp/
│  │   └─ server.js       # FastMCP boot‑strap
│  └─ index.js            # top‑level dispatcher
├─ package.json
└─ ...
```

---

## 2  Expose **pdm** binary

```json5
// package.json
"bin": {
  "pdm": "./src/index.js"
},
"type": "module",
"exports": {
  ".": "./src/index.js"
}
```

---

## 3  Sub‑command dispatcher (`src/index.js`)

```js
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
    const mod = await import(`./cli/${sub}.js`);
    await mod.execute(...rest);
    break;
  }

  default:
    console.error(`Unknown sub‑command: ${sub}`);
    process.exit(1);
}
```

*Mark executable:* `chmod +x src/index.js`

---

## 4  FastMCP server (`src/mcp/server.js`)

```js
import { FastMCP } from "fastmcp";
import { z } from "zod";
import { execute as extractScenarios } from "../cli/scenario.js";
import { execute as generateJtbd }     from "../cli/jtbd.js";
import { execute as visualize }        from "../cli/visualize.js";

const mcp = new FastMCP({ name: "pdm-ai", version: "0.4.0" });

mcp.addTool({
  name: "extract_scenarios",
  description: "Extract user scenarios",
  parameters: z.object({ source: z.string(), recursive: z.boolean().default(false) }),
  execute: async ({ source, ...opts }) => extractScenarios(source, opts)
});

mcp.addTool({
  name: "generate_jtbd",
  description: "Generate JTBD statements",
  parameters: z.object({ input: z.string(), layers: z.number().default(1) }),
  execute: async ({ input, ...opts }) => generateJtbd(input, opts)
});

mcp.addTool({
  name: "visualize",
  description: "Visualise JTBD or scenarios",
  parameters: z.object({ input: z.string(), format: z.enum(["mermaid","csv"]).default("mermaid") }),
  execute: async ({ input, ...opts }) => visualize(input, opts)
});

export const start = () => mcp.start({ transportType: "stdio" });
```

---

## 5  Reference: **TaskMaster‑AI** FastMCP Server

A concise example inspired by the TaskMaster‑AI repo (<https://github.com/eyaltoledano/claude-task-master/tree/main/mcp-server/src>) showing **progress events** and **multiple transports**:

```ts
// src/mcp/taskmaster-server.ts
import { FastMCP } from "fastmcp";
import { z } from "zod";
import { createTodo, updateTodoStatus } from "../core/taskmaster.js";

const mcp = new FastMCP({
  name: "taskmaster-ai",
  version: "1.0.0",
  transports: ["stdio", "sse"]
});

mcp.addTool({
  name: "taskmaster_create_todo",
  description: "Save a todo with category & due date",
  parameters: z.object({
    content:  z.string(),
    category: z.string().default("general"),
    due:      z.coerce.date().optional()
  }),
  execute: async (args, ctx) => {
    ctx.progress(10, "starting");
    const todo = await createTodo(args);
    ctx.progress(100, "done");
    return todo;
  }
});

mcp.addTool({
  name: "taskmaster_mark_done",
  description: "Mark the todo completed",
  parameters: z.object({ id: z.string() }),
  execute: async ({ id }) => updateTodoStatus(id, "done")
});

export const start = () => mcp.start({ transportType: "stdio" });
```

> **Why it’s useful**  
> * Demonstrates `ctx.progress()` for fine‑grained feedback.  
> * Shows how to enable both `stdio` and `sse` transports.  
> * Keeps business logic in `core/`, making MCP layer ultra‑thin.

---

## 6  Publishing checklist

```bash
npm i fastmcp zod
npm publish --access public
npx -y --package=pdm-ai pdm mcp < /dev/null   # handshake smoke‑test
```

---

## 7  Env var access inside tools

```js
const apiKey = process.env.LLM_API_KEY;
```

---

## 8  Testing with Cursor / Claude Desktop

* **Command:** `npx`  
* **Args:** `-y --package=pdm-ai pdm mcp`  
* **Directory:** project root (optional)  

Tools should appear after handshake.

---

## 9  Timeline (solo dev)

| Day | Task |
|-----|------|
| **1** | Add dispatcher, bootstrap FastMCP |
| **2** | Port tools with Zod schemas |
| **3** | Add progress events (borrow TaskMaster style) |
| **4** | Publish beta & test with npx |
| **5** | Docs, badges, feedback |
