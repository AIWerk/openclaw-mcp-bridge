#!/bin/bash
set -e
echo "=== Google Maps MCP Server Setup ==="
echo ""
echo "Official Anthropic MCP reference server."
echo "Runs via npx — no installation required!"
echo ""
echo "Next steps:"
echo "1. Get your API key: https://console.cloud.google.com/apis/credentials"
echo "   → Enable 'Maps JavaScript API', 'Geocoding API', 'Places API', 'Directions API'"
echo "2. Add GOOGLE_MAPS_API_KEY=your_key to your .env file"
echo "3. Add the server config from config.json to your openclaw.json"
echo "4. Restart the gateway"
