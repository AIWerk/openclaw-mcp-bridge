#!/bin/bash
# OpenClaw MCP Client Plugin - Uninstaller
set -e

PLUGIN_DIR="${HOME}/.openclaw/extensions/openclaw-mcp-bridge"
CONFIG_FILE="${HOME}/.openclaw/openclaw.json"
ENV_FILE="${HOME}/.openclaw/.env"

echo "🗑️  Uninstalling OpenClaw MCP Client Plugin..."
echo ""

# 1. Remove all server tokens from .env
if [ -f "$ENV_FILE" ] && [ -d "$PLUGIN_DIR/servers" ]; then
    for env_vars_file in "$PLUGIN_DIR/servers"/*/env_vars; do
        [ -f "$env_vars_file" ] || continue
        ENV_VAR_NAME="$(head -n 1 "$env_vars_file" | tr -d '[:space:]')"
        if grep -q "^${ENV_VAR_NAME}=" "$ENV_FILE" 2>/dev/null; then
            sed -i "/^${ENV_VAR_NAME}=/d" "$ENV_FILE"
            echo "🔑 Removed ${ENV_VAR_NAME} from .env"
        fi
    done
fi

# 2. Remove skill symlink
SKILL_REMOVED=false
for skills_dir in "$PLUGIN_DIR"/../../workspace/skills "$HOME/clawd/skills" "$HOME/.openclaw/workspace/skills" "$HOME/.openclaw/skills" "$HOME/openclaw/skills"; do
    link="$skills_dir/add-mcp-server"
    if [ -L "$link" ] || [ -e "$link" ]; then
        rm -f "$link"
        echo "🧠 Removed skill symlink from $skills_dir/"
        SKILL_REMOVED=true
    fi
done
$SKILL_REMOVED || true

# 3. Backup and clean openclaw.json
if [ -f "$CONFIG_FILE" ]; then
    BACKUP_FILE="${CONFIG_FILE}.bak-$(date +%Y%m%d%H%M%S)"
    cp "$CONFIG_FILE" "$BACKUP_FILE"
    echo "📋 Backup: $BACKUP_FILE"

    python3 -c "
import json
with open('$CONFIG_FILE') as f:
    cfg = json.load(f)
changed = False
if 'openclaw-mcp-bridge' in cfg.get('plugins', {}).get('entries', {}):
    del cfg['plugins']['entries']['openclaw-mcp-bridge']
    changed = True
if 'openclaw-mcp-bridge' in cfg.get('plugins', {}).get('allow', []):
    cfg['plugins']['allow'].remove('openclaw-mcp-bridge')
    changed = True
if changed:
    with open('$CONFIG_FILE', 'w') as f:
        json.dump(cfg, f, indent=2)
        f.write('\n')
    print('📋 Removed openclaw-mcp-bridge from openclaw.json')
else:
    print('📋 openclaw-mcp-bridge not found in config (already clean)')
" 2>/dev/null
fi

# 4. Remove plugin directory
rm -rf "$PLUGIN_DIR"
echo "📦 Removed $PLUGIN_DIR"

# 5. Restart gateway
echo ""
RESTART="y"
if [ -e /dev/tty ]; then
    read -r -p "Restart gateway now? [Y/n]: " RESTART </dev/tty
fi
if [ -z "$RESTART" ] || echo "$RESTART" | grep -qi '^y'; then
    systemctl --user restart openclaw-gateway 2>/dev/null && \
        echo "✅ Gateway restarted." || \
        echo "⚠️  Auto-restart failed. Run: systemctl --user restart openclaw-gateway"
else
    echo "⏭️  Run manually: systemctl --user restart openclaw-gateway"
fi

echo ""
echo "✅ MCP Client Plugin uninstalled."
echo ""
echo "To reinstall:"
echo "  curl -sL https://raw.githubusercontent.com/AIWerk/openclaw-mcp-bridge/master/install.sh | bash"
echo ""
