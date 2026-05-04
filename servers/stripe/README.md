# Stripe MCP Server

Stripe MCP server for billing and payments operations.

## Requirements
- Node.js + npx
- Stripe API key

## Quick Install

### Linux / macOS
```bash
# Using mcp-bridge CLI:
mcp-bridge install stripe
```

### Windows (PowerShell)
```powershell
# Using mcp-bridge CLI:
mcp-bridge install stripe
```

### Manual Setup
1. Get your token: https://dashboard.stripe.com/apikeys
2. Add to .env: `STRIPE_API_KEY=your_token`
3. Add config to ~/.mcp-bridge/config.json (see config.json)
4. Restart mcp-bridge

## What you get
- Customer and subscription tools
- Invoices and payment intent tools
- Refund, dispute, and balance tools

## Remove

```bash
./install-server.sh stripe --remove
```

Removes the server from config and cleans up the API token. The server recipe stays in `servers/stripe/` for easy reinstall.
