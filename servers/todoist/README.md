# Todoist MCP Server

Todoist MCP server for tasks, projects, and productivity workflows.

## Requirements
- Node.js + npx
- Todoist API token

## Quick Install

### Linux / macOS
```bash
# Using mcp-bridge CLI:
mcp-bridge install todoist
```

### Windows (PowerShell)
```powershell
# Using mcp-bridge CLI:
mcp-bridge install todoist
```

### Manual Setup
1. Get your token: https://app.todoist.com/app/settings/integrations/developer
2. Add to .env: `TODOIST_API_TOKEN=your_token`
3. Add config to ~/.mcp-bridge/config.json (see config.json)
4. Restart mcp-bridge

## What you get
- Task and project CRUD tools
- Sections, labels, and comments tools
- Scheduling and tracking helpers

## Remove

```bash
./install-server.sh todoist --remove
```

Removes the server from config and cleans up the API token. The server recipe stays in `servers/todoist/` for easy reinstall.
