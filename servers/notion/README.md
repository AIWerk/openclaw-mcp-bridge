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
```bash
cd ~/.openclaw/extensions/mcp-client
./install-server.sh notion
```

**Windows:**
```powershell
cd $env:USERPROFILE\.openclaw\extensions\mcp-client
.\install-server.ps1 notion
```

The installer will:
- Ask for your API token
- Save it securely to `~/.openclaw/.env` (chmod 600)
- Merge the server config into `openclaw.json` (with backup)
- Restart the gateway and verify the server is running

## Notes
- Uses `npx` — no global install needed, downloads automatically on first run
- First start may be slow (~10s) as npx downloads the package
- If re-running, the installer asks whether to overwrite the existing token
- Official package by Notion: [@notionhq/notion-mcp-server](https://www.npmjs.com/package/@notionhq/notion-mcp-server)
