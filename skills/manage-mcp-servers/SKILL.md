---
name: manage-mcp-servers
description: Add, remove, list, or manage MCP servers in the OpenClaw MCP bridge. Use when installing new servers, removing existing ones, listing available/installed servers, checking server status, or troubleshooting MCP connection issues.
---

# manage-mcp-servers

Use this skill for any MCP server management task: install, remove, list, status, troubleshoot.

## Trigger Conditions

Activate when requests mention:
- adding/installing a new MCP server
- removing/uninstalling an MCP server
- listing available or installed servers
- checking MCP server status or health
- troubleshooting MCP connection errors
- "what MCP servers do I have?"

## Key Paths

```
PLUGIN_DIR=~/.openclaw/extensions/openclaw-mcp-bridge
SCRIPT=$PLUGIN_DIR/scripts/install-server.sh
SERVERS=$PLUGIN_DIR/servers/
CONFIG=~/.openclaw/openclaw.json
ENV=~/.openclaw/.env
```

## Actions

### List available servers (catalog)

```bash
ls $PLUGIN_DIR/servers/
```

Or use the MCP tool:
```
mcp(action="status")
```

### List installed servers

```
mcp(action="status")
```

Shows connected servers with tool counts.

### Install a server

**If in catalog:**
```bash
bash $PLUGIN_DIR/scripts/install-server.sh <name>
```

This handles: backup, config update, env var prompts, gateway restart.

**If NOT in catalog:** Follow the "Add new server" flow below.

### Remove a server

```bash
bash $PLUGIN_DIR/scripts/install-server.sh <name> --remove
```

This handles:
- Backup of openclaw.json
- Remove server entry from config
- Remove env var from .env (if applicable)
- Prompt for gateway restart

### Check server health

```
mcp(server="<name>", action="list")
```

If this returns tools, the server is healthy. If it fails:
- Check if the server process is running
- Check env vars are set in ~/.openclaw/.env
- Check gateway logs: `journalctl --user -u openclaw-gateway.service -n 50`

## Add New Server Flow (not in catalog)

### 1. Verify source
Confirm target: GitHub URL, npm package, PyPI package, Docker image, or remote endpoint.

### 2. Build config from docs
1. Read README; extract: name, description, transport, command/url, args, env, auth.
2. Transport heuristics:
   - `npx`/`node`/`python`/`docker run -i` -> `stdio`
   - URL + SSE -> `sse`
   - Single HTTP endpoint -> `streamable-http`
3. If unsure about transport/command/args: **ask, don't guess**.

### 3. Create server files

Create `servers/<name>/recipe.json` (v2 format preferred):

```json
{
  "id": "<name>",
  "schemaVersion": 2,
  "name": "<display name>",
  "description": "<one-line>",
  "recipeVersion": "1.0.0",
  "metadata": {
    "category": "<category>",
    "tags": ["<tag1>", "<tag2>"],
    "homepage": "<url>",
    "license": "<license>"
  },
  "transports": [{
    "type": "stdio|sse|streamable-http",
    "command": "<command>",
    "args": ["<args>"],
    "env": { "<VAR>": "${<VAR>}" }
  }],
  "auth": {
    "required": true,
    "type": "api-key",
    "envVars": ["<VAR>"],
    "credentialsUrl": "<url>",
    "bootstrap": "env-only"
  }
}
```

### 4. Security validation
- Command allowlist: `npx`, `node`, `python`, `python3`, `pip`, `uvx`, `docker`, `go`, `deno`, `bun`
- Blocked: `curl|bash`, `curl|sh`, `wget|bash`, `sudo`, piped remote execution
- Verify package exists before config: `npm view <pkg> description`

### 5. Install and test

```bash
bash $PLUGIN_DIR/scripts/install-server.sh <name>
```

Test: `mcp(server="<name>", action="list")`

On failure: restore backup, restart, report error, retry up to 3x.

### 6. Optional: community submission
Offer to submit to AIWerk catalog:
- GitHub issue on `AIWerk/openclaw-mcp-bridge` with label `server-submission`
- Include recipe, test result, source URL

## Troubleshooting

### Server won't connect
1. Check env vars: `grep <VAR> ~/.openclaw/.env`
2. Check logs: `journalctl --user -u openclaw-gateway.service -n 50 | grep mcp`
3. Test command manually: `<command> <args>` in terminal

### OOM kill (out of memory)
- Check: `journalctl --user -u openclaw-gateway.service | grep -i oom`
- Docker servers use more RAM. Prefer npx/node over docker when possible.
- Remove heavy servers: `bash $PLUGIN_DIR/scripts/install-server.sh <name> --remove`

### "Update available" message
- Run: `openclaw plugins install @aiwerk/openclaw-mcp-bridge`
- This updates both the plugin and the core bridge library.

## Version Pinning
Always prefer pinned versions:
- npm: `package@x.y.z`
- pip: `package==x.y.z`
- docker: `image:x.y.z`
