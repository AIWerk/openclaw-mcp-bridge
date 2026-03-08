# Filesystem MCP Server

Local file system access — read, write, search, and manage files and directories.

**Transport:** Stdio (npx, no install needed)  
**Auth:** None required

## Tools
- Read file contents
- Write/create files
- List directory contents
- Search files
- Move/rename files
- Get file metadata

## Installation

### 1. No token needed
This server provides access to a local directory — no API key or authentication required.

### 2. Install with the installer
```bash
cd ~/.openclaw/extensions/mcp-client
./install-server.sh filesystem
```

**Important:** After installing, edit the config to set your actual directory path:
```bash
# Edit ~/.openclaw/openclaw.json and change "/home/user/documents" to your path
```

### 3. Or manually add to openclaw.json
```json
{
  "filesystem": {
    "transport": "stdio",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/documents"]
  }
}
```

Change `/home/user/documents` to the directory you want the agent to access.

### 4. Restart and verify
```bash
openclaw gateway restart
journalctl --user -u openclaw-gateway.service | grep "filesystem"
```

## Windows

OpenClaw runs on Windows (WSL2 recommended). Adapt paths:
- Config: `%USERPROFILE%\.openclaw\openclaw.json`
- Logs: `openclaw gateway logs` (no journalctl)
- `pip`/`npm`/`npx` commands work the same on Windows

## Notes
- Uses `npx` — no global install needed
- **Security:** The server only has access to the directory you specify in the args
- You can add multiple filesystem servers with different paths:
  ```json
  "documents": { "transport": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/docs"] },
  "projects": { "transport": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/projects"] }
  ```
- Official package: [@modelcontextprotocol/server-filesystem](https://github.com/modelcontextprotocol/servers)
