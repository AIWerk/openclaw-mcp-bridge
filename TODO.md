# TODO

## ✅ Done
- [x] **npm publish** — `@aiwerk/openclaw-mcp-bridge@0.10.2`
- [x] **Standalone MCP server mode** — extracted to `@aiwerk/mcp-bridge@1.2.0` (CLI, stdio, config loader, catalog)
- [x] **Auto-reconnect on failure** — implemented in core transport-base (exponential backoff + jitter)
- [x] **Graceful server failure isolation** — failed servers don't block others, degraded state logged
- [x] **Smart Filter Phase 1** — keyword-based filtering, enabled by default (in core @aiwerk/mcp-bridge)
- [x] **13 built-in servers** — apify, atlassian, github, google-maps, hetzner, hostinger, linear, miro, notion, stripe, tavily, todoist, wise
- [x] **Community Plugins PR** — #42283 openclaw/openclaw (review pending)
- [x] **CHANGELOG.md** — full v1.0.2-v1.2.0 history

## Smart Mode (v2) — Phase 2+
- [ ] **Vector search for tool discovery** — semantic search via LanceDB/Ollama (Phase 2 in smart-router-spec)
- [ ] **Schema compression** — truncate descriptions, reduce optional params (~350→60 tokens per tool)
- [ ] **Tool call result caching** — LRU cache with configurable TTL

## Security
- [ ] **Trust levels for MCP server results** — trusted / untrusted (default) / sanitize per server
- [ ] **Tool deny list (toolFilter)** — block specific dangerous tools per server
- [ ] **Max result size limit (maxResultChars)** — cap tool response size

## Reliability
- [ ] **Configurable retries** — retry count + timeout per server (default: 2 retries, 30s)

## Distribution
- [ ] **MCP Catalog MCP server** — standalone MCP server serving the catalog (catalog.search/info/download/activate)
- [ ] **Catalog miss analytics** — log search misses for demand signal (anonymized)
- [ ] **Catalog → Bridge sync script** — one-way sync from catalog to bridge servers/ (bundled flag)
- [ ] **PR #42283 leírás fix** — shorten to one-liner per reviewer feedback

## Future
- [ ] **Transport integration tests** — E2E for SSE, stdio, streamable-http
- [ ] **Router edge case tests** — connection drops mid-call, concurrent requests, crash recovery
- [ ] **Local script wrapper MCP server** — shell/Python scripts as typed MCP tools
- [ ] **Hosted bridge** — multi-tenant on bridge.aiwerk.ch (see mcp-catalog-spec-v2.md)
