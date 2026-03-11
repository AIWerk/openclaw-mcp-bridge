# TODO

## 🔥 Standalone Mode (PRIORITY)
- [ ] **Standalone MCP server mode**
  Run the bridge as a standalone MCP server (stdio transport) so it can be used from Claude Desktop, Cursor, Cline, Windsurf, and any other MCP client — not just OpenClaw. Single config file, no OpenClaw dependency required. This is the #1 priority because it unlocks 100x the potential user base. The core (Smart Router, Server Manager, Config parser) is already framework-independent — this just adds a CLI entry point with stdio/HTTP transport.

- [ ] **MCP Catalog server**
  A standalone MCP server that serves the server catalog. Tools: `catalog.search(query, country, category)`, `catalog.info(server)`, `catalog.install(server)`. Any MCP client can discover and install servers from the catalog. Web frontend for humans alongside.

## Smart Mode (v2)
- [ ] **Dual-mode support (smart + traditional)**
  Support both modes in a single plugin via config toggle (`mode: "smart" | "traditional"`). Traditional mode registers all tools at startup as direct proxies (simple, no filtering). Smart mode uses relevance ranking and lazy activation. Users who don't want filtering complexity get immediate value; power users get intelligent routing.

- [ ] **Relevance-based tool filtering**
  Route only the most relevant tools to the agent per request. Instead of exposing all 200+ tools at once (which wastes context and confuses the model), analyze the user's intent and return a ranked subset. Configurable threshold and max tools per turn.

- [ ] **Vector search for tool discovery**
  Add semantic vector search as an alternative to keyword-based tool matching. Embed tool names and descriptions into a vector store (e.g., LanceDB), then find the best-matching tools via cosine similarity at runtime. This improves discovery when the user's phrasing doesn't match tool names literally (e.g., "send a message" → `slack_post_message`). Inspired by `openclaw-mcp-router` (lunarmoon26). Should work with local embedding models (Ollama) or API-based ones, with a zero-dependency fallback to the existing keyword matching.

- [ ] **Schema compression for tool descriptions**
  Compress tool schemas before registering them with the agent. Truncate descriptions to ~80 chars, keep only required parameters in full, and reduce optional parameters to hints. A ~350 token schema becomes ~60 tokens — significant savings when exposing many tools. Critical enabler for smart mode where dozens of tools may be presented.

- [ ] **Tool call result caching**
  Cache tool call results with configurable TTL to avoid redundant calls to downstream MCP servers. Tool *discovery* caching already exists per server — this adds caching for actual tool call responses. LRU eviction with max entries cap to bound memory usage.

## Security
- [ ] **Trust levels for MCP server results**
  Security layer for tool results. Three levels: `trusted` (results passed directly), `untrusted` (results prefixed with security warning, default), `sanitize` (HTML/scripts stripped, images removed, data URIs cleaned). Configurable per server. Protects the agent from prompt injection via MCP tool responses.

- [ ] **Tool deny list (toolFilter)**
  Allow blocking specific dangerous tools per server. Config example: `toolFilter: { deny: ["write_file", "delete_file"] }`. Prevents the agent from accessing tools that could cause harm, even if the MCP server exposes them. Useful for untrusted or overly permissive servers.

- [ ] **Max result size limit (maxResultChars)**
  Cap the character count of tool call results before passing them to the agent. Prevents a single tool response from consuming too much of the context window. Configurable globally via `defaults.maxResultChars` and per server. Truncated results get a warning suffix.

## Reliability
- [ ] **Auto-reconnect on failure**
  Currently the router disconnects idle servers after a timeout. Add automatic reconnection when a server connection dies unexpectedly (crash, network drop). On the next tool call, detect the dead connection, reconnect transparently, and retry the call. Distinct from idle timeout — this is crash recovery.

- [ ] **Graceful server failure isolation**
  A failed or unresponsive MCP server should not block or crash other servers. On connection failure, mark the server as degraded and skip it in tool routing. Log the failure, continue serving tools from healthy servers. Include proper shutdown lifecycle handling (process `beforeExit` fallback) to clean up connections on gateway stop.

- [ ] **Configurable retries**
  Add retry logic for failed tool calls with configurable retry count and timeout per server. Defaults: `retries: 2`, `timeout: 30000ms`. Handles transient network errors and server hiccups without failing the entire agent turn.

## Distribution
- [x] **npm publish** ✅ `@aiwerk/openclaw-mcp-bridge@0.9.3`

## Future
- [ ] **Submission automation (`accept-submission.sh`)**
  Automate the server addition workflow. Issue template and `install-server.sh` already exist — this script would parse a GitHub issue (from the existing Server Submission template), generate `servers/<name>/config.json`, run a test install, commit, and close the issue. Currently submissions are processed manually.

- [ ] **Transport integration tests**
  End-to-end tests for SSE, stdio, and streamable-http transports covering connect/disconnect lifecycle, automatic reconnection after drops, and graceful shutdown. `transport-base.test.ts` covers the base class — these would test real transport implementations.

- [ ] **Router edge case tests**
  Test coverage for connection drops mid-call, request timeouts, concurrent requests to the same server, and server crash recovery. `mcp-router.test.ts` has 26 tests for happy paths — these would cover failure scenarios.

- [ ] **Local script wrapper MCP server**
  Bundle local shell/Python scripts as an MCP server so they appear as typed tools with schemas instead of requiring manual `exec` calls. A single "local-tools" MCP server would wrap scripts (email, Life360, crypto, calendar checks etc.) with proper input/output schemas, making them discoverable through the smart router. Eliminates the need for TOOLS.md-style documentation — the tool schemas *are* the documentation. Could use a convention-based approach: `scripts/*.mcp.json` defines the tool name, description, parameters, and the command to run.
