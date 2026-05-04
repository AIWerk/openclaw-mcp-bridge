# Chrome DevTools MCP Server

Control and inspect a live Chrome browser for automation, debugging, and performance analysis.

## Requirements
- Node.js + npx
- Chrome >= 144 (stable channel)
- No API key needed

## Quick Install

### Linux / macOS
```bash
# Using mcp-bridge CLI:
mcp-bridge install chrome-devtools
```

### Windows (PowerShell)
```powershell
# Using mcp-bridge CLI:
mcp-bridge install chrome-devtools
```

### Manual Setup
1. Enable remote debugging in Chrome: open `chrome://inspect/#remote-debugging` and toggle it on
2. Add config to ~/.mcp-bridge/config.json (see config.json)
3. Restart mcp-bridge

## Connection Modes

### Auto-connect (default, recommended)
Connects to your running Chrome via native pipe. Chrome shows a permission dialog on each connection.
```json
"args": ["-y", "chrome-devtools-mcp@0.20.0", "--autoConnect"]
```

### Browser URL
Connect to Chrome running with `--remote-debugging-port=9222`. No dialog needed.
```json
"args": ["-y", "chrome-devtools-mcp@0.20.0", "--browserUrl", "http://127.0.0.1:9222"]
```

### Headless (standalone)
Launches its own headless Chrome instance. No existing browser needed.
```json
"args": ["-y", "chrome-devtools-mcp@0.20.0", "--headless"]
```

## What you get
- **Navigation** (6 tools): navigate, open/close/list/select pages, wait for content
- **Input** (9 tools): click, hover, drag, fill forms, type text, press keys, upload files, handle dialogs
- **Debugging** (5 tools): page snapshots, screenshots, JS evaluation, console messages
- **Network** (2 tools): list/inspect network requests with full request/response bodies
- **Performance** (4 tools): record traces, analyze insights, memory snapshots, Lighthouse audits
- **Emulation** (2 tools): viewport, network throttling, geolocation, dark mode

28 tools total. See [full tool reference](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md).

## Privacy Notes
- Google collects usage statistics by default. Opt out with `--no-usage-statistics`
- Performance tools may send URLs to Google CrUX API. Disable with `--no-performance-crux`

## Remove

```bash
./install-server.sh chrome-devtools --remove
```

Removes the server from config. The server recipe stays in `servers/chrome-devtools/` for easy reinstall.
