# Notion MCP Server

Official Notion integration for reading and managing your Notion workspace — pages, databases, blocks, and search.

**Transport:** Stdio (npx, no install needed)

## Tools (22)
Full Notion API coverage: search, pages, databases, blocks, users, comments, and more.

## Installation

### 1. Create a Notion integration
Go to [My Integrations](https://www.notion.so/my-integrations) → New integration → copy the **Internal Integration Secret**.

Then share the pages/databases you want accessible with the integration (page → ··· → Connections → Add your integration).

### 2. Run the installer

#### Linux / macOS
```bash
cd ~/.openclaw/extensions/mcp-client/servers/notion
chmod +x install.sh && ./install.sh
```

#### Windows (PowerShell)
```powershell
cd $env:USERPROFILE\.openclaw\extensions\mcp-client\servers\notion
.\install.ps1
```

The installer will:
- Ask for your API token
- Save it securely to `~/.openclaw/.env` (chmod 600)
- Merge the server config into `openclaw.json` (with backup)
- Restart the gateway and verify the server is running

### Manual setup

Save your token:
```bash
# Option A: Add to .env directly
echo "NOTION_API_KEY=ntn_xxxxx" >> ~/.openclaw/.env

# Option B: Using pass (password-store)
pass insert api/notion-api-key
```

Add to `openclaw.json`:
```json
{
  "notion": {
    "transport": "stdio",
    "command": "npx",
    "args": ["-y", "@notionhq/notion-mcp-server"],
    "env": {
      "NOTION_API_KEY": "${NOTION_API_KEY}"
    }
  }
}
```

Restart and verify:
```bash
openclaw gateway restart
journalctl --user -u openclaw-gateway.service | grep "notion"
```

## Windows

OpenClaw runs on Windows (WSL2 recommended). Adapt paths:
- Config: `%USERPROFILE%\.openclaw\openclaw.json`
- Logs: `openclaw gateway logs` (no journalctl)
- `pip`/`npm`/`npx` commands work the same on Windows

## Notes
- Uses `npx` — no global install needed, downloads automatically on first run
- First start may be slow (~10s) as npx downloads the package
- If re-running, the installer asks whether to overwrite the existing token
- Official package by Notion: [@notionhq/notion-mcp-server](https://www.npmjs.com/package/@notionhq/notion-mcp-server)
