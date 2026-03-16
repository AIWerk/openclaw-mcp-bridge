# Changelog

## [0.11.2] - 2026-03-16

### Fixed
- **Skill discovery**: declared `skills/` in `openclaw.plugin.json` so OpenClaw natively discovers plugin skills (no symlink needed)
- **Skill name**: updated install.sh from `add-mcp-server` to `manage-mcp-servers` (old symlinks auto-cleaned)
- **Install debug**: workspace path logged during skill symlink step

## [0.10.8] - 2026-03-15

### Fixed
- **Plugin manifest version** synced: openclaw.plugin.json now matches package.json
- **Router tool schema** expanded: added `intent`, `calls`, `batch`, `status`, `schema`, `promotions` actions and parameters so LLMs can discover all Smart Router v2 capabilities

### Added
- **configSchema** expanded with all core 2.x features: `mode`, `auth` (bearer/header/oauth2), `trust`, `toolFilter`, `maxResultChars`, `schemaCompression`, `intentRouting`, `resultCache`, `adaptivePromotion`, `maxBatchSize`, `retry`, `smartFilter`

## [0.10.7] - 2026-03-15

### Changed
- Bumped `@aiwerk/mcp-bridge` dependency to ^2.0.0 — adds HTTP auth, configurable retries, graceful shutdown

## [0.10.6] - 2026-03-15

### Changed
- Bumped `@aiwerk/mcp-bridge` dependency to ^1.9.0 — brings Smart Router v2 features: result caching, batch calls, multi-server tool resolution

## [0.10.5] - 2026-03-15

### Changed
- Renamed all internal `[mcp-client]` log prefixes to `[mcp-bridge]`
- Updated `test-config-example.json` and skill references from `mcp-client` to `openclaw-mcp-bridge`
- Cosmetic only — no breaking changes

## [0.10.4] - 2026-03-13

