# OpenClaw MCP Client Plugin

Bridges any [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server into OpenClaw — tools are automatically discovered and registered as native agent tools via `registerTool()`.

## Features

- **Three transports** — SSE, Stdio, and Streamable HTTP (for Smithery Connect, Swiggy, Zomato, etc.)
- **Auto-discovery** — `tools/list` → all tools registered as native OpenClaw tools
- **Schema conversion** — JSON Schema → TypeBox, with multi-fallback import strategy
- **Reconnection** — auto-reconnect with full protocol re-initialization + tool re-registration
- **Memory-safe** — pending requests are cleaned up on reconnect, no leaked timeouts
- **Env var substitution** — `${APIFY_TOKEN}` in headers/env config

## Quick Install

**Linux / macOS:**
```bash
curl -sL https://raw.githubusercontent.com/AIWerk/openclaw-mcp-client/master/install.sh | bash
```

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/AIWerk/openclaw-mcp-client/master/install.ps1 | iex
```

This clones the plugin, adds it to your `openclaw.json`, and you're ready to configure servers.

## Configuration

Edit `~/.openclaw/openclaw.json` → `plugins.entries.mcp-client.config.servers`:

### SSE server (remote)

```json
{
  "my-server": {
    "transport": "sse",
    "url": "https://mcp.example.com/sse",
    "headers": {
      "Authorization": "Bearer ${MY_TOKEN}"
    }
  }
}
```

### Stdio server (local)

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

### Streamable HTTP server (remote)

```json
{
  "my-api": {
    "transport": "streamable-http",
    "url": "https://mcp.example.com/mcp",
    "headers": {
      "Authorization": "Bearer ${MY_TOKEN}"
    }
  }
}
```

> **When to use which transport?**
> - **SSE** — most common, classic MCP servers (Apify, custom servers)
> - **Streamable HTTP** — newer transport, single POST endpoint (Smithery Connect, Swiggy, Zomato)
> - **Stdio** — local servers running as subprocess (Notion, filesystem, GitHub)

### Full config options

| Option | Default | Description |
|---|---|---|
| `toolPrefix` | `true` | Prefix tool names with server name (e.g. `myserver_search`) |
| `reconnectIntervalMs` | `30000` | Auto-reconnect interval |
| `connectionTimeoutMs` | `10000` | Initial connection timeout |
| `requestTimeoutMs` | `60000` | Tool call / request timeout |

After configuring, restart the gateway:

```bash
openclaw gateway restart
```

## How it works

```
MCP Server              Plugin                  Agent
┌─────────────┐        ┌─────────────────┐     ┌──────────┐
│ tools/list   │◄──────│ mcp-client       │────►│ uses the │
│ tools/call   │◄──────│ registerTool()   │     │ tools    │
│ SSE/stdio    │       └─────────────────┘     └──────────┘
└─────────────┘
```

1. Plugin connects to each configured MCP server
2. Sends `initialize` + `notifications/initialized` (MCP handshake)
3. Calls `tools/list` to discover available tools
4. Converts JSON Schema → TypeBox and registers each tool via `api.registerTool()`
5. Tool calls are proxied as `tools/call` JSON-RPC requests

On connection loss: auto-reconnect → full re-handshake → re-register tools.

## Compatible MCP servers

Any MCP-compliant server works. Some tested examples:

| Server | Transport | Auth |
|---|---|---|
| [Apify](https://mcp.apify.com) | SSE | Bearer token |
| [@notionhq/notion-mcp-server](https://npmjs.com/package/@notionhq/notion-mcp-server) | stdio | API key via env |
| [@modelcontextprotocol/server-filesystem](https://github.com/modelcontextprotocol/servers) | stdio | none |
| [@modelcontextprotocol/server-github](https://github.com/modelcontextprotocol/servers) | stdio | GitHub token |

See [MCP Server Registry](https://github.com/modelcontextprotocol/servers) for more.

> **Note:** If OpenClaw already has a native plugin for a service (e.g. Notion, Apify), prefer the native plugin — it's faster and better integrated. Use this plugin for servers without native OpenClaw support.

## File structure

| File | Purpose |
|---|---|
| `index.ts` | Main plugin — server init, tool registration, execution |
| `transport-sse.ts` | SSE transport (HTTP Server-Sent Events) |
| `transport-stdio.ts` | Stdio transport (subprocess) |
| `transport-streamable-http.ts` | Streamable HTTP transport (single POST endpoint) |
| `schema-convert.ts` | JSON Schema → TypeBox conversion |
| `types.ts` | TypeScript interfaces |
| `openclaw.plugin.json` | Plugin metadata + config schema |
| `install.sh` | Linux/macOS installer |
| `install.ps1` | Windows PowerShell installer |

## Troubleshooting

```bash
# Check connection status
journalctl --user -u openclaw-gateway.service | grep mcp-client

# Expected output on success:
# [mcp-client] Connected to server: myserver
# [mcp-client] Server myserver initialized, registered N tools
```

Common issues:
- **"No servers configured"** — add at least one server to config
- **Tool name conflicts** — the MCP server exposes tools that overlap with native OpenClaw plugins. Remove the MCP server or disable the native plugin.
- **SSE timeout** — check URL and auth token
- **Stdio crash** — ensure `npx` / command is available and the package exists

## Requirements

- OpenClaw 2026.3.x+
- Node.js 22+

## License

MIT
