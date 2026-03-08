#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_NAME="$(basename "$SCRIPT_DIR")"
SERVER_TITLE="$(tr '-' ' ' <<<"$SERVER_NAME" | awk '{for(i=1;i<=NF;i++){ $i=toupper(substr($i,1,1)) substr($i,2)}; print}')"
OPENCLAW_DIR="${HOME}/.openclaw"
ENV_FILE="${OPENCLAW_DIR}/.env"
OPENCLAW_JSON="${OPENCLAW_DIR}/openclaw.json"
SERVER_CONFIG_FILE="${SCRIPT_DIR}/config.json"
ENV_VARS_FILE="${SCRIPT_DIR}/env_vars"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

get_token_url() {
  case "$SERVER_NAME" in
    apify) echo "https://console.apify.com/settings/integrations" ;;
    github) echo "https://github.com/settings/tokens" ;;
    google-maps) echo "https://console.cloud.google.com/apis/credentials" ;;
    hetzner) echo "https://console.hetzner.cloud/" ;;
    hostinger) echo "https://hpanel.hostinger.com/api" ;;
    linear) echo "https://linear.app/settings/api" ;;
    miro) echo "https://miro.com/app/settings/user-profile/apps" ;;
    stripe) echo "https://dashboard.stripe.com/apikeys" ;;
    tavily) echo "https://app.tavily.com/home" ;;
    todoist) echo "https://app.todoist.com/app/settings/integrations/developer" ;;
    wise) echo "https://wise.com/settings/api-tokens" ;;
    *) echo "" ;;
  esac
}

check_prerequisites() {
  case "$SERVER_NAME" in
    github)
      require_cmd docker
      ;;
    linear)
      require_cmd node
      require_cmd npm
      ;;
    wise|hetzner)
      require_cmd git
      require_cmd node
      require_cmd npm
      ;;
    *)
      require_cmd node
      require_cmd npx
      ;;
  esac
}

install_server_dependencies() {
  case "$SERVER_NAME" in
    github)
      echo "Pulling GitHub MCP server Docker image..."
      docker pull ghcr.io/github/github-mcp-server
      ;;
    linear)
      echo "Installing @anthropic-pb/linear-mcp-server globally..."
      npm install -g @anthropic-pb/linear-mcp-server
      ;;
    wise)
      local clone_dir="${HOME}/.openclaw/extensions/mcp-client/servers/wise/mcp-server"
      mkdir -p "$(dirname "$clone_dir")"
      if [ -d "$clone_dir/.git" ]; then
        echo "Updating wise mcp-server source..."
        git -C "$clone_dir" pull --ff-only
      else
        echo "Cloning wise mcp-server source..."
        git clone https://github.com/Szotasz/wise-mcp.git "$clone_dir"
      fi
      echo "Building wise mcp-server..."
      (cd "$clone_dir" && npm install && npm run build)
      ;;
    hetzner)
      local clone_dir="${HOME}/.openclaw/extensions/mcp-client/servers/hetzner/mcp-server"
      mkdir -p "$(dirname "$clone_dir")"
      if [ -d "$clone_dir/.git" ]; then
        echo "Updating hetzner mcp-server source..."
        git -C "$clone_dir" pull --ff-only
      else
        echo "Cloning hetzner mcp-server source..."
        git clone https://github.com/dkruyt/mcp-hetzner.git "$clone_dir"
      fi
      echo "Building hetzner mcp-server..."
      (cd "$clone_dir" && npm install && npm run build)
      ;;
    *)
      ;;
  esac
}

