#!/bin/bash

# Script to start the PDM-AI MCP server locally

# Make script executable
chmod +x "$0"

# Set environment variables
export NODE_ENV=development

# Check if specific config path provided
if [ ! -z "$1" ]; then
  export PDM_CONFIG_PATH="$1"
fi

# Go to project root
cd "$(dirname "$0")/.."

echo "Starting PDM-AI MCP Server..."
echo "-------------------------------"
node src/mcp/index.js

# Exit with the same code as the Node process
exit $?