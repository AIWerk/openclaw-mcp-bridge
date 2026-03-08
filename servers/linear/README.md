# Linear MCP Server

Issue and project tracking via MCP (`linear-mcp` by dvcrn).

## What it provides

Tools for Linear issue and project management:
- Issue CRUD (create, update, search, assign)
- Project management
- Team and cycle operations
- Label and status management

## Requirements

- Node.js 18+
- Linear API key (free plan: 250 issues)

## Install

No installation needed — runs via `npx`.

## Get your API key

1. Open Linear → Settings (gear icon)
2. Go to **Account → Security & access**
3. Under "Personal API keys" click **New API key**
4. Name it (e.g., "openclaw") and click Create

## Pricing

- **Free:** 250 issues, unlimited members
- **Standard:** $8/user/month

## Configuration

Add to your `openclaw.json` under `plugins.entries.mcp-client.config.servers`:

```json
"linear": {
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "linear-mcp"],
  "env": {
    "LINEAR_API_KEY": "${LINEAR_API_KEY}"
  }
}
```

## Verify

After gateway restart, check logs for:
```
Server linear initialized, registered N tools
```
