# Hetzner Cloud MCP Server

Cloud infrastructure management — **[dkruyt/mcp-hetzner](https://github.com/dkruyt/mcp-hetzner)** (`mcp-hetzner`).

## What it provides

30 tools across all major Hetzner Cloud resource types:

- **Servers:** list, get, create, delete, power on/off, reboot
- **Volumes:** list, get, create, delete, attach, detach, resize
- **Firewalls:** list, get, create, delete, update, set rules, apply/remove from resources
- **SSH Keys:** list, get, create, update, delete
- **Info:** list images, server types, locations

## Requirements

- Python 3.11+
- Hetzner Cloud API token (Read & Write)

## Install

```bash
pip install --break-system-packages git+https://github.com/dkruyt/mcp-hetzner.git
```

Verify: `which mcp-hetzner` should return a path.

## Get your token

1. Go to [Hetzner Cloud Console](https://console.hetzner.cloud)
2. Select your project → Security → API Tokens → **Generate API Token**
3. Grant Read & Write permissions for full functionality

## Configuration

Add to your `openclaw.json` under `plugins.entries.mcp-client.config.servers`:

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

> **Env var note:** `.env` uses `HETZNER_API_TOKEN`; the server expects `HCLOUD_TOKEN` — the config maps them as shown above.

## Verify

After gateway restart, check logs for:
```
Server hetzner initialized, registered 30 tools
```
