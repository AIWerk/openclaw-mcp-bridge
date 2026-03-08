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
# Review the script first if you prefer:
# curl -sL https://raw.githubusercontent.com/AIWerk/openclaw-mcp-client/master/install.sh > install.sh && cat install.sh && bash install.sh

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
| `requestTimeoutMs` | `60000` | Tool call / request timeout (per tool invocation) |

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

## Example MCP servers

Any MCP-compliant server should work. Here are some examples (not all tested by us):

| Server | Transport | Auth |
|---|---|---|
| [Apify](https://mcp.apify.com) | SSE | Bearer token |
| [@notionhq/notion-mcp-server](https://npmjs.com/package/@notionhq/notion-mcp-server) | stdio | API key via env |
| [@modelcontextprotocol/server-filesystem](https://github.com/modelcontextprotocol/servers) | stdio | none |
| [@modelcontextprotocol/server-github](https://github.com/modelcontextprotocol/servers) | stdio | GitHub token |
| [Swiggy](https://mcp.swiggy.com/food) | streamable-http | none |
| [Zomato](https://mcp-server.zomato.com/mcp) | streamable-http | none |

See [MCP Server Registry](https://registry.modelcontextprotocol.io) and [awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) for more.

### Quick-start config (copy-paste ready)

```json
{
  "servers": {
    "filesystem": {
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/documents"]
    },
    "swiggy": {
      "transport": "streamable-http",
      "url": "https://mcp.swiggy.com/food"
    }
  }
}
```

Paste this into your `openclaw.json` under `plugins.entries.mcp-client.config`, adjust the filesystem path, restart the gateway, and you'll have two MCP servers connected.

> **Note:** If OpenClaw already has a native plugin for a service, prefer the native plugin — it's faster and better integrated. Use this plugin for servers without native OpenClaw support.

> **Streamable HTTP:** This transport expects single JSON-RPC responses per request. Servers using chunked/streaming responses may not work correctly. SSE and stdio are the most thoroughly tested transports.

## File structure

| File | Purpose |
|---|---|
| `index.ts` | Main plugin — server init, tool registration, execution |
| `transport-sse.ts` | SSE transport (HTTP Server-Sent Events) |
| `transport-stdio.ts` | Stdio transport (subprocess) |
| `transport-streamable-http.ts` | Streamable HTTP transport (single POST endpoint) |
| `schema-convert.ts` | JSON Schema → TypeBox conversion (safe subset — see note below) |
| `types.ts` | TypeScript interfaces |
| `openclaw.plugin.json` | Plugin metadata + config schema |
| `install.sh` | Linux/macOS installer |
| `install.ps1` | Windows PowerShell installer |

## JSON Schema support

The plugin converts MCP tool input schemas (JSON Schema) to TypeBox for OpenClaw's type system. This is a **safe, limited subset** — not a full JSON Schema implementation:

- ✅ Supported: `string`, `number`, `integer`, `boolean`, `array`, `object`, `null`, `enum`, `required`
- ⚠️ Falls back to `Type.Any()`: `anyOf`, `oneOf`, `allOf`, `$ref`, tuple arrays, complex compositions
- 🛡️ Safety limits: max depth 10, max 100 properties per object (prevents recursion bombs)

This means complex schemas won't crash the plugin — they'll just have looser input validation.

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

## Uninstall

1. Remove the `mcp-client` entry from `plugins.entries` in your `openclaw.json`
2. Delete the plugin folder: `rm -rf ~/.openclaw/extensions/mcp-client`
3. Restart the gateway: `openclaw gateway restart`

## Requirements

- OpenClaw 2026.3.x+
- Node.js 22+
- **TypeBox** — used for schema conversion, provided by OpenClaw (no separate install needed). If you run the plugin outside of OpenClaw, install it manually: `npm install @sinclair/typebox`

## License

MIT
