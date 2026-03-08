# Changelog

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
- `index.ts`: Added global cross-connection tool name collision tracking. When `toolPrefix: false` collides globally, tool names are auto-prefixed with server name and warnings are logged.
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
