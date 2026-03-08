# Notion MCP Server

Official Notion integration for reading and managing your Notion workspace — pages, databases, blocks, and search.

**Transport:** Stdio (npx, no install needed)

## Tools
- Search pages and databases
- Read page content
- Create and update pages
- Query databases
- Manage blocks

## Installation

### 1. Create a Notion integration
Go to [My Integrations](https://www.notion.so/my-integrations) → New integration → copy the **Internal Integration Secret**.

Then share the pages/databases you want accessible with the integration (page → ··· → Connections → Add your integration).

### 2. Save the token
```bash
# Option A: Add to .env directly
echo "NOTION_API_KEY=ntn_xxxxx" >> ~/.openclaw/.env

# Option B: Using pass (password-store)
pass insert api/notion-api-key
```

### 3. Install with the installer
```bash
cd ~/.openclaw/extensions/mcp-client
./install-server.sh notion
```

### 4. Or manually add to openclaw.json
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

### 5. Restart and verify
```bash
openclaw gateway restart
journalctl --user -u openclaw-gateway.service | grep "notion"
```

## Notes
- Uses `npx` — no global install needed, downloads automatically on first run
- First start may be slow (~10s) as npx downloads the package
- Official package by Notion: [@notionhq/notion-mcp-server](https://www.npmjs.com/package/@notionhq/notion-mcp-server)
