# Hostinger MCP Server

Hostinger MCP tools for hosting operations.

## Requirements
- Node.js + npx
- Hostinger API token

## Quick Install

### Linux / macOS
```bash
cd ~/.openclaw/extensions/mcp-client/servers/hostinger
chmod +x install.sh && ./install.sh
```

### Windows (PowerShell)
```powershell
cd $env:USERPROFILE\.openclaw\extensions\mcp-client\servers\hostinger
.\install.ps1
```

### Manual Setup
1. Get your token: https://hpanel.hostinger.com/api
2. Add to .env: `HOSTINGER_API_TOKEN=your_token`
3. Add config to openclaw.json (see config.json)
4. Restart gateway

## What you get
- Hosting and site management tools
- Domain and DNS management tools
- Account and infrastructure utilities

## Remove

```bash
./install-server.sh hostinger --remove
```

Removes the server from config and cleans up the API token. The server recipe stays in `servers/hostinger/` for easy reinstall.
