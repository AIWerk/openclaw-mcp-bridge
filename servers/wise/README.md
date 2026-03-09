# Wise MCP Server

Wise MCP server for multi-currency account and transfer workflows.

## Requirements
- Git
- Node.js + npm
- Wise API token

## Quick Install

### Linux / macOS
```bash
cd ~/.openclaw/extensions/mcp-client/servers/wise
chmod +x install.sh && ./install.sh
```

### Windows (PowerShell)
```powershell
cd $env:USERPROFILE\.openclaw\extensions\mcp-client\servers\wise
.\install.ps1
```

### Manual Setup
1. Get your token: https://wise.com/settings/api-tokens
2. Add to .env: `WISE_API_TOKEN=your_token`
3. Add config to openclaw.json (see config.json)
4. Restart gateway

## What you get
- Profile and balance lookup tools
- Quote and transfer workflow tools
- Recipient and transaction tools

## Remove

```bash
./install-server.sh wise --remove
```

Removes the server from config and cleans up the API token. The server recipe stays in `servers/wise/` for easy reinstall.
