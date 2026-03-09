#!/bin/bash
# OpenClaw MCP Client Plugin - Installer
# Usage: curl -sL https://raw.githubusercontent.com/AIWerk/openclaw-mcp-bridge/master/install.sh | bash
set -e

PLUGIN_DIR="${HOME}/.openclaw/extensions/mcp-client"
CONFIG_FILE="${HOME}/.openclaw/openclaw.json"

echo "📦 Installing OpenClaw MCP Client Plugin..."

# 1. Clone or update
if [ -d "$PLUGIN_DIR/.git" ]; then
  echo "⬆️  Updating existing installation..."
  cd "$PLUGIN_DIR" && git pull --ff-only
else
  echo "📥 Cloning plugin..."
  mkdir -p "$(dirname "$PLUGIN_DIR")"
  git clone https://github.com/AIWerk/openclaw-mcp-bridge.git "$PLUGIN_DIR"
fi

# 2. Add to openclaw.json if not already present
if [ -f "$CONFIG_FILE" ]; then
  if python3 -c "
import json, sys
with open('$CONFIG_FILE') as f:
    cfg = json.load(f)
plugins = cfg.setdefault('plugins', {})
allow = plugins.setdefault('allow', [])
entries = plugins.setdefault('entries', {})

changed = False

if 'mcp-client' not in allow:
    allow.append('mcp-client')
    changed = True

if 'mcp-client' not in entries:
    entries['mcp-client'] = {
        'enabled': True,
        'config': {
            'servers': {},
            'toolPrefix': True,
            'reconnectIntervalMs': 30000,
            'connectionTimeoutMs': 10000,
            'requestTimeoutMs': 60000
        }
    }
    changed = True
    print('✅ Plugin added to config')
else:
    print('ℹ️  Plugin already in config')

if changed:
    with open('$CONFIG_FILE', 'w') as f:
        json.dump(cfg, f, indent=2)
sys.exit(0)
" 2>&1; then
    true
  else
    echo "⚠️  Could not update config automatically. Add mcp-client to plugins manually."
  fi
else
  echo "⚠️  Config not found at $CONFIG_FILE"
fi

echo ""
echo "✅ MCP Client Plugin installed!"
echo ""
echo "Next steps:"
echo "  1. Add MCP servers to your config:"
echo "     nano ~/.openclaw/openclaw.json"
echo ""
echo "  Example - Filesystem server (no auth needed):"
echo '     "servers": {'
echo '       "fs": {'
echo '         "transport": "stdio",'
echo '         "command": "npx",'
echo '         "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]'
echo '       }'
echo '     }'
echo ""
echo "  2. Restart gateway: openclaw gateway restart"
echo ""
