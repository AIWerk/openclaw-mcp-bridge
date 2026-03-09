# GitHub MCP Server

Official GitHub MCP server running in Docker.

## Requirements
- Docker
- GitHub fine-grained personal access token

## Quick Install

### Linux / macOS
```bash
cd ~/.openclaw/extensions/mcp-client/servers/github
chmod +x install.sh && ./install.sh
```

### Windows (PowerShell)
```powershell
cd $env:USERPROFILE\.openclaw\extensions\mcp-client\servers\github
.\install.ps1
```

### Manual Setup
1. Get your token: https://github.com/settings/tokens
2. Add to .env: `GITHUB_MCP_TOKEN=your_token`
3. Add config to openclaw.json (see config.json)
4. Restart gateway

## What you get
- Repository browsing and search tools
- Issue and pull request management tools
- Workflow and automation helpers

## Remove

```bash
./install-server.sh github --remove
```

Removes the server from config and cleans up the API token. The server recipe stays in `servers/github/` for easy reinstall.
