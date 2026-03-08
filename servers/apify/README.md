# Apify MCP Server

Web scraping and automation platform — 8 tools for actor management, web scraping, and documentation search.

**Transport:** Streamable HTTP (hosted, no local install)

## Tools
- `search-actors` — Find scrapers/actors in the Apify Store
- `fetch-actor-details` — Get actor documentation and input schema
- `call-actor` — Run an actor with parameters
- `get-actor-run` — Check run status
- `get-actor-output` — Retrieve results from a run
- `search-apify-docs` — Search Apify documentation
- `fetch-apify-docs` — Fetch full documentation pages
- `apify/rag-web-browser` — Scrape any URL to markdown

## Installation

### 1. Get your API token
Go to [Apify Console → Settings → Integrations](https://console.apify.com/account/integrations) and create an API token.

### 2. Save the token
```bash
# Option A: Add to .env directly
echo "APIFY_TOKEN=apify_api_xxxxx" >> ~/.openclaw/.env

# Option B: Using pass (password-store)
pass insert api/apify-token
# Then add to your generate-env.sh:
# write_secret "APIFY_TOKEN" "api/apify-token"
```

### 3. Install with the installer
```bash
cd ~/.openclaw/extensions/mcp-client
./install-server.sh apify
```

### 4. Or manually add to openclaw.json
```json
{
  "apify": {
    "transport": "streamable-http",
    "url": "https://mcp.apify.com",
    "headers": {
      "Authorization": "Bearer ${APIFY_TOKEN}"
    }
  }
}
```

### 5. Restart gateway
```bash
openclaw gateway restart
```

### 6. Verify
```bash
journalctl --user -u openclaw-gateway.service | grep "apify"
# Expected: Server apify initialized, registered 8 tools
```

## Windows

OpenClaw runs on Windows (WSL2 recommended). Adapt paths:
- Config: `%USERPROFILE%\.openclaw\openclaw.json`
- Logs: `openclaw gateway logs` (no journalctl)
- `pip`/`npm`/`npx` commands work the same on Windows

## Notes
- Apify is a hosted service — no local software needed
- Free tier available (limited usage), paid plans for more
- SSE transport is deprecated (sunset April 2026), use Streamable HTTP
