# Hetzner Cloud MCP Server

Cloud infrastructure management — 30 tools for servers, volumes, firewalls, SSH keys, and more.

**Transport:** Stdio (local subprocess)

## Tools (30)
Servers: list, get, create, delete, power on/off, reboot
Volumes: list, get, create, delete, attach, detach, resize
Firewalls: list, get, create, delete, update, set rules, apply/remove from resources
SSH Keys: list, get, create, update, delete
Info: list images, list server types, list locations

## Installation

### 1. Install the MCP server
```bash
pip install --break-system-packages git+https://github.com/dkruyt/mcp-hetzner.git
```

Verify: `which mcp-hetzner` should return a path.

### 2. Get your API token
Go to [Hetzner Cloud Console](https://console.hetzner.cloud) → select project → Security → API Tokens → **Generate API Token** (Read & Write).

### 3. Save the token
```bash
# Option A: Add to .env directly
echo "HETZNER_API_TOKEN=your_token_here" >> ~/.openclaw/.env

# Option B: Using pass (password-store)
pass insert aiwerk/hetzner-api-token
# Then add to your generate-env.sh:
# write_secret "HETZNER_API_TOKEN" "aiwerk/hetzner-api-token"
```

### 4. Install with the installer
```bash
cd ~/.openclaw/extensions/mcp-client
./install-server.sh hetzner
```

### 5. Or manually add to openclaw.json
```json
{
  "hetzner": {
    "transport": "stdio",
    "command": "mcp-hetzner",
    "env": {
      "HCLOUD_TOKEN": "${HETZNER_API_TOKEN}"
    }
  }
}
```

### 6. Restart and verify
```bash
openclaw gateway restart
journalctl --user -u openclaw-gateway.service | grep "hetzner"
# Expected: Server hetzner initialized, registered 30 tools
```

## Notes
- Requires Python 3.11+
- The token needs Read & Write permissions for full functionality
- Source: [dkruyt/mcp-hetzner](https://github.com/dkruyt/mcp-hetzner)
