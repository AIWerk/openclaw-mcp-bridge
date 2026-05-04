# Hetzner MCP Server

Hetzner Cloud MCP server built from source.

## Requirements
- Git
- Node.js + npm
- Hetzner Cloud API token

## Quick Install

### Linux / macOS
```bash
# Using mcp-bridge CLI:
mcp-bridge install hetzner
```

### Windows (PowerShell)
```powershell
# Using mcp-bridge CLI:
mcp-bridge install hetzner
```

### Manual Setup
1. Get your token: https://console.hetzner.cloud/
2. Add to .env: `HETZNER_API_TOKEN=your_token`
3. Add config to ~/.mcp-bridge/config.json (see config.json)
4. Restart mcp-bridge

## What you get
- Server lifecycle tools
- Volume, network, and firewall tools
- Project resource inspection tools

## Remove

```bash
./install-server.sh hetzner --remove
```

Removes the server from config and cleans up the API token. The server recipe stays in `servers/hetzner/` for easy reinstall.
