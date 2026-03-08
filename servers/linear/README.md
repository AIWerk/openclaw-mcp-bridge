# Linear MCP Server

Issue and project tracking via MCP (`linear-mcp` by dvcrn).

## What it provides

19 tools for Linear issue and project management:
- Issue CRUD (create, update, search, assign)
- Project management
- Team and cycle operations
- Label and status management

## Requirements

- Node.js 18+
- Linear API key (free plan: 250 issues)

## Install

```bash
npm install -g linear-mcp
```

Note: This package doesn't have a `bin` field, so `npx` won't work. You need to install globally and reference the path directly.

## Get your API key

1. Open Linear → Settings (gear icon)
2. Go to **Account → Security & access** (NOT the workspace API page!)
3. Under "Personal API keys" click **New API key**
4. Name it (e.g., "openclaw") and click Create

## Configuration

After install, find the path:
```bash
echo "$(npm root -g)/linear-mcp/build/index.js"
```

Add to your `openclaw.json`:

```json
"linear": {
  "transport": "stdio",
  "command": "node",
  "args": ["/path/to/linear-mcp/build/index.js"],
  "env": {
    "LINEAR_API_KEY": "${LINEAR_API_KEY}"
  }
}
```

## Verify

After gateway restart, check logs for:
```
Server linear initialized, registered 19 tools
```
