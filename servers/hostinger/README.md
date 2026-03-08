# Hostinger MCP Server

Web hosting management — 119 tools for domains, hosting, emails, DNS, SSL, and website management.

**Transport:** Stdio (local subprocess)

## Tools (119)
Covers the full Hostinger API: domain management, hosting accounts, email accounts, DNS records, SSL certificates, backups, databases, file management, and more.

## Installation

### 1. Install the MCP server
```bash
npm install -g hostinger-api-mcp
```

Verify: `which hostinger-api-mcp` should return a path.

### 2. Get your API token
Go to your Hostinger dashboard → Account → API Token, or check [Hostinger API docs](https://developers.hostinger.com).

### 3. Save the token
```bash
# Option A: Add to .env directly
echo "HOSTINGER_API_TOKEN=your_token_here" >> ~/.openclaw/.env

# Option B: Using pass (password-store)
pass insert aiwerk/hostinger-api-token
```

### 4. Install with the installer
```bash
cd ~/.openclaw/extensions/mcp-client
./install-server.sh hostinger
```

### 5. Or manually add to openclaw.json
```json
{
  "hostinger": {
    "transport": "stdio",
    "command": "hostinger-api-mcp",
    "env": {
      "API_TOKEN": "${HOSTINGER_API_TOKEN}"
    }
  }
}
```

### 6. Restart and verify
```bash
openclaw gateway restart
journalctl --user -u openclaw-gateway.service | grep "hostinger"
# Expected: Server hostinger initialized, registered 119 tools
```

## Notes
- Requires Node.js 24+ (according to Hostinger docs, but works with Node 22)
- Source: [hostinger-api-mcp on npm](https://www.npmjs.com/package/hostinger-api-mcp)
