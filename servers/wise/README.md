# Wise MCP Server

Wise MCP server for multi-currency account and transfer workflows.

## Requirements
- Git
- Node.js + npm
- Wise API token

## Quick Install

### Linux / macOS
```bash
# Using mcp-bridge CLI:
mcp-bridge install wise
```

### Windows (PowerShell)
```powershell
# Using mcp-bridge CLI:
mcp-bridge install wise
```

### Manual Setup
1. Get your token: https://wise.com/settings/api-tokens
2. Add to .env: `WISE_API_TOKEN=your_token`
3. Add config to ~/.mcp-bridge/config.json (see config.json)
4. Restart mcp-bridge

## What you get
- Profile and balance lookup tools
- Quote and transfer workflow tools
- Recipient and transaction tools

## Remove

```bash
./install-server.sh wise --remove
```

Removes the server from config and cleans up the API token. The server recipe stays in `servers/wise/` for easy reinstall.
