# Todoist MCP Server

Official MCP server by Doist (`@doist/todoist-ai`).

## What it provides

27 tools for task management:
- Task CRUD (create, update, complete, search)
- Project and section management
- Comments and labels
- Date-based queries and filters

## Requirements

- Node.js 18+
- Todoist API token (free account works)

## Install

No installation needed — runs via `npx`.

## Get your token

1. Open Todoist → Settings → Integrations → Developer
2. Or visit: https://app.todoist.com/app/settings/integrations/developer
3. Copy the API token

## Configuration

Add to your `openclaw.json` under `plugins.entries.mcp-client.config.servers`:

```json
"todoist": {
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@doist/todoist-ai"],
  "env": {
    "TODOIST_API_KEY": "${TODOIST_API_TOKEN}"
  }
}
```

Note: The env var in `.env` is `TODOIST_API_TOKEN`, but the server expects `TODOIST_API_KEY`.

## Verify

After gateway restart, check logs for:
```
Server todoist initialized, registered 27 tools
```
