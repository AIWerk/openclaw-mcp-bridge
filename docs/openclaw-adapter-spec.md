# OpenClaw MCP Adapter Specification v1.0

**Status:** Draft  
**Date:** 2026-03-15  
**Authors:** Attila Bergsmann, Jerome (AIWerk)  
**Depends on:** [Universal MCP Recipe Spec v2.0](https://github.com/AIWerk/mcp-bridge/blob/main/docs/universal-recipe-spec.md)

## 1. Overview

The OpenClaw MCP Adapter (`@aiwerk/openclaw-mcp-bridge`) is a plugin for [OpenClaw](https://github.com/openclaw/openclaw) that:

1. **Translates** Universal MCP Recipes (v2) into OpenClaw-native plugin configuration
2. **Manages** MCP server lifecycle (connect, reconnect, health check)
3. **Registers** MCP tools into the OpenClaw agent's tool namespace
4. **Routes** tool calls via direct or router mode

The adapter is the **only** component that knows about OpenClaw internals. The upstream `@aiwerk/mcp-bridge` core and `@aiwerk/mcp-catalog` are client-agnostic.

> **Plugin naming:** The plugin id is `openclaw-mcp-bridge` (since v0.10.0). Earlier versions used `mcp-client` — this was a breaking rename in 2026-03-10. All config examples in this spec use the current name.

### 1.1 Boundary

The adapter imports `@aiwerk/mcp-bridge` as a dependency. The core package owns:
- MCP protocol handling (all three transports: stdio, SSE, streamable-http)
- Tool discovery and call forwarding
- Smart filter / router mode logic
- Universal recipe format (`servers/`)

The adapter owns:
- Recipe -> OpenClaw config translation
- OpenClaw tool registration (`registerTool` API)
- Env var resolution (OpenClaw `.env` + `pass` + shell)
- `install-server.sh` (interactive install UX)
- Gateway restart and health check

```
┌──────────────────────────────────────────────────────────┐
│  @aiwerk/mcp-bridge (core, npm dependency)                │
│  - Universal recipes (servers/)                           │
│  - MCP client connections (stdio/SSE/streamable-http)     │
│  - Tool discovery & call forwarding                       │
│  - Smart filter / router mode                             │
│  - NO OpenClaw knowledge                                  │
└─────────────────────┬────────────────────────────────────┘
                      │ imported by
┌─────────────────────▼────────────────────────────────────┐
│  @aiwerk/openclaw-mcp-bridge (this plugin)                │
│  - Recipe → OpenClaw config translation                   │
│  - OpenClaw tool registration (registerTool API)          │
│  - Env var resolution (OpenClaw .env + pass + shell)      │
│  - install-server.sh (interactive install UX)             │
│  - Gateway restart & health check                         │
│  - NO direct MCP protocol handling (delegated to core)    │
└──────────────────────────────────────────────────────────┘
```

> **Note on transport layer:** MCP transport implementations (stdio, SSE, streamable-http) live in the `@aiwerk/mcp-bridge` core package. The adapter delegates all protocol handling to the core via its public API.

## 2. Configuration

### 2.1 Plugin Registration

The plugin is registered in `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "allow": ["openclaw-mcp-bridge"],
    "entries": {
      "openclaw-mcp-bridge": {
        "enabled": true,
        "config": {
          "mode": "router",
          "servers": {},
          "toolPrefix": true,
          "smartFilter": {},
          "reconnectIntervalMs": 30000,
          "connectionTimeoutMs": 10000,
          "requestTimeoutMs": 60000
        }
      }
    }
  }
}
```

### 2.2 Server Config (Native Format)

Each server entry in the OpenClaw config is the **translated output** of a Universal Recipe. The adapter converts recipe transports into this flat format:

```json
{
  "todoist": {
    "transport": "stdio",
    "command": "npx",
    "args": ["-y", "@doist/todoist-ai"],
    "env": { "TODOIST_API_KEY": "${TODOIST_API_TOKEN}" },
    "description": "task management",
    "keywords": ["productivity", "tasks", "project-management"]
  }
}
```

### 2.3 Translation Rules

| Universal Recipe (v2) | OpenClaw Native Config |
|----------------------|----------------------|
| `transports[0].type` | `transport` |
| `transports[0].command` | `command` |
| `transports[0].args` | `args` |
| `transports[0].env` | `env` |
| `transports[0].url` | `url` |
| `transports[0].headers` | `headers` |
| `transports[0].framing` | `framing` |
| `description` | `description` |
| `metadata.tags` | `keywords` (for smart filter) |
| `metadata.category` | prepended to `keywords` (deduplicated) |

**Category deduplication:** When the adapter prepends `metadata.category` to `keywords`, it checks for duplicates. If the category value already exists in the tags array, it is not added again. Example: recipe with `category: "productivity"` and `tags: ["productivity", "tasks"]` produces `keywords: ["productivity", "tasks"]`, not `["productivity", "productivity", "tasks"]`.

**Transport selection:** The adapter picks the first transport from `transports[]` that matches the OpenClaw environment. Priority:
1. `stdio` — always supported
2. `streamable-http` — supported if network available
3. `sse` — supported if network available

**Adapter overrides:** If `servers/<id>/adapters/openclaw.json` exists, its fields are deep-merged on top of the translated config (objects: recursive merge, arrays: full replacement, scalars: override wins). This allows OpenClaw-specific tweaks (e.g., Docker-based GitHub server) without modifying the universal recipe.

## 3. Environment Variable Resolution

OpenClaw has a multi-layer env resolution chain. The adapter leverages all layers:

```
Priority (high -> low):
1. OpenClaw config: env.vars section
2. Shell env (probed at startup for known API keys)
3. ~/.openclaw/.env (dotenv)
4. pass (password-store) — via generate-env.sh
```

### 3.1 Resolution Flow

```
Recipe: ${TODOIST_API_TOKEN}
    |
OpenClaw gateway: resolveConfigEnvVars()
    -> checks env.vars, shell env, .env
    -> if found: replaces with actual value
    -> if not found: literal "${TODOIST_API_TOKEN}" remains
    |
Bridge plugin: resolveEnvVars() (second pass)
    -> if ${...} pattern remains: tries process.env + dotenv direct read
    -> if still unresolved: logs warning, server won't auth
```

### 3.2 install-server.sh Env Handling

During interactive install, the script:
1. Reads `auth.envVars` from the recipe
2. Prompts the user for each value
3. Writes to `~/.openclaw/.env` (chmod 600)
4. Optionally stores in `pass` (if available)

## 4. Modes

### 4.1 Direct Mode (default)

Every tool from every server is registered individually via `api.registerTool()`:

```
Agent sees: todoist_create_task, todoist_find_tasks, github_create_issue, ...
```

**Pros:** Simple, all tools visible in system prompt  
**Cons:** Token-heavy with many servers (N servers x M tools x ~150 tokens each)

### 4.2 Router Mode

A single `mcp` meta-tool is registered. The agent calls `mcp(server="todoist", tool="create_task", params={...})`:

```
Agent sees: mcp (single tool, ~200 tokens)
```

**Pros:** ~99% token savings, scales to unlimited servers  
**Cons:** Agent must know server/tool names (discoverable via `mcp(action="list")`)

### 4.3 Smart Filter (Router Mode Extension)

When `smartFilter.enabled: true`, the router dynamically selects relevant servers based on the agent's current prompt. For smart filter configuration details, embedding strategies, and threshold tuning, see the [Smart Router Spec](./smart-router-spec.md) (if available).

```json
{
  "smartFilter": {
    "enabled": true,
    "embedding": "auto",
    "topServers": 3,
    "topTools": 10,
    "serverThreshold": 0.3,
    "toolThreshold": 0.5,
    "alwaysInclude": ["github"],
    "telemetry": false
  }
}
```

The smart filter uses `keywords` (from recipe `metadata.tags`) and `description` for semantic matching.

## 5. Installation Flow

### 5.1 install-server.sh

The install script bridges universal recipes and OpenClaw config:

```
User runs: ./install-server.sh todoist

1. Load recipe:     servers/todoist/recipe.json (v2)
                    (fallback: servers/todoist/config.json for v1)
2. Check prereqs:   node/npx/docker/uvx as needed
3. Install deps:    npm install / docker pull / git clone+build
4. Prompt auth:     Read recipe.auth.envVars -> prompt -> write .env
5. Translate:       recipe -> OpenClaw native server config
6. Apply override:  merge adapters/openclaw.json if exists
7. Merge config:    Deep-merge into ~/.openclaw/openclaw.json
8. Restart gateway: openclaw gateway restart
                    (fallback: systemctl --user restart openclaw-gateway)
9. Verify:          Check logs for server initialization
```

### 5.2 Uninstall

```
User runs: ./install-server.sh todoist --remove

1. Remove server entry from openclaw.json
2. Remove env var from .env (if recipe-managed)
3. Restart gateway
4. Keep recipe files (reinstall anytime)
```

### 5.3 Dry Run

```
User runs: ./install-server.sh todoist --dry-run

1. Show recipe info
2. Show what config would be written
3. No changes made
```

## 6. Tool Registration

### 6.1 OpenClaw API

The adapter uses the OpenClaw plugin API to register tools:

```typescript
interface OpenClawPluginApi {
  registerTool(tool: OpenClawToolDefinition): void;
  unregisterTool(name: string): void;
  pluginConfig: McpClientConfig;
  logger: OpenClawLogger;
}
```

### 6.2 Tool Naming

| `toolPrefix` | Tool name format | Example |
|---|---|---|
| `true` (default) | `<server>_<tool>` | `todoist_create_task` |
| `false` | `<tool>` | `create_task` (collision risk!) |
| `"auto"` | Prefix only on collision (experimental) | `create_task` or `todoist_create_task` |

#### 6.2.1 `"auto"` Collision Detection

The `"auto"` mode is **experimental**. Collision detection works as follows:

1. All configured servers are loaded and their tool lists collected
2. A global tool name set is built across all servers
3. If a tool name appears in more than one server, ALL instances of that name are prefixed with their server name
4. Tool names that are unique across all servers remain unprefixed

**Important:** Collision detection runs once at startup (or when a server reconnects in direct mode). It considers all configured servers, not just currently connected ones. This means tool names are deterministic for a given server configuration — they do not change based on connection order or timing.

**Caveat:** Adding or removing a server may change which tools are prefixed across the entire set. This is a known trade-off of the auto mode. For stable tool names, use `toolPrefix: true`.

### 6.3 Router Mode Tool

In router mode, a single tool is registered:

```typescript
{
  name: "mcp",
  description: "Call any MCP server tool...",
  parameters: {
    action: "list | call | refresh | status",
    server: "Server name",
    tool: "Tool name for action=call",
    params: "Tool arguments (object)"
  }
}
```

## 7. Lifecycle

### 7.1 Startup

```
Gateway starts
  -> Plugin activated (openclaw.plugin.json)
  -> Read config from openclaw.json
  -> For each server in config:
      Direct mode: connect immediately, register tools
      Router mode: lazy connect (on first mcp() call)
  -> Log: "Plugin activated with N servers configured"
```

### 7.2 Reconnection

If a server connection drops:
1. Log warning
2. Unregister tools (direct mode)
3. Wait `reconnectIntervalMs`
4. Reconnect
5. Re-register tools

### 7.3 Shutdown

```
Gateway stops / plugin disabled
  -> Disconnect all servers
  -> Unregister all tools
  -> Cleanup stdio child processes
```

## 8. Recipe v1 Compatibility

The adapter MUST support both v1 (`config.json`) and v2 (`recipe.json`) recipes during the transition period.

### 8.1 Detection

```typescript
if (recipe.schemaVersion === 2) {
  // v2: use transports[], auth, install, metadata
} else {
  // v1: use flat transport/command/args/env fields
}
```

### 8.2 v1 Passthrough

For v1 recipes, the adapter treats the config.json as already in near-native format (since v1 was designed for OpenClaw). Only `schemaVersion`, `name`, `authRequired`, `credentialsUrl`, and `homepage` are stripped before writing to openclaw.json.

## 9. Testing

> **Note:** Tests are planned but not yet implemented in the repository. The following describes the intended test matrix.

### 9.1 Unit Tests

- Recipe v2 -> native config translation
- Recipe v1 -> native config translation (backward compat)
- Adapter override merging
- Env var extraction from recipes
- Transport selection logic
- Tool prefix naming (including `"auto"` collision detection)
- Category deduplication in keywords

### 9.2 Integration Tests

- Full install flow (dry-run mode)
- Gateway config merge (no clobber)
- Server connection + tool registration
- Router mode tool discovery + call forwarding

### 9.3 CI

The existing test suite (`npm test`) covers bridge core functionality. Adapter-specific tests will live in `tests/adapter/`.

## 10. Other Client Adapters

Other client adapters follow the same pattern described in the [Universal Recipe Spec, §4](https://github.com/AIWerk/mcp-bridge/blob/main/docs/universal-recipe-spec.md#4-client-adapter-specification). Each adapter is a separate package that reads universal recipes and translates them to its client's native config format.

## Appendix A: Config Example (Full)

```json
{
  "plugins": {
    "allow": ["openclaw-mcp-bridge"],
    "entries": {
      "openclaw-mcp-bridge": {
        "enabled": true,
        "config": {
          "mode": "router",
          "servers": {
            "todoist": {
              "transport": "stdio",
              "command": "npx",
              "args": ["-y", "@doist/todoist-ai"],
              "env": { "TODOIST_API_KEY": "${TODOIST_API_TOKEN}" },
              "description": "task management",
              "keywords": ["productivity", "tasks"]
            },
            "github": {
              "transport": "stdio",
              "command": "docker",
              "args": ["run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN",
                       "ghcr.io/github/github-mcp-server"],
              "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_MCP_TOKEN}" },
              "description": "repos, issues, PRs",
              "keywords": ["development", "git", "code"]
            },
            "apify": {
              "transport": "streamable-http",
              "url": "https://mcp.apify.com/mcp",
              "headers": { "Authorization": "Bearer ${APIFY_TOKEN}" },
              "description": "web scraping & automation",
              "keywords": ["scraping", "automation", "web"]
            }
          },
          "toolPrefix": true,
          "smartFilter": {
            "enabled": true,
            "embedding": "auto",
            "topServers": 3,
            "alwaysInclude": ["github"]
          },
          "reconnectIntervalMs": 30000,
          "connectionTimeoutMs": 10000,
          "requestTimeoutMs": 60000
        }
      }
    }
  }
}
```

## Appendix B: Adapter Override Example

```
servers/github/
  recipe.json              # Universal: uses npx
  adapters/
    openclaw.json           # Override: uses Docker instead
```

`servers/github/adapters/openclaw.json`:
```json
{
  "command": "docker",
  "args": ["run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN",
           "ghcr.io/github/github-mcp-server"],
  "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_MCP_TOKEN}" }
}
```

The adapter deep-merges this over the translated recipe output. Fields not specified in the override keep their recipe-derived values. Arrays are fully replaced, not concatenated (see Universal Recipe Spec §4.5).
