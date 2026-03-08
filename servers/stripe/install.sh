#!/bin/bash
# Stripe MCP Server installer — runs via npx (no install needed)
set -e
echo "=== Stripe MCP Server Setup ==="
echo ""
echo "This is the OFFICIAL Stripe MCP server by Stripe."
echo "Runs via npx — no installation required!"
echo ""
echo "Next steps:"
echo "1. Get your API key: https://dashboard.stripe.com/apikeys"
echo "   → Create a Restricted Key with only the permissions you need"
echo "2. Add STRIPE_API_KEY=sk_... to your .env file"
echo "3. Add the server config from config.json to your openclaw.json"
echo "   Note: env var maps STRIPE_API_KEY → STRIPE_SECRET_KEY (what the server expects)"
echo "4. Restart the gateway"
