# OpenClaw MCP Client Plugin

Bridges any [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server into OpenClaw — tools are automatically discovered and registered as native agent tools via `registerTool()`.

**Tested in production with:**
- [Apify](https://mcp.apify.com) — 8 tools (web scraping, actor management) via Streamable HTTP
- [Hetzner Cloud](https://github.com/dkruyt/mcp-hetzner) — 30 tools (server/volume/firewall management) via Stdio
- [Notion](https://www.npmjs.com/package/@notionhq/notion-mcp-server) — 22 tools (pages, databases, blocks) via Stdio
- [Hostinger](https://www.npmjs.com/package/hostinger-api-mcp) — 119 tools (hosting management) via Stdio

## Features

- **Three transports** — SSE, Stdio, and Streamable HTTP
- **Auto-discovery** — `tools/list` → all tools registered as native OpenClaw tools
- **Schema conversion** — JSON Schema → TypeBox (safe subset, complex schemas fall back to `Type.Any()`)
- **Reconnection** — exponential backoff with jitter, full protocol re-init + tool re-registration
- **Refresh lock** — concurrent reconnect / tools/list_changed events can't race
- **Bidirectional stdio framing** — auto-detects LSP Content-Length or newline, configurable
- **Env var substitution** — `${MY_TOKEN}` in headers/env resolved from OpenClaw .env
- **Memory-safe** — pending requests cleaned up on reconnect, no leaked timeouts

## Installation

### Method 1: Clone (recommended)

```bash
git clone https://github.com/AIWerk/openclaw-mcp-client.git \
  ~/.openclaw/extensions/mcp-client
```

### Method 2: Install script

```bash
# Review first:
curl -sL https://raw.githubusercontent.com/AIWerk/openclaw-mcp-client/master/install.sh | less
# Then run:
curl -sL https://raw.githubusercontent.com/AIWerk/openclaw-mcp-client/master/install.sh | bash
```

### Method 3: Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/AIWerk/openclaw-mcp-client/master/install.ps1 | iex
```

### After installation

1. Add the plugin entry to `~/.openclaw/openclaw.json` (see Configuration below)
2. Restart the gateway: `openclaw gateway restart`
3. Check logs: `journalctl --user -u openclaw-gateway.service | grep mcp-client`

## Getting Started

### Example 1: Apify (Streamable HTTP)

Apify provides 8 tools for web scraping, actor management, and documentation search.

**1. Get an API token:** [Apify Console → Settings → Integrations](https://console.apify.com/account/integrations)

**2. Add token to your environment:**
```bash
# If using pass (password-store):
pass insert api/apify-token

# Or add directly to ~/.openclaw/.env:
echo "APIFY_TOKEN=apify_api_xxxxx" >> ~/.openclaw/.env
```

**3. Add to `openclaw.json`:**
```json
{
  "plugins": {
    "entries": {
      "mcp-client": {
        "enabled": true,
        "config": {
          "servers": {
            "apify": {
              "transport": "streamable-http",
              "url": "https://mcp.apify.com",
              "headers": {
                "Authorization": "Bearer ${APIFY_TOKEN}"
              }
            }
          }
        }
      }
    }
  }
}
```

**4. Restart:** `openclaw gateway restart`

**Expected output:**
```
[mcp-client] Connected to server: apify
[mcp-client] Server apify initialized, registered 8 tools
```

Now your agent can use tools like `apify_search_actors`, `apify_call_actor`, etc.

### Example 2: Hetzner Cloud (Stdio)

Manage Hetzner Cloud infrastructure (servers, volumes, firewalls, SSH keys) through natural language.

**1. Install the MCP server:**
```bash
pip install git+https://github.com/dkruyt/mcp-hetzner.git
```

**2. Get API token:** [Hetzner Console → Security → API Tokens](https://console.hetzner.cloud)

**3. Add to `openclaw.json`:**
```json
{
  "servers": {
    "hetzner": {
      "transport": "stdio",
      "command": "mcp-hetzner",
      "env": {
        "HCLOUD_TOKEN": "${HETZNER_API_TOKEN}"
      }
    }
  }
}
```

**4. Restart:** `openclaw gateway restart`

**Expected output:**
```
[mcp-client] Connected to server: hetzner
[mcp-client] Server hetzner initialized, registered 30 tools
```

### Example 3: Notion (Stdio)

```json
{
  "servers": {
    "notion": {
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@notionhq/notion-mcp-server"],
      "env": {
        "NOTION_API_KEY": "${NOTION_API_KEY}"
      }
    }
  }
}
```

## Configuration Reference

All server configs go under `plugins.entries.mcp-client.config.servers` in `openclaw.json`.

### Transport types

| Transport | Use case | Example servers |
|---|---|---|
| **`streamable-http`** | Remote API with single POST endpoint | Apify, Smithery Connect |
| **`stdio`** | Local subprocess, npm packages | Notion, Hetzner, Hostinger |
| **`sse`** | Remote Server-Sent Events (legacy) | Custom MCP servers |

### Server config options

```json
{
  "my-server": {
    "transport": "streamable-http",     // Required: "sse" | "stdio" | "streamable-http"
    "url": "https://...",               // Required for sse/streamable-http
    "command": "mcp-hetzner",           // Required for stdio
    "args": [],                         // Optional: command arguments (stdio)
    "headers": {},                      // Optional: HTTP headers (sse/streamable-http)
    "env": {},                          // Optional: environment variables (stdio)
    "framing": "auto"                   // Optional: "auto" | "lsp" | "newline" (stdio only)
  }
}
```

### Global config options

| Option | Default | Description |
|---|---|---|
| `toolPrefix` | `true` | Prefix tool names with server name (e.g. `hetzner_list_servers`) |
| `reconnectIntervalMs` | `30000` | Base reconnect interval (with 0.5x–1.5x jitter) |
| `connectionTimeoutMs` | `10000` | Initial connection timeout |
| `requestTimeoutMs` | `60000` | Per-request timeout for tool calls |

### Environment variable substitution

Use `${VAR_NAME}` in `headers` and `env` values. Variables are resolved from OpenClaw's `.env` file at startup.

```json
"headers": { "Authorization": "Bearer ${MY_TOKEN}" }
```

## How it works

```
MCP Server              Plugin                  OpenClaw Agent
┌─────────────┐        ┌─────────────────┐     ┌──────────────┐
│ tools/list   │◄──────│ mcp-client       │────►│ uses tools   │
│ tools/call   │◄──────│ registerTool()   │     │ naturally    │
│ SSE/stdio/   │       │ schema convert   │     │ "list my     │
│ HTTP         │       └─────────────────┘     │  servers"    │
└─────────────┘                                └──────────────┘
```

1. Plugin connects to each configured MCP server via the specified transport
2. MCP handshake: `initialize` → `notifications/initialized`
3. `tools/list` discovers available tools (with pagination support)
4. JSON Schema → TypeBox conversion, then `api.registerTool()` for each tool
5. Agent tool calls are proxied as `tools/call` JSON-RPC requests
6. On connection loss: exponential backoff with jitter → full re-handshake → re-register
7. On `notifications/tools/list_changed`: refresh with concurrency lock

## Finding MCP servers

- **[MCP Server Registry](https://registry.modelcontextprotocol.io)** — official Anthropic registry
- **[awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers)** — curated community list
- **[Glama](https://glama.ai/mcp/servers)** — searchable directory
- **[PulseMCP](https://www.pulsemcp.com)** — another directory with reviews

## JSON Schema support

The plugin converts MCP tool input schemas to TypeBox for OpenClaw's type system. This is a **safe, limited subset** — not a full JSON Schema implementation:

- ✅ Supported: `string`, `number`, `integer`, `boolean`, `array`, `object`, `null`, `enum`, `required`
- ⚠️ Falls back to `Type.Any()`: `anyOf`, `oneOf`, `allOf`, `$ref`, tuple arrays, complex compositions
- 🛡️ Safety limits: max depth 10, max 100 properties per object (prevents recursion bombs)

Complex schemas won't crash the plugin — they'll have looser input validation via `Type.Any()`.

## Troubleshooting

```bash
# Check connection status
journalctl --user -u openclaw-gateway.service | grep mcp-client

# Expected output on success:
# [mcp-client] Connected to server: myserver
# [mcp-client] Server myserver initialized, registered N tools
```

| Problem | Solution |
|---|---|
| "No servers configured" | Add at least one server to config |
| Tool name conflicts | MCP tools overlap with native OpenClaw plugins — remove one |
| SSE/HTTP timeout | Check URL, auth token, and network |
| Stdio crash | Ensure command exists (`which mcp-hetzner`, `npx --version`) |
| "Stdio startup stdout readiness timed out" | Normal for some servers — they don't emit stdout before init |
| Streamable HTTP parse error | Server may use chunked streaming (not yet supported) |

## File structure

| File | Purpose |
|---|---|
| `index.ts` | Main plugin — server lifecycle, tool registration, execution |
| `transport-sse.ts` | SSE transport (Server-Sent Events) |
| `transport-stdio.ts` | Stdio transport (subprocess, LSP/newline framing) |
| `transport-streamable-http.ts` | Streamable HTTP transport (POST, SSE response parsing) |
| `schema-convert.ts` | JSON Schema → TypeBox conversion with injectable logger |
| `types.ts` | TypeScript interfaces |
| `openclaw.plugin.json` | Plugin metadata + config schema |

## Server Catalog

This plugin includes a server installer system with pre-configured setups for popular MCP servers. Each server in the `servers/` directory comes with:

- `config.json` — OpenClaw configuration ready to merge
- `install.sh` — Setup script for dependencies
- `env_vars` — Required environment variables list
- `README.md` — Server description and usage

### Available servers

| Server | Transport | Tools | Install | Token |
|---|---|---|---|---|
| [apify](servers/apify/) | streamable-http | 8 | Hosted — nothing to install | [Get token](https://console.apify.com/account/integrations) |
| [hetzner](servers/hetzner/) | stdio | 30 | `pip install git+https://github.com/dkruyt/mcp-hetzner.git` | [Get token](https://console.hetzner.cloud) → Security → API Tokens |
| [hostinger](servers/hostinger/) | stdio | 119 | `npm install -g hostinger-api-mcp` | Hostinger dashboard → API Token |
| [notion](servers/notion/) | stdio | — | Uses npx (auto-download) | [Create integration](https://www.notion.so/my-integrations) |

Or use the installer for any of these: `./install-server.sh apify`

### Using the installer

**List available servers:**
```bash
./list-servers.sh
```

**Install a server:**
```bash
./install-server.sh <server-name>
```

**Preview what would happen:**
```bash
./install-server.sh <server-name> --dry-run
```

Example:
```bash
cd ~/.openclaw/extensions/mcp-client
./list-servers.sh
./install-server.sh apify
openclaw gateway restart
```

The installer will:
1. Run the server's installation script
2. Check for required environment variables in `~/.openclaw/.env`
3. Prompt for missing tokens/keys
4. Merge the configuration into `~/.openclaw/openclaw.json`
5. Tell you to restart the gateway

### Available servers

| Server | Transport | Tools | Description |
|---|---|---|---|
| **apify** | streamable-http | 8 | Web scraping and automation platform |
| **hetzner** | stdio | 30 | Hetzner Cloud infrastructure management |
| **hostinger** | stdio | 119 | Web hosting and domain management |
| **notion** | stdio | 6+ | Official Notion workspace integration |

### Contributing new servers

To add a new MCP server to the catalog:

1. **Create the server directory:**
   ```bash
   mkdir servers/my-server
   ```

2. **Add the required files:**
   - `config.json` — OpenClaw config (with `${VARIABLE}` substitution)
   - `install.sh` — Installation steps (make executable)
   - `env_vars` — Required variables, one per line
   - `README.md` — Brief description and setup instructions

3. **Test the installer:**
   ```bash
   ./install-server.sh my-server --dry-run
   ./install-server.sh my-server
   ```

4. **Submit a Pull Request** with your new server directory.

The installer scripts handle JSON merging, environment variable checking, and configuration validation automatically.

## Uninstall

```bash
# 1. Remove from openclaw.json (delete the mcp-client entry under plugins.entries)
# 2. Delete the plugin
rm -rf ~/.openclaw/extensions/mcp-client
# 3. Restart
openclaw gateway restart
```

## Requirements

- OpenClaw 2026.3.x+
- Node.js 22+
- **TypeBox** — provided by OpenClaw runtime (no separate install needed)

## License

MIT — [AIWerk](https://aiwerk.ch)
