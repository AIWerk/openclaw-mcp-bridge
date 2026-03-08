# Tavily MCP Server

AI-optimized web search API via MCP (`tavily-mcp`).

## What it provides

5 tools for web search and content extraction:
- `tavily_search` — web search optimized for LLMs (returns clean markdown)
- `tavily_extract` — extract content from URLs
- `tavily_crawl` — crawl websites with configurable depth
- `tavily_map` — map a website's URL structure
- `tavily_research` — comprehensive multi-source research

## Requirements

- Node.js 18+
- Tavily API key (free tier: 1000 requests/month)

## Install

No installation needed — runs via `npx`.

## Get your API key

1. Visit https://app.tavily.com/home
2. Sign up with Google or GitHub (instant)
3. Copy the API key from the dashboard

## Pricing

- **Free:** 1000 requests/month
- **Hobby:** $20/month (10,000 requests)
- **Pro:** $100/month (100,000 requests)

## Configuration

Add to your `openclaw.json` under `plugins.entries.mcp-client.config.servers`:

```json
"tavily": {
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "tavily-mcp"],
  "env": {
    "TAVILY_API_KEY": "${TAVILY_API_KEY}"
  }
}
```

## Verify

After gateway restart, check logs for:
```
Server tavily initialized, registered 5 tools
```

## Notes

- Tavily is the most requested MCP server in the OpenClaw community
- Results are pre-cleaned markdown — ideal for LLM consumption
- The free tier is generous enough for personal use
