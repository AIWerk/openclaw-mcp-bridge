# TODO

## ✅ Done
- [x] **npm publish** — `@aiwerk/openclaw-mcp-bridge@0.10.2`
- [x] **Standalone MCP server mode** — extracted to `@aiwerk/mcp-bridge@1.0.2` (CLI, stdio, config loader, catalog)
- [x] **Auto-reconnect on failure** — implemented in core transport-base (exponential backoff + jitter)
- [x] **Graceful server failure isolation** — failed servers don't block others, degraded state logged

## Smart Mode (v2)
- [ ] **Relevance-based tool filtering** — route only relevant tools per request
- [ ] **Vector search for tool discovery** — semantic search via LanceDB/Ollama (inspired by lunarmoon26/openclaw-mcp-router)
- [ ] **Schema compression** — truncate descriptions, reduce optional params (~350→60 tokens per tool)
- [ ] **Tool call result caching** — LRU cache with configurable TTL

## Security
- [ ] **Trust levels for MCP server results** — trusted / untrusted (default) / sanitize per server
- [ ] **Tool deny list (toolFilter)** — block specific dangerous tools per server
- [ ] **Max result size limit (maxResultChars)** — cap tool response size

## Reliability
- [ ] **Configurable retries** — retry count + timeout per server (default: 2 retries, 30s)

## Distribution
- [ ] **MCP Catalog server** — standalone MCP server serving the catalog (catalog.search/info/install)
- [ ] **Submission automation** — parse GitHub issue → generate config → test → commit → close

## Future
- [ ] **Transport integration tests** — E2E for SSE, stdio, streamable-http
- [ ] **Router edge case tests** — connection drops mid-call, concurrent requests, crash recovery
- [ ] **Local script wrapper MCP server** — shell/Python scripts as typed MCP tools
