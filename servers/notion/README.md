# Notion MCP Server

Official Notion integration for reading and managing your Notion workspace — pages, databases, blocks, and search.

## Requirements
- Node.js + npx
- Notion API token ([My Integrations](https://www.notion.so/my-integrations))

> **Important:** After creating the integration, share the pages/databases you want accessible with it (page → ··· → Connections → Add your integration).

## Quick Install

### Linux / macOS
```bash
cd ~/.openclaw/extensions/mcp-client/servers/notion
chmod +x install.sh && ./install.sh
```

### Windows (PowerShell)
```powershell
cd $env:USERPROFILE\.openclaw\extensions\mcp-client\servers\notion
.\install.ps1
```

### Manual Setup
1. Get your token: https://www.notion.so/my-integrations
2. Add to .env: `NOTION_API_KEY=ntn_xxxxx`
3. Add config to openclaw.json (see config.json)
4. Restart gateway

## What you get
- 22 tools: search, pages, databases, blocks, users, comments
- Full Notion API coverage
- Official package: [@notionhq/notion-mcp-server](https://www.npmjs.com/package/@notionhq/notion-mcp-server)

## Remove

```bash
./install-server.sh notion --remove
```

Removes the server from config and cleans up the API token. The server recipe stays in `servers/notion/` for easy reinstall.