### Fixed
- Bumped `@aiwerk/mcp-bridge` to 1.2.2 — env var empty-string fallback (fixes #3)

## [0.10.3] - 2026-03-13

### Fixed
- Bumped `@aiwerk/mcp-bridge` to 1.2.1 — correct npm package names for tavily, google-maps, stripe (fixes #4)

## [0.10.2] - 2026-03-11

### Changed
- **Breaking refactor**: Core code extracted to `@aiwerk/mcp-bridge` (standalone package)
- Plugin is now a thin wrapper — imports all transports, router, protocol, schema from core
- Removed 8 bundled .ts files (transport-*.ts, mcp-router.ts, schema-convert.ts, protocol.ts, update-checker.ts)
- Removed duplicate `servers/` catalog — install scripts read from `@aiwerk/mcp-bridge/servers/`
- Server builds (git clone + npm build) go to `server-builds/` instead of `node_modules/`
- `toolPrefix` default changed from `"auto"` to `true` (always prefix, matching core behavior)
- Tests removed from plugin (run in core repo)

### Fixed
- Install script path resolution for servers cloned into node_modules (TS path error on VPS)

## [0.9.4] - 2026-03-11

### Added
- feat: Automatic update checker — checks npm registry on startup (non-blocking, 10s timeout)
- feat: Update notice injected into the first tool response when a newer version is available
- feat: `mcp_bridge_update` tool — agents can check for and install updates (`check_only` param for dry run)

## [0.9.3] - 2026-03-10

### Fixed
- fix: Renamed all internal `mcp-client` references to `openclaw-mcp-bridge` in scripts and plugin config

## [0.9.2] - 2026-03-10

### Fixed
- fix: Renamed plugin id from `mcp-client` to `openclaw-mcp-bridge` (breaking change for existing installs — reinstall required)

## [0.9.1] - 2026-03-10

### Fixed
- fix: Added `openclaw.extensions` field to `package.json` (required for OpenClaw plugin discovery via npm install)

## [0.9.0] - 2026-03-10 — First public release (npm)

First npm publish. All features from pre-release development included:
- Smart Router mode (~98% token reduction)
- 3 transports: stdio, SSE, streamable-http
- 12 pre-configured MCP servers with install scripts
- Lazy connect with LRU eviction and idle timeout
- Auto collision handling for tool names
- 38 tests, GitHub Actions CI (Node 20+22)

---

### Pre-release history (internal development)

## [1.6.0] - 2026-03-09

### Added
- feat: Smart Router mode (`mode: "router"`) — single mcp tool replaces all individual tools (~98% token reduction)
- feat: Lazy connect with LRU eviction and idle timeout
- feat: Per-server description field for dynamic tool descriptions
- feat: Installer mode selection (router/direct) in `install.sh` and `install.ps1`

### Fixed
- fix: Default params to `{}` when undefined (strict MCP servers)
- fix: `install-server.sh` router mode detection (no 30s timeout for lazy connect)

### Documentation
- docs: README rewrite with router as recommended mode

## [1.5.0] - 2026-03-08

### Changed
- `toolPrefix` config now accepts `true | false | "auto"` (default changed from `true` to `"auto"`)
  - `true`: always prefix tool names with server name
  - `false`: never prefix, use raw tool names (on collision, numeric suffix is added: `search_2`)
  - `"auto"`: no prefix by default, auto-prefix only on collision (recommended)
- Updated `openclaw.plugin.json` schema, `types.ts`, and `index.ts` to support new policy
- Added first GitHub release tag (`v1.5.0`)

## [1.4.2] - 2026-03-08

### Changed
- `schema-convert.ts`: Replaced CJS `require()` TypeBox loading with cached async ESM `import("@sinclair/typebox")` via `getTypeBox()`, and routed all `Type.*` usage through that module with fallback-to-`Any` handling when TypeBox is unavailable.
- `schema-convert.ts`: Added `anyOf` conversion support and created node built-in tests in `tests/schema-convert.test.ts` for string, number, object, array, union, and missing-TypeBox fallback behavior.
- `index.ts`: Removed cross-server startup registration race by keeping connection/discovery parallel but registering tools sequentially after all server initialization settles.
- `transport-sse.ts`: Fixed SSE blank-line event boundary ordering so completed events are processed before `currentEvent` reset.
- Added `tests/collision.test.ts`, `tests/env-resolve.test.ts`, `tsconfig.json`, and package test script (`npx tsx tests/*.test.ts`) for collision and env-resolution validation.

## [1.4.0] - 2026-03-08

### Changed
- `index.ts`: Switched server initialization from serial startup to parallel `Promise.allSettled()` with per-server success/failure summary logging.
- `index.ts`: Added global cross-connection tool name collision tracking. When `toolPrefix: false` collides globally, a numeric suffix is added (`search_2`, `search_3`, etc.) and warnings are logged. When `toolPrefix: "auto"` collides, server name prefix is used instead.
- `transport-sse.ts`, `transport-streamable-http.ts`: Added warning for non-localhost `http://` endpoints: `WARNING: Non-TLS connection to <host> — credentials may be transmitted in plaintext`.
- `transport-stdio.ts`: Implemented graceful shutdown in `disconnect()` by attempting JSON-RPC `close` notification, then `SIGINT`, then `SIGTERM` fallback after 2 seconds.
- `transport-sse.ts`, `transport-stdio.ts`, `transport-streamable-http.ts`: Added debug logging for unhandled MCP notifications.
- `transport-sse.ts`, `transport-streamable-http.ts`: Header environment variable resolution now treats missing `${VAR}` values as required errors (throws at startup), instead of silently substituting empty strings.
- `transport-streamable-http.ts`: `connect()` now performs a lightweight server probe (`OPTIONS`, fallback `HEAD`) and logs warnings on probe failures without blocking connection setup.
- `openclaw.plugin.json`: Added `framing` schema property (`auto | lsp | newline`) for stdio server configuration parity with `types.ts`.

## [1.3.0] - 2026-03-08

### Changed
- `transport-stdio.ts`: Added dual framing support for stdout parsing with auto-detected mode lock (`auto` -> `lsp` or `newline`) and full `Content-Length` frame handling for LSP-style stdio servers.
- `transport-sse.ts`: Hardened SSE `event: endpoint` handling by validating absolute endpoint origins against configured server origin and rejecting mismatches with warning logs.
- `schema-convert.ts`: Added schema recursion and size guards (max depth 10, max object properties 100) with fallback to `Type.Any()` and warnings for untrusted schemas.
- `index.ts`: Added sanitized tool-name collision handling with numeric suffixes (e.g., `_2`) and warning logs when collisions are detected.
- `types.ts`, `index.ts`, and all transports: Centralized JSON-RPC request ID generation via shared `nextRequestId()` utility and removed per-transport counters and caller `id: 0` placeholders.

## [1.2.0] - 2026-03-08

### Changed
- Stdio startup now waits for first `stdout` data event instead of a fixed 1000ms delay, with configurable timeout fallback via `connectionTimeoutMs` (default 5000ms).
- SSE transport now buffers multi-line SSE `data:` fields and parses them only on event boundary (blank line), fixing multi-line JSON event parsing.
- SSE `sendRequest` now rejects on HTTP non-2xx responses (`response.ok === false`) instead of only handling network errors.
- Stdio process `error` handler now rejects all pending requests and schedules reconnect, matching process exit behavior.
- All transports now handle `notifications/tools/list_changed` server notifications and trigger tool re-discovery callback flow.
- Reconnect scheduling now uses exponential backoff in all transports:
  - starts at `reconnectIntervalMs` (default 30000ms)
  - doubles on each failed attempt
  - caps at 300000ms (5 minutes)
  - resets after successful reconnection
- Tool registration flow now tracks per-connection registered tool names and handles reconnect refreshes safely.
  - Attempts to unregister previous tools if `unregisterTool` API is available.
  - Logs a warning when tool lists change and unregister is unavailable.

## [1.1.0] - 2026-03-08

### Added
- **Streamable HTTP transport** — third transport type alongside SSE and stdio
  - Simple POST-based JSON-RPC communication to a single URL
  - Automatic `mcp-session-id` header management (server returns it, client includes it in subsequent requests)
  - DELETE request on disconnect for session cleanup
  - Reconnect logic with configurable intervals
  - Request timeout support (default 60s)
  - Environment variable substitution in headers (`${ENV_VAR}`)
- New file: `transport-streamable-http.ts`

### Changed
- `types.ts` — transport union type extended with `"streamable-http"`
- `openclaw.plugin.json` — config schema updated with new transport option and validation

## [1.0.0] - 2026-03-07

### Added
- Initial release
- **SSE transport** — Server-Sent Events based MCP communication
- **stdio transport** — subprocess-based MCP communication
- JSON Schema to TypeBox conversion for tool parameter registration
- Auto-reconnect with configurable intervals
- Tool registration via OpenClaw `registerTool` API
- Environment variable substitution in headers and env config
- MCP protocol initialization and tool discovery
