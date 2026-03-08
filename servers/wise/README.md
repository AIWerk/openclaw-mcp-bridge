# Wise MCP Server

[Wise](https://wise.com) (formerly TransferWise) international money transfer and multi-currency account management.

## Server

- **Source:** [Szotasz/wise-mcp](https://github.com/Szotasz/wise-mcp) (community)
- **Transport:** stdio
- **Install:** `git clone` + `npm install` + `npm run build` (no npm package)
- **Also available:** [Smithery hosted](https://smithery.ai/) (search "wise-mcp")

## Tools (20)

**Read-only (14):** profiles, balances, currencies, exchange rates, quotes, transfers, recipients, statements, activities, transactions

**Write (6):** create quote, create recipient, create transfer, fund transfer, cancel transfer, simulate (sandbox)

## Get Your Token

1. Go to [Wise Settings → API tokens](https://wise.com/settings/api-tokens)
2. Create a **Personal API token**
3. For production use, enable the permissions you need (read-only recommended to start)

## Config

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

## Windows Compatible

Yes — pure Node.js, no native dependencies.

## Verify

After gateway restart, check logs for:
```
Server wise initialized, registered 20 tools
```
