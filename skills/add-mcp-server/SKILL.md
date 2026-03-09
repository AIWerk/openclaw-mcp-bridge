---
name: add-mcp-server
description: Add a new MCP server to the OpenClaw MCP bridge catalog by deriving config from upstream docs, validating security constraints, testing install safely, and optionally preparing a community submission issue.
---

# add-mcp-server

Use this skill when the user asks to add/install/set up an MCP server not already in the catalog.

## Trigger Conditions

Activate when requests mention:
- adding a new MCP server
- installing a specific MCP server into the bridge
- setting up MCP access for a service/tool not in `servers/`

## Flow (Spec 4.2-4.6)

### 4.2 Trigger and scope
1. Confirm target server and source (GitHub URL, npm package, PyPI package, Docker image, or remote endpoint URL).
2. If the user gives only a vague name, search and propose candidate source URLs before writing files.

### 4.3 Build config from docs
1. Read README first; then package metadata/examples if needed.
2. Extract: `name`, `description`, `transport`, `command`/`url`, `args`, `env`, `headers`, install method(s), auth requirements, credentials URL, homepage, license.
3. Transport heuristics:
- `npx`/`node`/`python`/`docker run -i` -> `stdio`
- URL + SSE docs or `/sse` -> `sse`
- single HTTP endpoint -> `streamable-http`
4. Confidence rule:
- If unsure about `transport`, `command`, or `args`, ask the user and wait.
- Do not guess.

### 4.4 Create server files
Create `servers/<name>/config.json`:

```json
{
  "schemaVersion": 1,
  "name": "<name>",
  "description": "<one-line description>",
  "transport": "stdio|sse|streamable-http",
  "command": "<command for stdio>",
  "url": "<url for sse/http>",
  "args": ["<arg1>", "<arg2>"],
  "env": {
    "<ENV_VAR>": "${<ENV_VAR>}"
  },
  "headers": {
    "Authorization": "Bearer ${API_TOKEN}"
  },
  "install": {
    "npm": "npm install -g <pkg>@<version>",
    "pip": "pip install <pkg>==<version>",
    "docker": "docker pull <image>:<tag>"
  },
  "authRequired": true,
  "credentialsUrl": "<api-key page>",
  "homepage": "<project homepage>",
  "license": "<license if known>"
}
```

Create `servers/<name>/install.sh`:

```bash
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SERVER_NAME="$(basename "$(dirname "$0")")"
exec "$DIR/install-server.sh" "$SERVER_NAME" "$@"
```

Create `servers/<name>/install.ps1`:

```powershell
$serverDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverName = Split-Path -Leaf $serverDir
$root = Split-Path -Parent (Split-Path -Parent $serverDir)
& "$root\install-server.ps1" $serverName @args
```

### 4.5 Security validation
Before writing or executing config commands, enforce:
- Command allowlist: `npx`, `node`, `python`, `python3`, `pip`, `uvx`, `docker`, `go`, `deno`, `bun`
- Blocked patterns: `curl|bash`, `curl|sh`, `wget|bash`, `wget|sh`, any piped remote execution, `sudo`
- If command is outside allowlist, ask user for explicit approval before continuing.

### 4.6 Install, test, submit, rollback
1. Backup `openclaw.json` before modifying config.
2. Install dependencies using pinned versions (avoid `latest` / unpinned installs).
3. Add server entry and restart gateway.
4. Test with `mcp(server="<name>", action="list")`.
5. If `authRequired: true` and creds are missing:
- skip tools/list success requirement
- verify process starts or endpoint is reachable
- tell user to set credentials and rerun tools/list
6. On failure:
- restore `openclaw.json` backup
- restart gateway
- report error/logs
- retry up to 3 total attempts, then stop
7. If successful, offer community submission:
- title: `[Server Submission] <name> — <description>`
- include config, install method, test result, source URL
- use issue flow (not direct PR)
- Submission method (try in order):
  a. **GitHub MCP** — `mcp(server="github", tool="issue_write", ...)` on `AIWerk/openclaw-mcp-bridge`
  b. **GitHub CLI** — `gh issue create --repo AIWerk/openclaw-mcp-bridge --title "..." --body "..." --label server-submission`
  c. **Prefilled URL** — generate and present a clickable link for the user to open manually:
     `https://github.com/AIWerk/openclaw-mcp-bridge/issues/new?title=<url-encoded>&body=<url-encoded>&labels=server-submission`
- If none of the above succeed, show the issue body as copyable text and link to the new issue page.

## Version Pinning
Always prefer pinned versions:
- npm: `package@x.y.z`
- pip: `package==x.y.z`
- docker: `image:x.y.z`
