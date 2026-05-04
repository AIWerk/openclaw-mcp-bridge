# Miro MCP Server

Miro board MCP tools for collaborative whiteboards.

## Requirements
- Node.js + npx
- Miro API token

## Quick Install

### Linux / macOS
```bash
# Using mcp-bridge CLI:
mcp-bridge install miro
```

### Windows (PowerShell)
```powershell
# Using mcp-bridge CLI:
mcp-bridge install miro
```

### Manual Setup
1. Get your token: https://miro.com/app/settings/user-profile/apps
2. Add to .env: `MIRO_API_TOKEN=your_token`
3. Add config to ~/.mcp-bridge/config.json (see config.json)
4. Restart mcp-bridge

## What you get
- Board content read tools
- Board object creation/update tools
- Collaboration workspace helpers

## Remove

```bash
./install-server.sh miro --remove
```

Removes the server from config and cleans up the API token. The server recipe stays in `servers/miro/` for easy reinstall.
