# Changelog

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
