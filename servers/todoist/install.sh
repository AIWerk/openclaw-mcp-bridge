#!/bin/bash
# Todoist MCP Server installer
# Official server by Doist — runs via npx (no install needed)

set -e

echo "=== Todoist MCP Server Setup ==="
echo ""
echo "This server runs via npx — no installation required!"
echo ""
echo "Next steps:"
echo "1. Get your API token: Todoist → Settings → Integrations → Developer"
echo "   Or visit: https://app.todoist.com/app/settings/integrations/developer"
echo "2. Add TODOIST_API_TOKEN=your_token to your .env file"
echo "3. Add the server config from config.json to your openclaw.json"
echo "4. Restart the gateway"
