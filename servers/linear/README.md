# Linear MCP Server

Linear issue and project management MCP server.

## Requirements
- Node.js + npm
- Linear API key

## Quick Install

### Linux / macOS
```bash
# Using mcp-bridge CLI:
mcp-bridge install linear
```

### Windows (PowerShell)
```powershell
# Using mcp-bridge CLI:
mcp-bridge install linear
```

### Manual Setup
1. Get your token: https://linear.app/settings/api
2. Add to .env: `LINEAR_API_KEY=your_token`
3. Add config to ~/.mcp-bridge/config.json (see config.json)
4. Restart mcp-bridge

## What you get
- Issue create/update/search tools
- Project and cycle management tools
- Team workflow helpers

## Remove

```bash
./install-server.sh linear --remove
```

Removes the server from config and cleans up the API token. The server recipe stays in `servers/linear/` for easy reinstall.
