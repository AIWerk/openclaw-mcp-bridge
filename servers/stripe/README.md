# Stripe MCP Server

Payment processing and billing via MCP — **official server by Stripe** (`@stripe/mcp`).

## What it provides

Tools for Stripe operations:
- Customers, subscriptions, invoices
- Products, prices, payment intents
- Refunds, disputes, balance

Tool access is controlled by your API key permissions (Restricted API Key recommended).

## Requirements

- Node.js 18+
- Stripe API key (test or live)

## Install

No installation needed — runs via `npx`.

## Get your API key

1. Go to https://dashboard.stripe.com/apikeys
2. Create a **Restricted Key** with only the permissions you need
3. Or use the default Secret Key (full access) for testing

## Configuration

Add to your `openclaw.json` under `plugins.entries.mcp-client.config.servers`:

```json
"stripe": {
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@stripe/mcp"],
  "env": {
    "STRIPE_SECRET_KEY": "${STRIPE_API_KEY}"
  }
}
```

Note: The `.env` uses `STRIPE_API_KEY` but the server expects `STRIPE_SECRET_KEY` — the config maps between them.

## Verify

After gateway restart, check logs for:
```
Server stripe initialized, registered N tools
```
