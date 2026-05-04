# Hostinger MCP Server

Hostinger MCP tools for hosting operations.

## Requirements
- Node.js + npx
- Hostinger API token

## Quick Install

### Linux / macOS
```bash
# Using mcp-bridge CLI:
mcp-bridge install hostinger
```

### Windows (PowerShell)
```powershell
# Using mcp-bridge CLI:
mcp-bridge install hostinger
```

### Manual Setup
1. Get your token: https://hpanel.hostinger.com/api
2. Add to .env: `HOSTINGER_API_TOKEN=your_token`
3. Add config to ~/.mcp-bridge/config.json (see config.json)
4. Restart mcp-bridge

## What you get
- Hosting and site management tools
- Domain and DNS management tools
- Account and infrastructure utilities

## Remove

```bash
./install-server.sh hostinger --remove
```

Removes the server from config and cleans up the API token. The server recipe stays in `servers/hostinger/` for easy reinstall.
