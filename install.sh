#!/bin/bash
# OpenClaw MCP Client Plugin - Installer
# Usage: curl -sL https://raw.githubusercontent.com/AIWerk/openclaw-mcp-bridge/master/install.sh | bash
set -e

PLUGIN_DIR="${HOME}/.openclaw/extensions/openclaw-mcp-bridge"
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

# 2. Install dependencies (TypeBox is required for JSON Schema conversion)
echo "📦 Installing dependencies..."
cd "$PLUGIN_DIR" && npm install --production 2>&1 | tail -1
echo ""

# 3. Choose mode
echo ""
echo "🔧 Choose plugin mode:"
echo ""
echo "  [1] Router (recommended)"
echo "      Single 'mcp' tool, ~300 tokens. Agent discovers tools on-demand."
echo "      Best for 3+ servers. Saves ~98% context tokens."
echo ""
echo "  [2] Direct"
echo "      All tools registered individually as native tools."
echo "      Simple, but ~80 tokens per tool (can add up with many servers)."
echo ""
read -r -p "Mode [1/2, default=1]: " MODE_CHOICE </dev/tty
case "$MODE_CHOICE" in
  2) PLUGIN_MODE="direct" ;;
  *) PLUGIN_MODE="router" ;;
esac
echo "  → Using $PLUGIN_MODE mode"
echo ""

# 4. Add to openclaw.json if not already present
if [ -f "$CONFIG_FILE" ]; then
  if python3 -c "
import json, sys
with open('$CONFIG_FILE') as f:
    cfg = json.load(f)
plugins = cfg.setdefault('plugins', {})
allow = plugins.setdefault('allow', [])
entries = plugins.setdefault('entries', {})

changed = False

if 'openclaw-mcp-bridge' not in allow:
    allow.append('openclaw-mcp-bridge')
    changed = True

if 'openclaw-mcp-bridge' not in entries:
    entries['openclaw-mcp-bridge'] = {
        'enabled': True,
        'config': {
            'mode': '$PLUGIN_MODE',
            'servers': {},
            'toolPrefix': True,
            'reconnectIntervalMs': 30000,
            'connectionTimeoutMs': 10000,
            'requestTimeoutMs': 60000
        }
    }
    changed = True
    print('✅ Plugin added to config (mode: $PLUGIN_MODE)')
else:
    # Update mode if plugin already exists
    existing = entries['openclaw-mcp-bridge'].setdefault('config', {})
    if existing.get('mode') != '$PLUGIN_MODE':
        existing['mode'] = '$PLUGIN_MODE'
        changed = True
        print('✅ Plugin mode updated to $PLUGIN_MODE')
    else:
        print('ℹ️  Plugin already in config (mode: $PLUGIN_MODE)')

if changed:
    with open('$CONFIG_FILE', 'w') as f:
        json.dump(cfg, f, indent=2)
sys.exit(0)
" 2>&1; then
    true
  else
    echo "⚠️  Could not update config automatically. Add openclaw-mcp-bridge to plugins manually."
  fi
else
  echo "⚠️  Config not found at $CONFIG_FILE"
fi

# Register manage-mcp-servers skill via symlink
SKILL_SOURCE="$PLUGIN_DIR/skills/manage-mcp-servers"
if [ -d "$SKILL_SOURCE" ]; then
  SKILLS_DIR=""

  # 1. Try reading workspace from openclaw.json
  if [ -f "$CONFIG_FILE" ]; then
    WORKSPACE=$(python3 -c "
import json, sys
try:
    with open('$CONFIG_FILE') as f:
        cfg = json.load(f)
    # Try all known locations for workspace
    ws = (cfg.get('workspace')
       or cfg.get('agent', {}).get('workspace')
       or cfg.get('agents', {}).get('defaults', {}).get('workspace'))
    if ws: print(ws)
except: pass
" 2>/dev/null)
    if [ -n "$WORKSPACE" ] && [ -d "$WORKSPACE" ]; then
      SKILLS_DIR="$WORKSPACE/skills"
      echo "   Found workspace: $WORKSPACE"
    fi
  fi

  # 2. Fallback: try common locations (only if workspace not found)
  if [ -z "$SKILLS_DIR" ]; then
    for CANDIDATE in "$HOME/clawd/skills" "$HOME/.openclaw/skills" "$HOME/openclaw/skills"; do
      if [ -d "$CANDIDATE" ]; then
        SKILLS_DIR="$CANDIDATE"
        break
      fi
    done
  fi

  # 3. Last resort: use ~/.openclaw/skills
  if [ -z "$SKILLS_DIR" ]; then
    SKILLS_DIR="$HOME/.openclaw/skills"
  fi

  # Create skills dir if needed and symlink
  mkdir -p "$SKILLS_DIR" 2>/dev/null
  # Clean up old skill name if present
  OLD_LINK="$SKILLS_DIR/add-mcp-server"
  [ -L "$OLD_LINK" ] && rm "$OLD_LINK" 2>/dev/null

  SKILL_LINK="$SKILLS_DIR/manage-mcp-servers"
  if [ ! -e "$SKILL_LINK" ]; then
    ln -s "$SKILL_SOURCE" "$SKILL_LINK" 2>/dev/null && \
      echo "🧠 Skill 'manage-mcp-servers' registered in $SKILLS_DIR/" || \
      echo "⚠️  Could not register skill. Run manually: ln -s $SKILL_SOURCE $SKILL_LINK"
  else
    echo "🧠 Skill 'manage-mcp-servers' already registered in $SKILLS_DIR/"
  fi
fi

echo ""
echo "✅ MCP Client Plugin installed!"
echo ""
echo "Next steps:"
echo "  1. Install an MCP server:"
echo "     cd ~/.openclaw/extensions/openclaw-mcp-bridge"
echo "     ./install-server.sh <SERVER_NAME>"
echo ""
echo "  2. Or ask your agent: 'Add the X MCP server'"
echo "     (uses the manage-mcp-servers skill)"
echo ""
echo "  Available servers: ls ~/.openclaw/extensions/openclaw-mcp-bridge/servers/"
echo ""
