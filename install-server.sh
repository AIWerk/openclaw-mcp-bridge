#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPENCLAW_CONFIG="$HOME/.openclaw/openclaw.json"
OPENCLAW_ENV="$HOME/.openclaw/.env"

usage() {
    echo "Usage: $0 <server-name> [--dry-run]"
    echo ""
    echo "Available servers:"
    for server_dir in "$SCRIPT_DIR/servers"/*; do
        if [[ -d "$server_dir" ]]; then
            server_name=$(basename "$server_dir")
            echo "  - $server_name"
        fi
    done
    exit 1
}

if [[ $# -eq 0 ]]; then
    usage
fi

SERVER_NAME="$1"
DRY_RUN=false

if [[ "$2" == "--dry-run" ]]; then
    DRY_RUN=true
fi

SERVER_DIR="$SCRIPT_DIR/servers/$SERVER_NAME"

if [[ ! -d "$SERVER_DIR" ]]; then
    echo "Error: Server '$SERVER_NAME' not found."
    echo "Available servers:"
    for server_dir in "$SCRIPT_DIR/servers"/*; do
        if [[ -d "$server_dir" ]]; then
            server_name=$(basename "$server_dir")
            echo "  - $server_name"
        fi
    done
    exit 1
fi

echo "Installing MCP server: $SERVER_NAME"

if [[ "$DRY_RUN" == "true" ]]; then
    echo "[DRY RUN] Would execute:"
    echo "[DRY RUN] Running install script: $SERVER_DIR/install.sh"
    
    if [[ -f "$SERVER_DIR/env_vars" ]] && [[ -s "$SERVER_DIR/env_vars" ]]; then
        echo "[DRY RUN] Would check environment variables:"
        while read -r var; do
            [[ -z "$var" ]] && continue
            echo "[DRY RUN]   - $var"
        done < "$SERVER_DIR/env_vars"
    fi
    
    echo "[DRY RUN] Would merge config into: $OPENCLAW_CONFIG"
    echo "[DRY RUN] Config to merge:"
    cat "$SERVER_DIR/config.json"
    exit 0
fi

# Run installation script
echo "Running installation script..."
if [[ -x "$SERVER_DIR/install.sh" ]]; then
    "$SERVER_DIR/install.sh"
else
    echo "Warning: Install script not executable or missing"
fi

# Check environment variables
if [[ -f "$SERVER_DIR/env_vars" ]] && [[ -s "$SERVER_DIR/env_vars" ]]; then
    echo "Checking environment variables..."
    
    # Ensure .env file exists with secure permissions
    touch "$OPENCLAW_ENV"
    chmod 600 "$OPENCLAW_ENV"
    
    while read -r var; do
        [[ -z "$var" ]] && continue
        
        if grep -q "^$var=" "$OPENCLAW_ENV" 2>/dev/null; then
            echo "Environment variable $var already exists."
            read -p "Overwrite? [y/N]: " overwrite
            if [[ "$overwrite" =~ ^[Yy]$ ]]; then
                sed -i "/^$var=/d" "$OPENCLAW_ENV"
            else
                echo "Keeping existing value for $var"
                continue
            fi
        fi
        
        echo "Environment variable $var is required."
        read -p "Enter value for $var: " -s value
        echo
        echo "$var=$value" >> "$OPENCLAW_ENV"
        echo "Saved $var to $OPENCLAW_ENV"
    done < "$SERVER_DIR/env_vars"
fi

# Merge configuration
echo "Merging configuration..."
python3 - << EOF
import json
import os

config_file = "$OPENCLAW_CONFIG"
server_config_file = "$SERVER_DIR/config.json"
server_name = "$SERVER_NAME"

# Load existing config
if os.path.exists(config_file):
    with open(config_file, 'r') as f:
        config = json.load(f)
else:
    config = {}

# Ensure proper structure exists
if 'plugins' not in config:
    config['plugins'] = {}
if 'entries' not in config['plugins']:
    config['plugins']['entries'] = {}
if 'mcp-client' not in config['plugins']['entries']:
    config['plugins']['entries']['mcp-client'] = {}
if 'config' not in config['plugins']['entries']['mcp-client']:
    config['plugins']['entries']['mcp-client']['config'] = {}
if 'servers' not in config['plugins']['entries']['mcp-client']['config']:
    config['plugins']['entries']['mcp-client']['config']['servers'] = {}

# Load server config
with open(server_config_file, 'r') as f:
    server_config = json.load(f)

# Merge server config
config['plugins']['entries']['mcp-client']['config']['servers'][server_name] = server_config

# Save config
with open(config_file, 'w') as f:
    json.dump(config, f, indent=2)

print(f"Configuration merged successfully for server: {server_name}")
EOF

echo "Done! Run: openclaw gateway restart"