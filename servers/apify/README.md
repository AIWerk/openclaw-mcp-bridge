# Apify MCP Server

Web scraping and automation platform — hosted by Apify (`apify/actors-mcp-server`).

## What it provides

8 tools for actor management, web scraping, and documentation search: find and run actors, check run status, retrieve results, search/fetch Apify docs, and scrape any URL to markdown.

- `search-actors` — Find scrapers/actors in the Apify Store
- `fetch-actor-details` — Get actor documentation and input schema
- `call-actor` — Run an actor with parameters
- `get-actor-run` — Check run status
- `get-actor-output` — Retrieve results from a run
- `search-apify-docs` — Search Apify documentation
- `fetch-apify-docs` — Fetch full documentation pages
- `apify/rag-web-browser` — Scrape any URL to markdown

## Requirements

- No local install — hosted service, Streamable HTTP transport
- Apify API token (free tier available)

## Install

No installation needed — runs via Streamable HTTP.

## Get your token

1. Go to [Apify Console → Settings → Integrations](https://console.apify.com/account/integrations)
2. Create an API token
3. Free tier available; paid plans for higher usage

## Configuration

Add to your `openclaw.json` under `plugins.entries.mcp-client.config.servers`:

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

Set `APIFY_TOKEN` in your `~/.openclaw/.env`.

## Verify

After gateway restart, check logs for:
```
Server apify initialized, registered 8 tools
```

> **Note:** SSE transport is deprecated (sunset April 2026) — use Streamable HTTP as shown above.
