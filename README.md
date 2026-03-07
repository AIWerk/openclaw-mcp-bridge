# OpenClaw MCP Client Plugin

An OpenClaw plugin that acts as an MCP (Model Context Protocol) client, connecting to external MCP servers and exposing their tools as native OpenClaw agent tools.

## Features

- **SSE Transport**: Connect to MCP servers via HTTP Server-Sent Events
- **Stdio Transport**: Connect to local MCP servers via subprocess stdio
- **Tool Registration**: Automatically exposes MCP server tools as OpenClaw tools
- **Schema Conversion**: Converts JSON Schema to TypeBox schemas for parameter validation
- **Error Handling**: Graceful error handling that doesn't crash the gateway
- **Environment Variables**: Support for environment variable substitution in configuration
- **Auto-reconnection**: Automatic reconnection on connection loss

## Configuration

Add to your `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "mcp-client": {
        "enabled": true,
        "config": {
          "servers": {
            "apify": {
              "transport": "sse",
              "url": "https://mcp.apify.com/sse",
              "headers": {
                "Authorization": "Bearer ${APIFY_TOKEN}"
              }
            },
            "filesystem": {
              "transport": "stdio",
              "command": "npx",
              "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
            }
          },
          "toolPrefix": true,
          "reconnectIntervalMs": 30000,
          "connectionTimeoutMs": 10000
        }
      }
    }
  }
}
```

### Configuration Options

- **servers**: Map of server configurations
  - **transport**: `"sse"` or `"stdio"`
  - **url**: Endpoint URL (for SSE transport)
  - **headers**: HTTP headers (for SSE transport, supports `${ENV_VAR}` substitution)
  - **command/args/env**: Process configuration (for stdio transport)
- **toolPrefix**: Whether to prefix tool names with server name (default: true)
- **reconnectIntervalMs**: Auto-reconnect interval (default: 30000)
- **connectionTimeoutMs**: Initial connection timeout (default: 10000)

## Environment Variables

Set environment variables for authentication tokens:
```bash
export APIFY_TOKEN=your_token_here
```

Then use in configuration:
```json
{
  "headers": {
    "Authorization": "Bearer ${APIFY_TOKEN}"
  }
}
```

## Tool Naming

With `toolPrefix: true` (default), MCP tools are exposed as:
- `apify_google_maps_scraper` (for `google_maps_scraper` tool from `apify` server)
- `filesystem_read_file` (for `read_file` tool from `filesystem` server)

With `toolPrefix: false`, tools keep their original names (risk of conflicts).

## Architecture

```
MCP Server              OpenClaw Plugin         Agent
┌─────────────┐        ┌─────────────────┐     ┌──────────┐
│ tools/list   │◄──────│ mcp-client       │────►│ Jerome   │
│ tools/call   │◄──────│ plugin           │     │ uses the │
│ SSE/stdio    │       │ registerTool()   │     │ tools    │
└─────────────┘        └─────────────────┘     └──────────┘
```

## File Structure

- `index.ts` - Main plugin entry point
- `types.ts` - TypeScript type definitions  
- `transport-sse.ts` - Server-Sent Events transport implementation
- `transport-stdio.ts` - Subprocess stdio transport implementation
- `schema-convert.ts` - JSON Schema to TypeBox conversion utilities
- `openclaw.plugin.json` - Plugin metadata and configuration schema

## Installation

The plugin is already installed. To activate:

1. Add configuration to `~/.openclaw/openclaw.json`
2. Set required environment variables 
3. Restart the OpenClaw gateway: `openclaw gateway restart`

## Supported MCP Servers

- **Apify**: Web scraping and automation tools
- **@modelcontextprotocol/server-filesystem**: File system operations
- **@modelcontextprotocol/server-git**: Git repository operations  
- **@modelcontextprotocol/server-sqlite**: SQLite database operations

See [MCP Server Registry](https://github.com/modelcontextprotocol/servers) for more servers.

## Troubleshooting

Check OpenClaw logs for connection status:
```bash
openclaw gateway logs | grep mcp-client
```

Common issues:
- Invalid environment variable substitution
- MCP server not responding on configured endpoint
- Network connectivity issues for SSE transport
- Missing dependencies for stdio transport

## Development

Based on the MCP Client Plugin Spec v1.0. See `~/clawd/docs/mcp-client-plugin-spec.md` for detailed implementation requirements.