#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPENCLAW_DIR="${HOME}/.openclaw"
OPENCLAW_JSON="${OPENCLAW_DIR}/openclaw.json"
ENV_FILE="${OPENCLAW_DIR}/.env"

# Resolve servers directory: prefer core package, fallback to local
if [[ -d "$SCRIPT_DIR/node_modules/@aiwerk/mcp-bridge/servers" ]]; then
    SERVERS_BASE="$SCRIPT_DIR/node_modules/@aiwerk/mcp-bridge/servers"
elif [[ -d "$SCRIPT_DIR/servers" ]]; then
    SERVERS_BASE="$SCRIPT_DIR/servers"
else
    echo "Error: No servers catalog found." >&2
    exit 1
fi

usage() {
    echo "Usage: $0 <server-name> [--dry-run] [--remove]"
    echo ""
    echo "Available servers:"
    for server_dir in "$SERVERS_BASE"/*; do
        [[ -d "$server_dir" ]] && echo "  - $(basename "$server_dir")"
    done
    exit 1
}

[[ $# -eq 0 ]] && usage

SERVER_NAME="$1"
DRY_RUN=false
REMOVE=false
shift
while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run) DRY_RUN=true ;;
        --remove)  REMOVE=true ;;
    esac
    shift
done

SERVER_DIR="$SERVERS_BASE/$SERVER_NAME"
if [[ ! -d "$SERVER_DIR" ]]; then
    echo "Error: Server '$SERVER_NAME' not found."
    usage
fi

# Build artifacts (cloned repos) go into the plugin dir, not node_modules
SERVER_BUILD_DIR="$SCRIPT_DIR/server-builds/$SERVER_NAME"
mkdir -p "$SCRIPT_DIR/server-builds"

SERVER_TITLE="$(tr '-' ' ' <<<"$SERVER_NAME" | awk '{for(i=1;i<=NF;i++){$i=toupper(substr($i,1,1))substr($i,2)};print}')"
SERVER_CONFIG_FILE="$SERVER_DIR/config.json"
ENV_VARS_FILE="$SERVER_DIR/env_vars"

require_cmd() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "❌ Missing required command: $1"
        exit 1
    fi
}

get_token_url() {
    case "$SERVER_NAME" in
        apify)       echo "https://console.apify.com/settings/integrations" ;;
        github)      echo "https://github.com/settings/tokens" ;;
        google-maps) echo "https://console.cloud.google.com/apis/credentials" ;;
        hetzner)     echo "https://console.hetzner.cloud/" ;;
        hostinger)   echo "https://hpanel.hostinger.com/api" ;;
        linear)      echo "https://linear.app/settings/api" ;;
        miro)        echo "https://miro.com/app/settings/user-profile/apps" ;;
        notion)      echo "https://www.notion.so/my-integrations" ;;
        stripe)      echo "https://dashboard.stripe.com/apikeys" ;;
        tavily)      echo "https://app.tavily.com/home" ;;
        todoist)     echo "https://app.todoist.com/app/settings/integrations/developer" ;;
        wise)        echo "https://wise.com/settings/api-tokens" ;;
        *)           echo "" ;;
    esac
}

check_prerequisites() {
    case "$SERVER_NAME" in
        github)
            require_cmd docker ;;
        linear|wise|hetzner)
            require_cmd node; require_cmd npm ;;
        *)
            require_cmd node; require_cmd npx ;;
    esac
}

install_dependencies() {
    case "$SERVER_NAME" in
        github)
            echo "Pulling GitHub MCP server Docker image..."
            docker pull ghcr.io/github/github-mcp-server ;;
        linear)
            echo "Installing @anthropic-pb/linear-mcp-server globally..."
            npm install -g @anthropic-pb/linear-mcp-server ;;
        wise)
            local clone_dir="$SERVER_BUILD_DIR/mcp-server"
            if [ -d "$clone_dir/.git" ]; then
                echo "Updating wise mcp-server..."; git -C "$clone_dir" pull --ff-only
            else
                echo "Cloning wise mcp-server..."; git clone https://github.com/Szotasz/wise-mcp.git "$clone_dir"
            fi
            echo "Building wise mcp-server..."
            (cd "$clone_dir" && npm install && npm run build) ;;
        hetzner)
            local clone_dir="$SERVER_BUILD_DIR/mcp-server"
            if [ -d "$clone_dir/.git" ]; then
                echo "Updating hetzner mcp-server..."; git -C "$clone_dir" pull --ff-only
            else
                echo "Cloning hetzner mcp-server..."; git clone https://github.com/dkruyt/mcp-hetzner.git "$clone_dir"
            fi
            echo "Building hetzner mcp-server..."
            (cd "$clone_dir" && npm install && npm run build) ;;
    esac
}

resolve_path_override() {
    case "$SERVER_NAME" in
        linear)
            local npm_root; npm_root="$(npm root -g)"
            if [ -f "$npm_root/@anthropic-pb/linear-mcp-server/dist/index.js" ]; then
                echo "$npm_root/@anthropic-pb/linear-mcp-server/dist/index.js"
            else
                echo "$npm_root/@anthropic-pb/linear-mcp-server/build/index.js"
            fi ;;
        wise)   echo "$SERVER_BUILD_DIR/mcp-server/dist/cli.js" ;;
        hetzner) echo "$SERVER_BUILD_DIR/mcp-server/dist/index.js" ;;
        *)      echo "" ;;
    esac
}

# ========================================
# REMOVE MODE
# ========================================
if [[ "$REMOVE" == "true" ]]; then
    echo "========================================"
    echo "Removing ${SERVER_TITLE} MCP Server"
    echo "========================================"

    if [[ ! -f "$OPENCLAW_JSON" ]]; then
        echo "❌ Config not found: $OPENCLAW_JSON"
        exit 1
    fi

    # Check if server exists in config
    HAS_SERVER=$(python3 -c "
import json
with open('$OPENCLAW_JSON') as f:
    cfg = json.load(f)
servers = cfg.get('plugins',{}).get('entries',{}).get('openclaw-mcp-bridge',{}).get('config',{}).get('servers',{})
print('yes' if '$SERVER_NAME' in servers else 'no')
" 2>/dev/null)

    if [[ "$HAS_SERVER" != "yes" ]]; then
        echo "ℹ️  Server '$SERVER_NAME' not found in config. Nothing to remove."
        exit 0
    fi

    # Backup
    BACKUP_FILE="${OPENCLAW_JSON}.bak-$(date +%Y%m%d%H%M%S)"
    cp "$OPENCLAW_JSON" "$BACKUP_FILE"
    echo "Backup: ${BACKUP_FILE}"

    # Remove server entry from config (keep servers/<name>/ directory)
    python3 -c "
import json
with open('$OPENCLAW_JSON') as f:
    cfg = json.load(f)
servers = cfg['plugins']['entries']['openclaw-mcp-bridge']['config']['servers']
del servers['$SERVER_NAME']
with open('$OPENCLAW_JSON', 'w') as f:
    json.dump(cfg, f, indent=2)
    f.write('\n')
print('✅ Removed $SERVER_NAME from config')
print('ℹ️  Server recipe kept in servers/$SERVER_NAME/ (reinstall anytime)')
" 2>/dev/null

    # Remove env var from .env if exists
    if [[ -f "$ENV_VARS_FILE" ]] && [[ -s "$ENV_VARS_FILE" ]] && [[ -f "$ENV_FILE" ]]; then
        ENV_VAR_NAME="$(head -n 1 "$ENV_VARS_FILE" | tr -d '[:space:]')"
        if grep -q "^${ENV_VAR_NAME}=" "$ENV_FILE" 2>/dev/null; then
            sed -i "/^${ENV_VAR_NAME}=/d" "$ENV_FILE"
            echo "🔑 Removed ${ENV_VAR_NAME} from ${ENV_FILE}"
        fi
    fi

    # Restart
    echo ""
    RESTART="y"
    if [ -e /dev/tty ]; then
        read -r -p "Restart gateway now? [Y/n]: " RESTART </dev/tty
    fi
    if [[ -z "$RESTART" || "$RESTART" =~ ^[Yy]$ ]]; then
        systemctl --user restart openclaw-gateway 2>/dev/null || {
            echo "⚠️  Auto-restart failed. Run: systemctl --user restart openclaw-gateway"
            exit 0
        }
        sleep 3
        if systemctl --user is-active --quiet openclaw-gateway 2>/dev/null; then
            echo "✅ Gateway restarted. ${SERVER_TITLE} removed."
        else
            echo "❌ Gateway failed to start! Restoring backup..."
            cp "$BACKUP_FILE" "$OPENCLAW_JSON"
            systemctl --user restart openclaw-gateway 2>/dev/null
            echo "Restored from backup."
        fi
    else
        echo "⏭️  Run manually: systemctl --user restart openclaw-gateway"
    fi
    exit 0
fi

# ========================================
# INSTALL MODE
# ========================================
echo "========================================"
echo "Installing ${SERVER_TITLE} MCP Server"
echo "========================================"

if [[ "$DRY_RUN" == "true" ]]; then
    echo "[DRY RUN] Server: $SERVER_NAME"
    [[ -f "$ENV_VARS_FILE" ]] && echo "[DRY RUN] Env var: $(cat "$ENV_VARS_FILE")"
    echo "[DRY RUN] Config:"; cat "$SERVER_CONFIG_FILE"
    exit 0
fi

# 1. Check prerequisites
check_prerequisites

# 2. Install server-specific dependencies
install_dependencies

# 3. Get API token
if [[ -f "$ENV_VARS_FILE" ]] && [[ -s "$ENV_VARS_FILE" ]]; then
    ENV_VAR_NAME="$(head -n 1 "$ENV_VARS_FILE" | tr -d '[:space:]')"

    TOKEN_URL="$(get_token_url)"
    [[ -n "$TOKEN_URL" ]] && echo "Get your API token here: ${TOKEN_URL}"

    TOKEN=""
    while [ -z "$TOKEN" ]; do
        read -r -p "Enter your ${SERVER_TITLE} API token: " TOKEN </dev/tty
        [[ -z "$TOKEN" ]] && echo "Token cannot be empty."
    done

    # Write to .env
    mkdir -p "$OPENCLAW_DIR"
    touch "$ENV_FILE"
    chmod 600 "$ENV_FILE"

    if grep -q "^${ENV_VAR_NAME}=" "$ENV_FILE" 2>/dev/null; then
        echo "${ENV_VAR_NAME} already exists in ${ENV_FILE}."
        read -r -p "Overwrite with new token? [y/N]: " OVERWRITE </dev/tty
        if [[ "$OVERWRITE" =~ ^[Yy]$ ]]; then
            sed -i "/^${ENV_VAR_NAME}=/d" "$ENV_FILE"
            echo "${ENV_VAR_NAME}=${TOKEN}" >> "$ENV_FILE"
            echo "✅ Updated ${ENV_VAR_NAME} in ${ENV_FILE}"
        else
            echo "Keeping existing value."
        fi
    else
        echo "${ENV_VAR_NAME}=${TOKEN}" >> "$ENV_FILE"
        echo "✅ Saved ${ENV_VAR_NAME} to ${ENV_FILE}"
    fi
fi

# 4. Backup and merge openclaw.json
mkdir -p "$(dirname "$OPENCLAW_JSON")"
[[ ! -f "$OPENCLAW_JSON" ]] && echo "{}" > "$OPENCLAW_JSON"

BACKUP_FILE="${OPENCLAW_JSON}.bak-$(date +%Y%m%d%H%M%S)"
cp "$OPENCLAW_JSON" "$BACKUP_FILE"
echo "Backup: ${BACKUP_FILE}"

PATH_OVERRIDE="$(resolve_path_override)"

python3 - "$OPENCLAW_JSON" "$SERVER_CONFIG_FILE" "$SERVER_NAME" "$PATH_OVERRIDE" <<'PY'
import json, sys

openclaw_path, server_cfg_path, server_name, path_override = sys.argv[1:5]

with open(openclaw_path, "r", encoding="utf-8") as f:
    raw = f.read().strip()
    cfg = json.loads(raw) if raw else {}

with open(server_cfg_path, "r", encoding="utf-8") as f:
    server_cfg = json.load(f)

if path_override:
    args = server_cfg.get("args")
    if isinstance(args, list):
        for idx, value in enumerate(args):
            if isinstance(value, str) and value.startswith("path/to/"):
                args[idx] = path_override

plugins = cfg.setdefault("plugins", {})
allow = plugins.setdefault("allow", [])
if "openclaw-mcp-bridge" not in allow:
    allow.append("openclaw-mcp-bridge")
entries = plugins.setdefault("entries", {})
mcp_client = entries.setdefault("openclaw-mcp-bridge", {})
mcp_client.setdefault("enabled", True)
mcp_cfg = mcp_client.setdefault("config", {})
mcp_cfg.setdefault("toolPrefix", True)
mcp_cfg.setdefault("reconnectIntervalMs", 30000)
mcp_cfg.setdefault("connectionTimeoutMs", 10000)
mcp_cfg.setdefault("requestTimeoutMs", 60000)
servers = mcp_cfg.setdefault("servers", {})
servers[server_name] = server_cfg

with open(openclaw_path, "w", encoding="utf-8") as f:
    json.dump(cfg, f, indent=2)
    f.write("\n")

print(f"✅ Configuration merged for: {server_name}")
PY

# 5. Gateway restart
echo ""
read -r -p "Restart gateway now? [Y/n]: " RESTART </dev/tty
if [[ -z "$RESTART" || "$RESTART" =~ ^[Yy]$ ]]; then
    systemctl --user restart openclaw-gateway 2>/dev/null || {
        echo "⚠️  Auto-restart failed. Run: systemctl --user restart openclaw-gateway"
        exit 0
    }
    echo "Waiting for gateway startup..."
    CONFIRMED=false
    ROUTER_MODE=false
    for i in 1 2 3 4 5 6; do
        sleep 5
        if ! systemctl --user is-active --quiet openclaw-gateway 2>/dev/null; then
            echo "❌ Gateway failed to start!"
            journalctl --user -u openclaw-gateway --since "1 min ago" --no-pager 2>/dev/null | grep -iE "error|fail|missing" | head -5
            echo "Full logs: journalctl --user -u openclaw-gateway --since '1 min ago' --no-pager"
            exit 1
        fi
        # Router mode: servers connect lazily, just check plugin loaded
        if journalctl --user -u openclaw-gateway --since "1 min ago" --no-pager 2>/dev/null | grep -qi "Plugin activated with.*servers configured"; then
            CONFIRMED=true
            ROUTER_MODE=true
            break
        fi
        # Direct mode: server connects at boot
        if journalctl --user -u openclaw-gateway --since "1 min ago" --no-pager 2>/dev/null | grep -qi "Server ${SERVER_NAME} initialized"; then
            CONFIRMED=true
            break
        fi
        # Check if server explicitly failed
        if journalctl --user -u openclaw-gateway --since "1 min ago" --no-pager 2>/dev/null | grep -qi "Startup failed: ${SERVER_NAME}"; then
            echo "❌ ${SERVER_TITLE} MCP Server failed to start!"
            journalctl --user -u openclaw-gateway --since "1 min ago" --no-pager 2>/dev/null | grep -i "$SERVER_NAME" | tail -5
            exit 1
        fi
    done
    if $CONFIRMED; then
        if $ROUTER_MODE; then
            echo "✅ ${SERVER_TITLE} configured! (Router mode — server connects on first use)"
        else
            echo "✅ ${SERVER_TITLE} MCP Server installed and running!"
        fi
    else
        echo "⚠️  Gateway running but plugin not confirmed after 30s. Check: journalctl --user -u openclaw-gateway -f"
    fi
else
    echo "⏭️  Run manually: systemctl --user restart openclaw-gateway"
fi
