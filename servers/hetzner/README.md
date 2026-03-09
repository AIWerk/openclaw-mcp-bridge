# Hetzner MCP Server

Hetzner Cloud MCP server built from source.

## Requirements
- Git
- Node.js + npm
- Hetzner Cloud API token

## Quick Install

### Linux / macOS
```bash
cd ~/.openclaw/extensions/mcp-client/servers/hetzner
chmod +x install.sh && ./install.sh
```

### Windows (PowerShell)
```powershell
cd $env:USERPROFILE\.openclaw\extensions\mcp-client\servers\hetzner
.\install.ps1
```

### Manual Setup
1. Get your token: https://console.hetzner.cloud/
2. Add to .env: `HETZNER_API_TOKEN=your_token`
3. Add config to openclaw.json (see config.json)
4. Restart gateway

## What you get
- Server lifecycle tools
- Volume, network, and firewall tools
- Project resource inspection tools

## Remove

```bash
./install-server.sh hetzner --remove
```

Removes the server from config and cleans up the API token. The server recipe stays in `servers/hetzner/` for easy reinstall.
