# OpenClaw MCP Client Plugin

Bridges any [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server into OpenClaw — tools are automatically discovered and registered as native agent tools via `registerTool()`.

**Tested in production with:**
- [Apify](https://mcp.apify.com) — 8 tools (web scraping, actor management) via Streamable HTTP
- [GitHub](https://github.com/github/github-mcp-server) — 41 tools (repos, issues, PRs, CI/CD) via Stdio (Docker)
- [Hetzner Cloud](https://github.com/dkruyt/mcp-hetzner) — 30 tools (server/volume/firewall management) via Stdio
- [Hostinger](https://www.npmjs.com/package/hostinger-api-mcp) — 119 tools (hosting management) via Stdio
- [Todoist](https://github.com/Doist/todoist-ai) — 27 tools (task/project management) via Stdio (npx)
- [Tavily](https://tavily.com) — 5 tools (AI web search, extract, crawl, research) via Stdio (npx)
- [Linear](https://linear.app) — issue & project tracking via Stdio (npx)
- [Miro](https://miro.com) — whiteboard & visual collaboration via Stdio (npx)
- [Stripe](https://stripe.com) — payments & billing via Stdio (npx) — **official server**
- [Google Maps](https://developers.google.com/maps) — geocoding, places, directions via Stdio (npx) — **Anthropic reference server**
- [Wise](https://wise.com) — 20 tools (multi-currency accounts, transfers, exchange rates) via Stdio (git clone) — **community ([Szotasz](https://github.com/Szotasz/wise-mcp))**

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

### Example 3: GitHub (Stdio via Docker)

Manage GitHub repositories, issues, PRs, and CI/CD through natural language.

**1. Install:**
```bash
docker pull ghcr.io/github/github-mcp-server
```

**2. Get a Personal Access Token:** [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)

**3. Add to `.env`:**
```
GITHUB_MCP_TOKEN=ghp_your_token_here
```

**4. Add to `openclaw.json`:**
```json
"github": {
  "transport": "stdio",
  "command": "docker",
  "args": ["run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN", "ghcr.io/github/github-mcp-server"],
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_MCP_TOKEN}"
  }
}
```

**5. Restart:** `openclaw gateway restart`

**Expected output:**
```
[mcp-client] Connected to server: github
[mcp-client] Server github initialized, registered 41 tools
```

Now your agent can use tools like `github_list_issues`, `github_create_pull_request`, `github_search_code`, etc.

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
    "url": "https://...",
    "command": "mcp-hetzner",
    "args": [],
    "headers": {},
    "env": {},
    "framing": "auto"
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
| [stripe](servers/stripe/) | stdio | 28 | Nothing — runs via `npx` | [Get key](https://dashboard.stripe.com/apikeys) (test mode free) |
| [google-maps](servers/google-maps/) | stdio | 7 | Nothing — runs via `npx` | [Get key](https://console.cloud.google.com/apis/credentials) (pay-as-you-go) |
| [wise](servers/wise/) | stdio | 20 | `git clone` + `npm run build` | [Get token](https://wise.com/settings/api-tokens) (personal API token) |

Use the installer: `./install-server.sh <server-name>` (or `--dry-run` to preview)

### Contributing new servers

1. Create `servers/my-server/` with `config.json`, `install.sh`, `env_vars`, `README.md`
2. Test: `./install-server.sh my-server --dry-run`
3. Submit a Pull Request

## Uninstall

```bash
rm -rf ~/.openclaw/extensions/mcp-client
# Remove mcp-client from openclaw.json plugins.entries
openclaw gateway restart
```

## Requirements

- OpenClaw 2026.3.x+
- Node.js 22+

## License

MIT — [AIWerk](https://aiwerk.ch)
