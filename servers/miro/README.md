# Miro MCP Server

Whiteboard and visual collaboration via MCP (`@llmindset/mcp-miro` by evalstate).

## What it provides

Tools for Miro board manipulation:
- Create and manage sticky notes
- Board manipulation and bulk operations
- Read board content

## Requirements

- Node.js 18+
- Miro API access token (free plan works)

## Install

No installation needed — runs via `npx`.

## Get your token

1. Go to https://miro.com/app/settings/user-profile/apps
2. Click **Create new app**
3. Name it (e.g., "openclaw")
4. Copy the **Access token** from the app page

## Configuration

Add to your `openclaw.json` under `plugins.entries.mcp-client.config.servers`:

```json
"miro": {
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@llmindset/mcp-miro", "--token", "${MIRO_API_TOKEN}"],
  "env": {}
}
```

Note: The token is passed as a CLI argument, not an env var.

## Verify

After gateway restart, check logs for:
```
Server miro initialized, registered N tools
```
