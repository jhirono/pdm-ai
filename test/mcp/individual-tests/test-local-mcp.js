#!/usr/bin/env node

/**
 * Simple test script for local PDM-AI MCP
 * This script tests the MCP server implementation directly without using npx
 */
const path = require('path');
const { McpClient } = require('@modelcontextprotocol/sdk/client/mcp.js');
const { ClientTransportCallbacks } = require('@modelcontextprotocol/sdk/client/base.js');
const { spawn } = require('child_process');

// Path to Japanese test file (adjust if necessary)
const JAPANESE_TEST_FILE = path.resolve(__dirname, '../inputs/japanese.txt');

// Path to the local MCP server
const MCP_SERVER_PATH = path.resolve(__dirname, '../../src/mcp/index.js');

// Create a simple client transport that uses spawn to communicate with the server process
class SpawnProcessTransport {
  constructor(serverPath) {
    this._serverPath = serverPath;
    this._callbacks = null;
    this._serverProcess = null;
  }

  connect(callbacks) {
    this._callbacks = callbacks;
    
    console.log(`Starting MCP server from: ${this._serverPath}`);
    this._serverProcess = spawn('node', [this._serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env
    });

    this._serverProcess.stdout.on('data', (data) => {
      const message = data.toString();
      console.log(`Server stdout: ${message}`);
      if (this._callbacks) {
        this._callbacks.onMessage(message);
      }
    });

    this._serverProcess.stderr.on('data', (data) => {
      console.error(`Server stderr: ${data.toString()}`);
    });

    this._serverProcess.on('error', (error) => {
      console.error(`Server process error: ${error.message}`);
      if (this._callbacks) {
        this._callbacks.onError(error);
      }
    });

    this._serverProcess.on('close', (code) => {
      console.log(`Server process exited with code ${code}`);
      if (this._callbacks && code !== 0) {
        this._callbacks.onError(new Error(`Server exited with code ${code}`));
      }
    });
  }

  send(message) {
    if (this._serverProcess && this._serverProcess.stdin.writable) {
      console.log(`Sending to server: ${message}`);
      this._serverProcess.stdin.write(message + '\n');
    } else {
      console.error('Cannot send message - server process not available');
    }
  }

  disconnect() {
    if (this._serverProcess) {
      this._serverProcess.stdin.end();
      this._serverProcess = null;
    }
  }
}

// Main function to run the test
async function runTest() {
  try {
    console.log('Starting PDM-AI MCP test');
    console.log(`Testing with Japanese file: ${JAPANESE_TEST_FILE}`);
    
    // Create transport using the local server
    const transport = new SpawnProcessTransport(MCP_SERVER_PATH);
    
    // Create the client
    const client = new McpClient();
    
    // Connect to the MCP server
    console.log('Connecting to MCP server...');
    await client.connect(transport);
    console.log('Connected to server!');
    
    // Get server information
    const serverInfo = await client.getServerInfo();
    console.log('Server info:', serverInfo);
    
    // Test project initialization
    console.log('\n--- Testing Project Initialization ---');
    try {
      const initResult = await client.callTool('initProject', {
        name: 'MCP-Test-Project'
      });
      console.log('Init result:', JSON.stringify(initResult, null, 2));
    } catch (error) {
      console.error('Project initialization failed:', error);
    }
    
    // Test scenario parsing with Japanese.txt
    console.log('\n--- Testing Japanese Scenario Parsing ---');
    try {
      const scenarioResult = await client.callTool('parseScenarios', {
        source: JAPANESE_TEST_FILE,
        recursive: false,
        model: 'gpt-4o'
      });
      console.log('Scenario parsing result:', JSON.stringify(scenarioResult, null, 2));
      
      if (scenarioResult.success && scenarioResult.scenarios.length > 0) {
        // Test JTBD generation
        console.log('\n--- Testing JTBD Generation ---');
        try {
          const jtbdResult = await client.callTool('generateJtbds', {
            source: scenarioResult.outputPath,
            model: 'gpt-4o'
          });
          console.log('JTBD result:', JSON.stringify(jtbdResult, null, 2));
          
          // Test visualization
          if (jtbdResult.success && jtbdResult.jtbds.length > 0) {
            console.log('\n--- Testing Visualization ---');
            try {
              const visualResult = await client.callTool('visualize', {
                source: jtbdResult.outputPath,
                format: 'mermaid'
              });
              console.log('Visualization result:', JSON.stringify(visualResult, null, 2));
            } catch (error) {
              console.error('Visualization failed:', error);
            }
          }
        } catch (error) {
          console.error('JTBD generation failed:', error);
        }
      }
    } catch (error) {
      console.error('Scenario parsing failed:', error);
    }
    
    // Disconnect from the server
    console.log('\n--- Test Completed ---');
    client.disconnect();
    console.log('Disconnected from server.');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the test
runTest().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});