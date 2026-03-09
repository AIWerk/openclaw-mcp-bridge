# Apify MCP Server

Hosted Apify MCP endpoint for actors, scraping, and docs search.

## Requirements
- No local runtime needed (streamable HTTP)
- Apify API token

## Quick Install

### Linux / macOS
```bash
cd ~/.openclaw/extensions/mcp-client/servers/apify
chmod +x install.sh && ./install.sh
```

### Windows (PowerShell)
```powershell
cd $env:USERPROFILE\.openclaw\extensions\mcp-client\servers\apify
.\install.ps1
```

### Manual Setup
1. Get your token: https://console.apify.com/settings/integrations
2. Add to .env: `APIFY_TOKEN=your_token`
3. Add config to openclaw.json (see config.json)
4. Restart gateway

## What you get
- Actor discovery and execution
- Run/result retrieval tools
- Apify documentation and web extraction tools

## Remove

```bash
./install-server.sh apify --remove
```

Removes the server from config and cleans up the API token. The server recipe stays in `servers/apify/` for easy reinstall.
