# Tavily MCP Server

Tavily MCP search and extraction tools.

## Requirements
- Node.js + npx
- Tavily API key

## Quick Install

### Linux / macOS
```bash
cd ~/.openclaw/extensions/mcp-client/servers/tavily
chmod +x install.sh && ./install.sh
```

### Windows (PowerShell)
```powershell
cd $env:USERPROFILE\.openclaw\extensions\mcp-client\servers\tavily
.\install.ps1
```

### Manual Setup
1. Get your token: https://app.tavily.com/home
2. Add to .env: `TAVILY_API_KEY=your_token`
3. Add config to openclaw.json (see config.json)
4. Restart gateway

## What you get
- Web search tools
- URL extraction and crawling tools
- Research and mapping helpers

## Remove

```bash
./install-server.sh tavily --remove
```

Removes the server from config and cleans up the API token. The server recipe stays in `servers/tavily/` for easy reinstall.
