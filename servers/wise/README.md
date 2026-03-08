# Wise MCP Server

International money transfer and multi-currency account management — community server by **[Szotasz/wise-mcp](https://github.com/Szotasz/wise-mcp)**.

## What it provides

20 tools for Wise account management:

- **Read-only (14):** profiles, balances, currencies, exchange rates, quotes, transfers, recipients, statements, activities, transactions
- **Write (6):** create quote, create recipient, create transfer, fund transfer, cancel transfer, simulate (sandbox)

> ⚠️ **Write tools move real money.** Review carefully before use.

## Requirements

- Node.js
- Wise Personal API token

## Install

```bash
git clone https://github.com/Szotasz/wise-mcp
cd wise-mcp
npm install
npm run build
```

> Also available as a [Smithery hosted](https://smithery.ai/) option (search "wise-mcp") if you prefer no local install.

## Get your token

1. Go to [Wise Settings → API tokens](https://wise.com/settings/api-tokens)
2. Create a **Personal API token**
3. Start with read-only permissions; add write permissions only if needed

## Configuration

Add to your `openclaw.json` under `plugins.entries.mcp-client.config.servers`:

```json
{
  "wise": {
    "transport": "stdio",
    "command": "node",
    "args": ["/path/to/wise-mcp/dist/cli.js"],
    "env": {
      "WISE_API_TOKEN": "${WISE_API_TOKEN}"
    }
  }
}
```

Update the path in `args` to match where you cloned the repo.

## Verify

After gateway restart, check logs for:
```
Server wise initialized, registered 20 tools
```
