#!/usr/bin/env node

/**
 * Simple test script for local PDM-AI MCP using direct command execution
 */
const path = require('path');
const { spawn } = require('child_process');

// Path to Japanese test file
const JAPANESE_TEST_FILE = path.resolve(__dirname, '../inputs/japanese.txt');

// Path to the local MCP server script
const MCP_SERVER_SCRIPT = path.resolve(__dirname, '../../src/mcp/index.js');

// Function to run an MCP command and capture output
function runMcpCommand(command, params) {
  return new Promise((resolve, reject) => {
    console.log(`Running MCP command: ${command}`);
    console.log(`Params: ${JSON.stringify(params, null, 2)}`);
    
    // Format the JSON payload for MCP protocol
    const payload = {
      jsonrpc: "2.0",
      id: 1,
      method: "callTool",
      params: {
        name: command,
        parameters: params
      }
    };
    
    const jsonPayload = JSON.stringify(payload);
    
    const child = spawn('node', [MCP_SERVER_SCRIPT], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {...process.env}
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      console.log(`Server output: ${chunk.trim()}`);
    });
    
    child.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      console.error(`Server error: ${chunk.trim()}`);
    });
    
    child.on('close', (code) => {
      console.log(`Command exited with code: ${code}`);
      
      try {
        // Try to parse JSON responses from stdout
        const jsonLines = stdout.split('\n').filter(line => {
          try {
            return line.trim() && JSON.parse(line.trim());
          } catch {
            return false;
          }
        });
        
        // Find the response with our request ID
        for (const line of jsonLines) {
          try {
            const json = JSON.parse(line);
            if (json.id === 1) {
              if (json.error) {
                reject(new Error(`MCP error: ${json.error.message || JSON.stringify(json.error)}`));
              } else if (json.result) {
                resolve(json.result);
                return;
              }
            }
          } catch (e) {
            // Skip lines that don't parse
          }
        }
        
        reject(new Error('No valid response found in output'));
      } catch (error) {
        console.error('Error processing server response:', error);
        reject(error);
      }
    });
    
    // Send the command to the server
    child.stdin.write(jsonPayload + '\n');
    child.stdin.end();
  });
}

// Main function to test the MCP
async function testMcp() {
  try {
    console.log('Starting PDM-AI MCP test');
    console.log(`Testing with Japanese file: ${JAPANESE_TEST_FILE}`);
    
    // First get server information to verify connection works
    console.log('\n=== Getting Server Information ===');
    try {
      const serverInfoPayload = {
        jsonrpc: "2.0",
        id: 1,
        method: "getServerInfo"
      };
      
      const child = spawn('node', [MCP_SERVER_SCRIPT], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let infoResponse = '';
      
      child.stdout.on('data', (data) => {
        infoResponse += data.toString();
        console.log(`Server info: ${data.toString().trim()}`);
      });
      
      child.on('close', () => {
        console.log('Server info request completed');
      });
      
      child.stdin.write(JSON.stringify(serverInfoPayload) + '\n');
      child.stdin.end();
      
      // Wait a bit before continuing
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Failed to get server info:', error);
    }
    
    // Test project initialization
    console.log('\n=== Testing Project Initialization ===');
    try {
      const initResult = await runMcpCommand('initProject', {
        name: 'MCP-Test-Project'
      });
      console.log('Initialization successful:', initResult);
    } catch (error) {
      console.error('Project initialization error:', error.message);
    }
    
    // Test directly with parseScenarios
    console.log('\n=== Testing Japanese Scenario Parsing ===');
    try {
      const scenarioResult = await runMcpCommand('parseScenarios', {
        source: JAPANESE_TEST_FILE,
        recursive: false,
        model: 'gpt-4o'
      });
      console.log('Scenario parsing result:', scenarioResult);
      
      if (scenarioResult && scenarioResult.outputPath) {
        // Test JTBD generation
        console.log('\n=== Testing JTBD Generation ===');
        try {
          const jtbdResult = await runMcpCommand('generateJtbds', {
            source: scenarioResult.outputPath,
            model: 'gpt-4o'
          });
          console.log('JTBD result:', jtbdResult);
        } catch (error) {
          console.error('JTBD generation error:', error.message);
        }
      }
    } catch (error) {
      console.error('Scenario parsing error:', error.message);
    }
    
    console.log('\n=== Test Completed ===');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testMcp().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});