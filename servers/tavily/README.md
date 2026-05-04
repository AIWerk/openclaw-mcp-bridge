# Tavily MCP Server

Tavily MCP search and extraction tools.

## Requirements
- Node.js + npx
- Tavily API key

## Quick Install

### Linux / macOS
```bash
# Using mcp-bridge CLI:
mcp-bridge install tavily
```

### Windows (PowerShell)
```powershell
# Using mcp-bridge CLI:
mcp-bridge install tavily
```

### Manual Setup
1. Get your token: https://app.tavily.com/home
2. Add to .env: `TAVILY_API_KEY=your_token`
3. Add config to ~/.mcp-bridge/config.json (see config.json)
4. Restart mcp-bridge

## What you get
- Web search tools
- URL extraction and crawling tools
- Research and mapping helpers

## Remove

```bash
./install-server.sh tavily --remove
```

Removes the server from config and cleans up the API token. The server recipe stays in `servers/tavily/` for easy reinstall.
