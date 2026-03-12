# @aiwerk/openclaw-mcp-bridge

OpenClaw plugin for [MCP Bridge](https://github.com/AIWerk/mcp-bridge) — connect any MCP server to your OpenClaw agent.

This is a thin wrapper around [@aiwerk/mcp-bridge](https://www.npmjs.com/package/@aiwerk/mcp-bridge) that handles OpenClaw tool registration, lifecycle, and configuration.

## Install

```bash
openclaw plugins install @aiwerk/openclaw-mcp-bridge
```

## Quick Start

```bash
# 1. Install the plugin
openclaw plugins install @aiwerk/openclaw-mcp-bridge

# 2. Install a server from the catalog
~/.openclaw/extensions/openclaw-mcp-bridge/install-server.sh todoist

# 3. Restart the gateway
openclaw gateway restart
```

The install script prompts for your API key and configures everything automatically.

## Configuration

The plugin config lives in `~/.openclaw/openclaw.json` under `plugins.entries.openclaw-mcp-bridge.config`:

```json
{
  "plugins": {
    "entries": {
      "openclaw-mcp-bridge": {
        "config": {
          "mode": "router",
          "servers": {
            "todoist": {
              "transport": "stdio",
              "command": "npx",
              "args": ["-y", "@doist/todoist-ai"],
              "env": { "TODOIST_API_KEY": "${TODOIST_API_TOKEN}" },
              "description": "Task management"
            }
          },
          "toolPrefix": true
        }
      }
    }
  }
}
```

Environment variables are resolved from `~/.openclaw/.env` and system env.

## Modes

| Mode | How it works | Best for |
|------|-------------|----------|
| `direct` (default) | All tools registered individually (`todoist_find_tasks`, etc.) | Few servers, simpler models |
| `router` | Single `mcp` tool — agent discovers and calls server tools through it | 3+ servers, saves ~99% tool tokens |

## Server Catalog

```bash
# List available servers
~/.openclaw/extensions/openclaw-mcp-bridge/list-servers.sh

# Install interactively
~/.openclaw/extensions/openclaw-mcp-bridge/install-server.sh <server>

# Available: todoist, github, notion, stripe, linear, google-maps,
#            hetzner, miro, wise, tavily, apify
```

## Docker Sandbox

If you run OpenClaw with Docker sandbox enabled (`agents.defaults.sandbox.mode: "all"` or `"non-main"`), plugin-registered tools are **not included** in the default sandbox tool allowlist. You need to explicitly allow them:

```json
{
  "tools": {
    "sandbox": {
      "tools": {
        "allow": ["group:openclaw", "mcp", "mcp_bridge_update"]
      }
    }
  }
}
```

- `group:openclaw` — keeps all built-in OpenClaw tools
- `mcp` — the MCP Bridge router tool
- `mcp_bridge_update` — the plugin update tool

You can verify with `openclaw sandbox explain --json` — check that `mcp` appears in `sandbox.tools.allow`.

> **Note:** Without sandbox (`sandbox.mode: "off"`), no extra config is needed — plugin tools are available automatically.

## Update

```bash
# Check for updates (via the agent)
mcp_bridge_update(check_only=true)

# Install update
openclaw plugins update @aiwerk/openclaw-mcp-bridge
openclaw gateway restart
```

## Architecture

```
OpenClaw Agent
    │
    ├── mcp tool (router mode)
    │   └── @aiwerk/openclaw-mcp-bridge (this plugin)
    │       └── @aiwerk/mcp-bridge (core)
    │           ├── todoist (stdio)
    │           ├── github (stdio)
    │           └── notion (stdio)
    │
    └── other tools...
```

The plugin handles:
- Tool registration with OpenClaw (`registerTool` / `unregisterTool`)
- Lifecycle (`activate` / `deactivate`)
- Update notifications (injected into tool responses)
- OpenClaw config integration (`openclaw.json`)

The core handles:
- MCP protocol (initialize, tools/list, tools/call)
- Transport management (stdio, SSE, streamable-http)
- Router / direct mode multiplexing
- Schema conversion, reconnection, error handling

## Standalone Usage

Don't use OpenClaw? Use the core package directly with Claude Desktop, Cursor, Windsurf, or any MCP client:

```bash
npm install -g @aiwerk/mcp-bridge
mcp-bridge init
mcp-bridge install todoist
mcp-bridge
```

See [@aiwerk/mcp-bridge](https://github.com/AIWerk/mcp-bridge) for details.

## License

MIT — [AIWerk](https://aiwerk.ch)
