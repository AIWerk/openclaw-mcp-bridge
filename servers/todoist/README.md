# Todoist MCP Server

Todoist MCP server for tasks, projects, and productivity workflows.

## Requirements
- Node.js + npx
- Todoist API token

## Quick Install

### Linux / macOS
```bash
cd ~/.openclaw/extensions/mcp-client/servers/todoist
chmod +x install.sh && ./install.sh
```

### Windows (PowerShell)
```powershell
cd $env:USERPROFILE\.openclaw\extensions\mcp-client\servers\todoist
.\install.ps1
```

### Manual Setup
1. Get your token: https://app.todoist.com/app/settings/integrations/developer
2. Add to .env: `TODOIST_API_TOKEN=your_token`
3. Add config to openclaw.json (see config.json)
4. Restart gateway

## What you get
- Task and project CRUD tools
- Sections, labels, and comments tools
- Scheduling and tracking helpers

## Remove

```bash
./install-server.sh todoist --remove
```

Removes the server from config and cleans up the API token. The server recipe stays in `servers/todoist/` for easy reinstall.
