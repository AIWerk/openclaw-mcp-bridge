# OpenClaw MCP Client Plugin

Bridges any [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server into OpenClaw — tools are automatically discovered and made available to the agent.

**Two modes:**
- **Router mode** (recommended) — single `mcp` tool, ~300 tokens. Agent discovers tools on-demand via `action=list`.
- **Direct mode** — all tools registered individually as native tools. Simple, but heavy (~80 tokens per tool × N tools).

**Tested in production with:**
- [Apify](https://mcp.apify.com) — 8 tools (web scraping, actor management) via Streamable HTTP
- [GitHub](https://github.com/github/github-mcp-server) — 41 tools (repos, issues, PRs, CI/CD) via Stdio (Docker)
- [Hetzner Cloud](https://github.com/dkruyt/mcp-hetzner) — 30 tools (server/volume/firewall management) via Stdio
- [Hostinger](https://www.npmjs.com/package/hostinger-api-mcp) — 119 tools (hosting management) via Stdio
- [Todoist](https://github.com/Doist/todoist-ai) — 27 tools (task/project management) via Stdio (npx)
- [Tavily](https://tavily.com) — 5 tools (AI web search, extract, crawl, research) via Stdio (npx)
- [Linear](https://linear.app) — issue & project tracking via Stdio (npx)
- [Miro](https://miro.com) — whiteboard & visual collaboration via Stdio (npx)
- [Notion](https://www.notion.so) — 22 tools (pages, databases, blocks, search) via Stdio (npx) — **official server**
- [Stripe](https://stripe.com) — payments & billing via Stdio (npx) — **official server**
- [Google Maps](https://developers.google.com/maps) — geocoding, places, directions via Stdio (npx) — **Anthropic reference server**
- [Wise](https://wise.com) — 20 tools (multi-currency accounts, transfers, exchange rates) via Stdio (git clone) — **community ([Szotasz](https://github.com/Szotasz/wise-mcp))**

## Smart Router Mode (recommended)

With 10+ MCP servers, direct mode can consume 15,000–20,000 tokens per message just for tool definitions. Router mode solves this:

```
Agent                    MCP Bridge Plugin (in-process)              MCP Servers
┌──────────┐            ┌──────────────────────────┐            ┌──────────────┐
│          │  mcp(...)  │  McpRouter                │  tools/call │  hetzner     │
│  sees 1  │───────────►│  1. Validate server/tool  │───────────►│  todoist     │
│  tool    │            │  2. Lazy connect if needed │            │  github      │
│          │◄───────────│  3. Dispatch & respond     │◄───────────│  stripe      │
│          │  result    │                           │            │  ...         │
└──────────┘            └──────────────────────────┘            └──────────────┘
```

### Token savings

| Mode | Tools in context | ~Tokens |
|------|-----------------|---------|
| Direct (N servers) | all tools | ~15,000–20,000 |
| **Router** | **1** | **~300** |
| Savings | | **~98%** |

### How the agent uses it

```
// Step 1: Discover tools on a server
mcp(server="todoist", action="list")
→ { tools: [{ name: "find-tasks", description: "...", requiredParams: ["query"] }, ...] }

// Step 2: Call a specific tool
mcp(server="todoist", tool="find-tasks", params={ query: "MCP" })
→ { result: { tasks: [...] } }

// Refresh cached tool list (e.g. after server update)
mcp(server="todoist", action="refresh")
```

### Router features

- **Lazy connect** — servers start on first request, not at boot
- **Tool cache** — `tools/list` fetched once per server, cached until refresh
- **LRU eviction** — max 5 concurrent connections (configurable), least-recently-used disconnects
- **Idle timeout** — 10 min idle → auto-disconnect (configurable)
- **Dynamic description** — tool description auto-generated from server names + descriptions in config
- **Structured errors** — 5 error types: `unknown_server`, `unknown_tool`, `connection_failed`, `mcp_error`, `invalid_params`

### Enable router mode

Add `"mode": "router"` and optional `"description"` per server:

```json
{
  "plugins": {
    "entries": {
      "mcp-client": {
        "enabled": true,
        "config": {
          "mode": "router",
          "routerIdleTimeoutMs": 600000,
          "routerMaxConcurrent": 5,
          "servers": {
            "todoist": {
              "transport": "stdio",
              "description": "task management",
              "command": "npx",
              "args": ["-y", "@doist/todoist-ai"],
              "env": { "TODOIST_API_KEY": "${TODOIST_API_TOKEN}" }
            },
            "hetzner": {
              "transport": "stdio",
              "description": "cloud infrastructure",
              "command": "mcp-hetzner",
              "env": { "HCLOUD_TOKEN": "${HETZNER_API_TOKEN}" }
            }
          }
        }
      }
    }
  }
}
```

The agent sees: *"Call any MCP server tool. Servers: todoist (task management), hetzner (cloud infrastructure). Use action='list' with a server name to see available tools and required parameters."*

## Features

- **Two modes** — Router (1 tool, on-demand) or Direct (all tools registered)
- **Three transports** — SSE, Stdio, and Streamable HTTP
- **Auto-discovery** — `tools/list` → tools available via router dispatch or native registration
- **Schema conversion** — JSON Schema → TypeBox (safe subset, complex schemas fall back to `Type.Any()`)
- **Reconnection** — exponential backoff with jitter, full protocol re-init
- **Bidirectional stdio framing** — auto-detects LSP Content-Length or newline, configurable
- **Env var substitution** — `${MY_TOKEN}` in headers/env resolved from OpenClaw .env
- **Memory-safe** — pending requests cleaned up on reconnect, no leaked timeouts

## Installation

### Method 1: Clone (recommended)

```bash
git clone https://github.com/AIWerk/openclaw-mcp-bridge.git \
  ~/.openclaw/extensions/mcp-client
```

### Method 2: Install script

```bash
# Review first:
curl -sL https://raw.githubusercontent.com/AIWerk/openclaw-mcp-bridge/master/install.sh | less
# Then run:
curl -sL https://raw.githubusercontent.com/AIWerk/openclaw-mcp-bridge/master/install.sh | bash
```

### Method 3: Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/AIWerk/openclaw-mcp-bridge/master/install.ps1 | iex
```

### After installation

1. Add the plugin entry to `~/.openclaw/openclaw.json` (see Configuration below)
2. Restart the gateway: `openclaw gateway restart`
3. Check logs: `journalctl --user -u openclaw-gateway.service | grep mcp-client`

## Getting Started

### Example 1: Apify (Streamable HTTP, Router mode)

```json
{
  "plugins": {
    "entries": {
      "mcp-client": {
        "enabled": true,
        "config": {
          "mode": "router",
          "servers": {
            "apify": {
              "transport": "streamable-http",
              "description": "web scraping & automation",
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

Get token: [Apify Console → Settings → Integrations](https://console.apify.com/account/integrations)

### Example 2: Hetzner Cloud (Stdio)

```bash
pip install git+https://github.com/dkruyt/mcp-hetzner.git
```

```json
"hetzner": {
  "transport": "stdio",
  "description": "cloud infrastructure",
  "command": "mcp-hetzner",
  "env": { "HCLOUD_TOKEN": "${HETZNER_API_TOKEN}" }
}
```

Get token: [Hetzner Console → Security → API Tokens](https://console.hetzner.cloud)

### Example 3: GitHub (Stdio via Docker)

```bash
docker pull ghcr.io/github/github-mcp-server
```

```json
"github": {
  "transport": "stdio",
  "description": "repos, issues, PRs",
  "command": "docker",
  "args": ["run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN", "ghcr.io/github/github-mcp-server"],
  "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_MCP_TOKEN}" }
}
```

Get token: [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)

## Configuration Reference

All server configs go under `plugins.entries.mcp-client.config.servers` in `openclaw.json`.

### Transport types

| Transport | Use case | Example servers |
|---|---|---|
| **`streamable-http`** | Remote API with single POST endpoint | Apify, Smithery Connect |
| **`stdio`** | Local subprocess, npm/Docker | GitHub, Hetzner, Hostinger, Todoist, Tavily, Linear, Miro |
| **`sse`** | Remote Server-Sent Events (legacy) | Custom MCP servers |

### Server config options

```json
{
  "my-server": {
    "transport": "streamable-http",
    "description": "what this server does",
    "url": "https://...",
    "command": "mcp-hetzner",
    "args": [],
    "headers": {},
    "env": {},
    "framing": "auto"
  }
}
```

| Option | Description |
|---|---|
| `transport` | `"stdio"`, `"sse"`, or `"streamable-http"` |
| `description` | Human-readable description (used in router mode tool description) |
| `url` | URL for SSE/HTTP transports |
| `command` | Command for stdio transport |
| `args` | Command arguments for stdio |
| `headers` | HTTP headers (SSE/HTTP) |
| `env` | Environment variables for subprocess |
| `framing` | Stdio framing: `"auto"` (default), `"lsp"`, or `"newline"` |

### Global config options

| Option | Default | Description |
|---|---|---|
| `mode` | `"direct"` | `"router"` (recommended) or `"direct"` |
| `toolPrefix` | `"auto"` | Direct mode: `true` = always prefix, `false` = never (numeric suffix on collision), `"auto"` = prefix on collision |
| `routerIdleTimeoutMs` | `600000` | Router: disconnect idle servers after this time (10 min) |
| `routerMaxConcurrent` | `5` | Router: max concurrent server connections (LRU eviction) |
| `reconnectIntervalMs` | `30000` | Base reconnect interval (with jitter) |
| `connectionTimeoutMs` | `10000` | Initial connection timeout |
| `requestTimeoutMs` | `60000` | Per-request timeout for tool calls |

### Environment variable substitution

Use `${VAR_NAME}` in `headers` and `env` values. Variables are resolved from OpenClaw's `.env` file at startup.

```json
"headers": { "Authorization": "Bearer ${MY_TOKEN}" }
```

## How it works

### Router mode
```
Agent ──mcp(server, tool, params)──► McpRouter ──tools/call──► MCP Server
                                     │ lazy connect
                                     │ cache tools/list
                                     │ LRU eviction
                                     │ idle timeout
```

### Direct mode
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
4. **Router:** tools cached, dispatched via single `mcp` tool — **Direct:** JSON Schema → TypeBox, `api.registerTool()` each
5. Agent tool calls proxied as `tools/call` JSON-RPC requests
6. On connection loss: exponential backoff → full re-handshake → cache/re-register
7. On `notifications/tools/list_changed`: refresh with concurrency lock

## Finding MCP servers

- **[MCP Server Registry](https://registry.modelcontextprotocol.io)** — official Anthropic registry
- **[awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers)** — curated community list
- **[Glama](https://glama.ai/mcp/servers)** — searchable directory
- **[PulseMCP](https://www.pulsemcp.com)** — another directory with reviews

## JSON Schema support

The plugin converts MCP tool input schemas to TypeBox for OpenClaw's type system (direct mode). This is a **safe, limited subset**:

- ✅ Supported: `string`, `number`, `integer`, `boolean`, `array`, `object`, `null`, `enum`, `required`
- ⚠️ Falls back to `Type.Any()`: `anyOf`, `oneOf`, `allOf`, `$ref`, tuple arrays, complex compositions
- 🛡️ Safety limits: max depth 10, max 100 properties per object

In router mode, schemas are not converted — the agent receives param hints (name + required flag) via `action=list` and passes params directly.

## Server Catalog

Pre-configured setups for popular MCP servers. Each server in `servers/` includes config, install script, env vars list, and docs.

### Available servers

| Server | Transport | Tools | Install | Token |
|---|---|---|---|---|
| [apify](servers/apify/) | streamable-http | 8 | Hosted — nothing to install | [Get token](https://console.apify.com/account/integrations) |
| [github](servers/github/) | stdio | 41 | `docker pull ghcr.io/github/github-mcp-server` | [Create PAT](https://github.com/settings/personal-access-tokens/new) |
| [hetzner](servers/hetzner/) | stdio | 30 | `pip install git+https://github.com/dkruyt/mcp-hetzner.git` | [Get token](https://console.hetzner.cloud) → Security → API Tokens |
| [hostinger](servers/hostinger/) | stdio | 119 | `npm install -g hostinger-api-mcp` | Hostinger dashboard → API Token |
| [todoist](servers/todoist/) | stdio | 27 | Nothing — runs via `npx` | [Get token](https://app.todoist.com/app/settings/integrations/developer) |
| [tavily](servers/tavily/) | stdio | 5 | Nothing — runs via `npx` | [Get key](https://app.tavily.com/home) (free: 1000 req/mo) |
| [linear](servers/linear/) | stdio | 19 | `npm install -g linear-mcp` | [Get key](https://linear.app/settings/account/security) (free: 250 issues) |
| [miro](servers/miro/) | stdio | 6 | Nothing — runs via `npx` | [Get token](https://miro.com/app/settings/user-profile/apps) (free plan works) |
| [notion](servers/notion/) | stdio | 22 | Nothing — runs via `npx` | [Get token](https://www.notion.so/profile/integrations) (create internal integration) |
| [stripe](servers/stripe/) | stdio | 28 | Nothing — runs via `npx` | [Get key](https://dashboard.stripe.com/apikeys) (test mode free) |
| [google-maps](servers/google-maps/) | stdio | 7 | Nothing — runs via `npx` | [Get key](https://console.cloud.google.com/apis/credentials) (pay-as-you-go) |
| [wise](servers/wise/) | stdio | 20 | `git clone` + `npm run build` | [Get token](https://wise.com/settings/api-tokens) (personal API token) |

Use the installer: `./install-server.sh <server-name>` (or `--dry-run` to preview)

### Contributing new servers

1. Create `servers/my-server/` with `config.json`, `install.sh`, `env_vars`, `README.md`
2. Test: `./install-server.sh my-server --dry-run`
3. Submit a Pull Request

## Troubleshooting

```bash
# Check connection status
journalctl --user -u openclaw-gateway.service | grep mcp-client

# Router mode — expected output:
# [mcp-client] Plugin activated with 11 servers configured
# (no "registered N tools" — connections are lazy!)

# Direct mode — expected output:
# [mcp-client] Connected to server: myserver
# [mcp-client] Server myserver initialized, registered N tools
```

| Problem | Solution |
|---|---|
| "No servers configured" | Add at least one server to config |
| Tool name conflicts (direct) | MCP tools overlap with native OpenClaw plugins — use router mode or remove one |
| SSE/HTTP timeout | Check URL, auth token, and network |
| Stdio crash | Ensure command exists (`which mcp-hetzner`, `npx --version`) |
| "Stdio startup stdout readiness timed out" | Normal for some servers — they don't emit stdout before init |
| `invalid_params` with no args | Some MCP servers require `params: {}` even with no arguments |

## Uninstall

```bash
rm -rf ~/.openclaw/extensions/mcp-client
# Remove mcp-client from openclaw.json plugins.entries
openclaw gateway restart
```

## Requirements

- OpenClaw 2026.3.x+
- Node.js 22+

> **Note:** `@sinclair/typebox` is vendored in `node_modules/` intentionally (zero-install design). Users don't need to run `npm install` — the plugin works immediately after cloning. This is the only runtime dependency.

## License

MIT — [AIWerk](https://aiwerk.ch)
