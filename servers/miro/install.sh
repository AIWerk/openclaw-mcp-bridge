#!/bin/bash
# Miro MCP Server installer — runs via npx (no install needed)
set -e
echo "=== Miro MCP Server Setup ==="
echo ""
echo "This server runs via npx — no installation required!"
echo ""
echo "Next steps:"
echo "1. Create a Miro app: https://miro.com/app/settings/user-profile/apps"
echo "   → Create new app → copy the Access Token"
echo "2. Add MIRO_API_TOKEN=your_token to your .env file"
echo "3. Add the server config from config.json to your openclaw.json"
echo "4. Restart the gateway"
