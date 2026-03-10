# TODO

## Next
- [ ] **Relevance-based tool filtering (smart mode)**
  Route only the most relevant tools to the agent per request. Instead of exposing all 200+ tools at once (which wastes context and confuses the model), analyze the user's intent and return a ranked subset. Configurable threshold and max tools per turn.

- [ ] **Tool call result caching**
  Cache tool call results with configurable TTL to avoid redundant calls to downstream MCP servers. Tool *discovery* caching already exists per server — this adds caching for actual tool call responses. Especially useful for list/read operations that don't change frequently. Max entries cap to bound memory usage.

- [ ] **Standalone MCP server mode**
  Run the bridge as a standalone MCP server (stdio transport) so it can be used from Claude Desktop, Cursor, and other MCP clients — not just OpenClaw. Single config file, no OpenClaw dependency required.

- [ ] **npm publish**
  Publish to npm so users can install with `openclaw plugins install mcp-bridge` instead of cloning the repo. Includes proper package.json metadata, prepublish build step, and versioned releases.

- [ ] **Auto-reconnect on failure**
  Currently the router disconnects idle servers after a timeout. Add automatic reconnection when a server connection dies unexpectedly (crash, network drop). On the next tool call, detect the dead connection, reconnect transparently, and retry the call. Distinct from idle timeout — this is crash recovery.

- [ ] **Trust levels for MCP server results**
  Security layer for tool results. Three levels: `trusted` (results passed directly), `untrusted` (results prefixed with security warning, default), `sanitize` (HTML/scripts stripped, images removed, data URIs cleaned). Configurable per server. Protects the agent from prompt injection via MCP tool responses.

- [ ] **Tool deny list (toolFilter)**
  Allow blocking specific dangerous tools per server. Config example: `toolFilter: { deny: ["write_file", "delete_file"] }`. Prevents the agent from accessing tools that could cause harm, even if the MCP server exposes them. Useful for untrusted or overly permissive servers.

- [ ] **Max result size limit (maxResultChars)**
  Cap the character count of tool call results before passing them to the agent. Prevents a single tool response from consuming too much of the context window. Configurable globally via `defaults.maxResultChars` and per server. Truncated results get a warning suffix.

- [ ] **Configurable retries**
  Add retry logic for failed tool calls with configurable retry count and timeout per server. Defaults: `retries: 2`, `timeout: 30000ms`. Handles transient network errors and server hiccups without failing the entire agent turn.

- [ ] **Args env var resolution**
  The `${VAR}` syntax currently only resolves in `config.env` fields (via `resolveEnv`). It does NOT resolve in `args` fields — e.g. `--token ${MIRO_API_TOKEN}` is passed literally. Implement args interpolation to match env behavior. Known bug causing Miro 401 on Pico VPS.

## Future
- [ ] **Submission automation (`accept-submission.sh`)**
  Automate the server addition workflow. Issue template and `install-server.sh` already exist — this script would parse a GitHub issue (from the existing Server Submission template), generate `servers/<name>/config.json`, run a test install, commit, and close the issue. Currently submissions are processed manually.

- [ ] **Transport integration tests**
  End-to-end tests for SSE, stdio, and streamable-http transports covering connect/disconnect lifecycle, automatic reconnection after drops, and graceful shutdown. `transport-base.test.ts` covers the base class — these would test real transport implementations.

- [ ] **Router edge case tests**
  Test coverage for connection drops mid-call, request timeouts, concurrent requests to the same server, and server crash recovery. `mcp-router.test.ts` has 26 tests for happy paths — these would cover failure scenarios.
