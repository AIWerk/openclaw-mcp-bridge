# Changelog

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
