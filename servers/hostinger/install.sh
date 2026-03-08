#!/bin/bash
# Hostinger MCP Server — community npm package
set -e
echo "=== Hostinger MCP Server Setup ==="
echo ""
echo "Installing hostinger-api-mcp..."
npm install -g hostinger-api-mcp
echo ""
echo "✅ Installed! Verify: which hostinger-api-mcp"
echo ""
echo "Next steps:"
echo "1. Get your API token: Hostinger Dashboard → Account → API Token"
echo "2. Add HOSTINGER_API_TOKEN=... to your .env file"
echo "3. Add the server config from config.json to your openclaw.json"
echo "   Note: .env uses HOSTINGER_API_TOKEN, server expects API_TOKEN — config maps between them"
echo "4. Restart the gateway"
