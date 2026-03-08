#!/bin/bash
# GitHub MCP Server installer
# Official server by GitHub — requires Docker

set -e

echo "=== GitHub MCP Server Setup ==="
echo ""

# Check Docker
if ! command -v docker &>/dev/null; then
  echo "❌ Docker is required. Install from https://www.docker.com/"
  exit 1
fi

# Pull image
echo "Pulling GitHub MCP Server image..."
docker pull ghcr.io/github/github-mcp-server

echo ""
echo "✅ GitHub MCP Server installed!"
echo ""
echo "Next steps:"
echo "1. Create a Personal Access Token at https://github.com/settings/personal-access-tokens/new"
echo "2. Add GITHUB_MCP_TOKEN=your_token to your .env file"
echo "3. Add the server config from config.json to your openclaw.json"
echo "4. Restart the gateway"
