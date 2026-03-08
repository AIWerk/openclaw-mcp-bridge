#!/bin/bash
# Linear MCP Server installer
set -e
echo "=== Linear MCP Server Setup ==="
echo ""
echo "Installing linear-mcp..."
npm install -g linear-mcp
echo ""
echo "Finding installed path..."
LINEAR_PATH="$(npm root -g)/linear-mcp/build/index.js"
echo "Installed at: $LINEAR_PATH"
echo ""
echo "Next steps:"
echo "1. Get your API key: Linear → Settings → Account → Security & access → Personal API keys"
echo "2. Add LINEAR_API_KEY=your_key to your .env file"
echo "3. Add this to your openclaw.json servers config:"
echo "   \"linear\": {"
echo "     \"transport\": \"stdio\","
echo "     \"command\": \"node\","
echo "     \"args\": [\"$LINEAR_PATH\"],"
echo "     \"env\": { \"LINEAR_API_KEY\": \"\${LINEAR_API_KEY}\" }"
echo "   }"
echo "4. Restart the gateway"
