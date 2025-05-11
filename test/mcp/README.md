# PDM-AI MCP Tests

This directory contains tests for the Model Context Protocol (MCP) implementation of PDM-AI.

## Test Structure

- `run-mcp-tests.js`: Main comprehensive test runner that validates all MCP functionality
  - Tests scenario parsing, JTBD generation, visualization, and MCP server loading
  - Provides detailed logging and test summary
  - Handles test artifacts in a temporary directory
- `test-mcp-client.js`: Direct MCP client test to verify callback handling
  - Tests whether the callbackify fix resolves the "cb is not a function" error
  - Creates temporary test files and performs direct client-server communication
  - Tests both handshake and tool invocation interactions

## Individual Tests

The `individual-tests` directory contains specialized test scripts for specific aspects of MCP:

- `direct-test.js`: Tests PDM-AI commands directly without using the MCP protocol wrapper
- `test-cli.js`: Tests MCP implementation via command-line interface
- `test-local-mcp.js`: Tests MCP implementation via direct process communication

## Running Tests

To run the main test suite (recommended):

```bash
node test/mcp/run-mcp-tests.js
```

To run the direct MCP client test (for verifying callback handling):

```bash
node test/mcp/test-mcp-client.js
```

To run individual tests:

```bash
node test/mcp/individual-tests/direct-test.js
node test/mcp/individual-tests/test-cli.js
node test/mcp/individual-tests/test-local-mcp.js
```

## Environment Variables

The following environment variables can be used to configure the tests:

- `SKIP_API_CALLS=true`: Skip tests requiring API calls (scenario, JTBD, visualize)
- `KEEP_TEMP=true`: Keep temporary test files for inspection after tests complete
- `FULL_TEST=true`: Run tests with the full dataset instead of a small subset

Example:

```bash
SKIP_API_CALLS=true node test/mcp/run-mcp-tests.js
```

## Test Output

Tests will output detailed logs showing:
- File paths and test configurations
- Command execution results
- Success/failure status for each test
- Summary of all test results
- Location of test artifacts (if `KEEP_TEMP=true`)

## Troubleshooting

If tests fail, check the following:
1. API key is properly set in the environment or `.env` file
2. Required model (e.g., `gpt-4o`) is available for your API key
3. Test files are accessible and have proper permissions
4. No previous test processes are still running

### Common Issues

- **"cb is not a function" error**: This occurs when the MCP SDK expects a callback function but receives a Promise. The fix involves using `util.callbackify()` to wrap async functions in the server implementation. Run `test-mcp-client.js` to verify the fix works correctly.
- **Initialization errors**: Make sure environment variables are properly configured, including API keys and model settings.