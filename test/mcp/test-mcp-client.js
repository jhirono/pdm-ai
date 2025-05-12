// Import the MCP SDK using the same path structure as your project
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs-extra';

// Create a sample input directory and file for testing
function createSampleFile() {
  const testDir = path.join(process.cwd(), 'test-mcp-temp');
  const sampleFile = path.join(testDir, 'sample.txt');
  
  fs.ensureDirSync(testDir);
  fs.writeFileSync(sampleFile, 'As a product manager, I want to organize customer feedback effectively, so I can prioritize features better.');
  
  console.log(`Created sample test file at ${sampleFile}`);
  return { testDir, sampleFile };
}

// Clean up test files
function cleanUp(testDir) {
  if (fs.existsSync(testDir)) {
    fs.removeSync(testDir);
    console.log(`Cleaned up test directory ${testDir}`);
  }
}

console.log('Starting MCP client test to verify callbackify fix...');

try {
  // Set up test environment
  const { testDir, sampleFile } = createSampleFile();
  
  // Start the MCP server in a separate process
  const mcpProcess = spawn('pdm-mcp', ['--stdio'], {
    stdio: 'pipe',
    env: process.env
  });
  
  let stdoutData = '';
  let stderrData = '';
  
  mcpProcess.stdout.on('data', (data) => {
    const message = data.toString();
    stdoutData += message;
    console.log(`MCP Server stdout: ${message.trim()}`);
  });
  
  mcpProcess.stderr.on('data', (data) => {
    const message = data.toString();
    stderrData += message;
    console.error(`MCP Server stderr: ${message.trim()}`);
    
    // Look for the "cb is not a function" error in stderr
    if (message.includes('cb is not a function')) {
      console.error('❌ DETECTED ERROR: "cb is not a function" - Our fix is not working!');
    }
  });
  
  // Send a basic handshake message to the MCP server
  setTimeout(() => {
    const handshakeMsg = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '0.1',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      }
    });
    console.log(`Sending handshake message to MCP server: ${handshakeMsg}`);
    mcpProcess.stdin.write(handshakeMsg + '\n');
    
    // After the handshake, attempt to call the parseScenarios tool
    setTimeout(() => {
      const callMsg = JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'callTool',
        params: {
          name: 'parseScenarios',
          params: {
            source: sampleFile
          }
        }
      });
      console.log(`\nSending tool call to MCP server: ${callMsg}`);
      mcpProcess.stdin.write(callMsg + '\n');
      
      // Give it some time to process and then check for errors
      setTimeout(() => {
        if (stderrData.includes('cb is not a function')) {
          console.error('\n❌ TEST FAILED: The "cb is not a function" error still occurs');
        } else if (stderrData.length > 0) {
          console.error(`\n❌ TEST FAILED: Other errors occurred: ${stderrData}`);
        } else {
          console.log('\n✅ TEST PASSED: No "cb is not a function" error detected');
          console.log('The callbackify fix appears to be working correctly!');
        }
        
        // Clean up and exit
        console.log('\nTest completed. Terminating MCP server...');
        mcpProcess.kill();
        cleanUp(testDir);
        process.exit(0);
      }, 5000); // Wait 5 seconds after tool call
    }, 2000); // Wait 2 seconds after handshake
  }, 2000); // Wait 2 seconds after startup
  
  // Handle unexpected termination
  process.on('SIGINT', () => {
    console.log('Test interrupted. Cleaning up...');
    mcpProcess.kill();
    cleanUp(testDir);
    process.exit(1);
  });
  
} catch (error) {
  console.error('Test setup error:', error);
  process.exit(1);
}
