#!/bin/bash
# Hetzner Cloud MCP Server — community server by dkruyt
set -e
echo "=== Hetzner Cloud MCP Server Setup ==="
echo ""
echo "Installing mcp-hetzner..."
pip install --break-system-packages git+https://github.com/dkruyt/mcp-hetzner.git
echo ""
echo "✅ Installed! Verify: which mcp-hetzner"
echo ""
echo "Next steps:"
echo "1. Get your API token: Hetzner Cloud Console → Project → Security → API Tokens"
echo "2. Add HETZNER_API_TOKEN=... to your .env file"
echo "3. Add the server config from config.json to your openclaw.json"
echo "   Note: .env uses HETZNER_API_TOKEN, server expects HCLOUD_TOKEN — config maps between them"
echo "4. Restart the gateway"
