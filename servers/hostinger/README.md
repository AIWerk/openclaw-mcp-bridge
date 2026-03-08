# Hostinger MCP Server

Web hosting management — **[hostinger-api-mcp](https://www.npmjs.com/package/hostinger-api-mcp)** (`hostinger-api-mcp`).

## What it provides

119 tools covering the full Hostinger API: domain management, hosting accounts, email accounts, DNS records, SSL certificates, backups, databases, file management, and more.

## Requirements

- Node.js 22+ (24+ recommended per Hostinger docs)
- Hostinger API token

## Install

```bash
npm install -g hostinger-api-mcp
```

Verify: `which hostinger-api-mcp` should return a path.

## Get your token

1. Go to your [Hostinger dashboard](https://hpanel.hostinger.com) → Account → API Token
2. Create a new token
3. See [Hostinger API docs](https://developers.hostinger.com) for permission details

## Configuration

Add to your `openclaw.json` under `plugins.entries.mcp-client.config.servers`:

```json
{
  "hostinger": {
    "transport": "stdio",
    "command": "hostinger-api-mcp",
    "env": {
      "API_TOKEN": "${HOSTINGER_API_TOKEN}"
    }
  }
}
```

> **Env var note:** `.env` uses `HOSTINGER_API_TOKEN`; the server expects `API_TOKEN` — the config maps them as shown above.

## Verify

After gateway restart, check logs for:
```
Server hostinger initialized, registered 119 tools
```