resolve_path_override() {
  case "$SERVER_NAME" in
    linear)
      local npm_root
      npm_root="$(npm root -g)"
      if [ -f "$npm_root/@anthropic-pb/linear-mcp-server/dist/index.js" ]; then
        echo "$npm_root/@anthropic-pb/linear-mcp-server/dist/index.js"
      elif [ -f "$npm_root/@anthropic-pb/linear-mcp-server/build/index.js" ]; then
        echo "$npm_root/@anthropic-pb/linear-mcp-server/build/index.js"
      else
        echo "$npm_root/@anthropic-pb/linear-mcp-server/dist/index.js"
      fi
      ;;
    wise)
      echo "${HOME}/.openclaw/extensions/mcp-client/servers/wise/mcp-server/dist/cli.js"
      ;;
    hetzner)
      echo "${HOME}/.openclaw/extensions/mcp-client/servers/hetzner/mcp-server/dist/index.js"
      ;;
    *)
      echo ""
      ;;
  esac
}

echo "========================================"
echo "Installing ${SERVER_TITLE} MCP Server"
echo "========================================"

if [ ! -f "$ENV_VARS_FILE" ]; then
  echo "Missing env_vars file in ${SCRIPT_DIR}"
  exit 1
fi

ENV_VAR_NAME="$(head -n 1 "$ENV_VARS_FILE" | tr -d '[:space:]')"
if [ -z "$ENV_VAR_NAME" ]; then
  echo "env_vars file does not contain a variable name"
  exit 1
fi

check_prerequisites
install_server_dependencies

TOKEN_URL="$(get_token_url)"
echo "Get your API token here: ${TOKEN_URL}"
TOKEN=""
while [ -z "$TOKEN" ]; do
  read -r -p "Enter your API token: " TOKEN
  if [ -z "$TOKEN" ]; then
    echo "Token cannot be empty."
  fi
done

mkdir -p "$OPENCLAW_DIR"
touch "$ENV_FILE"
if ! grep -q "^${ENV_VAR_NAME}=" "$ENV_FILE"; then
  echo "${ENV_VAR_NAME}=${TOKEN}" >> "$ENV_FILE"
  echo "Added ${ENV_VAR_NAME} to ${ENV_FILE}"
else
  echo "${ENV_VAR_NAME} already exists in ${ENV_FILE}; leaving existing value unchanged"
fi
chmod 600 "$ENV_FILE"

mkdir -p "$(dirname "$OPENCLAW_JSON")"
if [ ! -f "$OPENCLAW_JSON" ]; then
  echo "{}" > "$OPENCLAW_JSON"
fi

BACKUP_FILE="${OPENCLAW_JSON}.bak-$(date +%Y%m%d%H%M%S)"
cp "$OPENCLAW_JSON" "$BACKUP_FILE"
echo "Backup created: ${BACKUP_FILE}"

PATH_OVERRIDE="$(resolve_path_override)"
python3 - "$OPENCLAW_JSON" "$SERVER_CONFIG_FILE" "$SERVER_NAME" "$PATH_OVERRIDE" <<'PY'
import json
import sys

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
if "mcp-client" not in allow:
    allow.append("mcp-client")
entries = plugins.setdefault("entries", {})
mcp_client = entries.get("mcp-client")
if not isinstance(mcp_client, dict):
    mcp_client = {}
    entries["mcp-client"] = mcp_client

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
PY

echo "Updated ${OPENCLAW_JSON} for server ${SERVER_NAME}"

echo ""
read -r -p "Restart gateway now? [Y/n] " RESTART_ANSWER
if [ -z "$RESTART_ANSWER" ] || [ "$RESTART_ANSWER" = "Y" ] || [ "$RESTART_ANSWER" = "y" ]; then
  systemctl --user restart openclaw-gateway 2>/dev/null || echo "⚠️  Could not restart automatically. Run: systemctl --user restart openclaw-gateway"
  sleep 5
  if journalctl --user -u openclaw-gateway --since "10 sec ago" --no-pager 2>/dev/null | grep -qi "$SERVER_NAME"; then
    echo "✅ ${SERVER_TITLE} MCP Server installed and running!"
  else
    echo "✅ Installed. Check gateway logs to verify: journalctl --user -u openclaw-gateway -f"
  fi
else
  echo "⏭️  Skipped restart. Run manually: systemctl --user restart openclaw-gateway"
fi
