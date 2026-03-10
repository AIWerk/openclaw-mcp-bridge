# TODO

## Next
- [ ] **Relevance-based tool filtering (smart mode)**
  Route only the most relevant tools to the agent per request. Instead of exposing all 200+ tools at once (which wastes context and confuses the model), analyze the user's intent and return a ranked subset. Configurable threshold and max tools per turn.

- [ ] **Tool call result caching**
  Cache tool call results with configurable TTL to avoid redundant calls to downstream MCP servers. Tool *discovery* caching already exists per server — this adds caching for actual tool call responses. Especially useful for list/read operations that don't change frequently. Max entries cap to bound memory usage.

- [ ] **Standalone MCP server mode**
  Run the bridge as a standalone MCP server (stdio transport) so it can be used from Claude Desktop, Cursor, and other MCP clients — not just OpenClaw. Single config file, no OpenClaw dependency required.

## Future
- [ ] **Submission automation (`accept-submission.sh`)**
  Automate the server addition workflow. Issue template and `install-server.sh` already exist — this script would parse a GitHub issue (from the existing Server Submission template), generate `servers/<name>/config.json`, run a test install, commit, and close the issue. Currently submissions are processed manually.

- [ ] **Transport integration tests**
  End-to-end tests for SSE, stdio, and streamable-http transports covering connect/disconnect lifecycle, automatic reconnection after drops, and graceful shutdown. `transport-base.test.ts` covers the base class — these would test real transport implementations.

- [ ] **Router edge case tests**
  Test coverage for connection drops mid-call, request timeouts, concurrent requests to the same server, and server crash recovery. `mcp-router.test.ts` has 26 tests for happy paths — these would cover failure scenarios.
