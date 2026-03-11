# Contributing

## 1. Easiest path: let your OpenClaw agent do it
Use the `add-mcp-server` skill to add a server end-to-end (config, install wrappers, validation, local test, optional submission issue).

## 2. Manual path: submit a server via GitHub issue
Open an issue in [`AIWerk/mcp-bridge`](https://github.com/AIWerk/mcp-bridge) (the core repo where the server catalog lives) using the server submission template.
Include full `config.json`, install method, and local test results.

## 3. Quality requirements
- Server is publicly available (open source or public API/service)
- Config secrets use `${VAR}` placeholders only (no hardcoded secrets)
- `description` is one line and lowercase
- Versions are pinned (npm `@x.y.z`, pip `==x.y.z`, docker `:x.y.z`)

## 4. Server submission issue format
Use title format:
`[Server Submission] <name> — <description>`

Provide:
- `name`
- `description`
- `transport`
- `command` or `url`
- `args` (if applicable)
- required env vars
- `credentialsUrl`
- install method(s)
- source URL and homepage
- local test result for `mcp(server="<name>", action="list")`

## 5. Review process overview
Maintainers verify legitimacy, transport correctness, env var names, install reproducibility, credentials URL, and security constraints.

Review outcomes:
- Approved: added to `servers/<name>/` in the [mcp-bridge core repo](https://github.com/AIWerk/mcp-bridge) and merged
- Needs info: feedback posted, waiting for updates
- Rejected: closed with rationale (duplicate, unmaintained, security risk, or invalid config)
