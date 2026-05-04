# Apify MCP Server

Hosted Apify MCP endpoint for actors, scraping, and docs search.

## Requirements
- No local runtime needed (streamable HTTP)
- Apify API token

## Quick Install

### Linux / macOS
```bash
# Using mcp-bridge CLI:
mcp-bridge install apify
```

### Windows (PowerShell)
```powershell
# Using mcp-bridge CLI:
mcp-bridge install apify
```

### Manual Setup
1. Get your token: https://console.apify.com/settings/integrations
2. Add to .env: `APIFY_TOKEN=your_token`
3. Add config to ~/.mcp-bridge/config.json (see config.json)
4. Restart mcp-bridge

## What you get
- Actor discovery and execution
- Run/result retrieval tools
- Apify documentation and web extraction tools

## Remove

```bash
./install-server.sh apify --remove
```

Removes the server from config and cleans up the API token. The server recipe stays in `servers/apify/` for easy reinstall.
