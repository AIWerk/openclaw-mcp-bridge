#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# User recipes installed via `npx @aiwerk/mcp-bridge install <name>`
USER_RECIPES_DIR="${HOME}/.mcp-bridge/recipes"

# Plugin's bundled servers (own bundle, falls back to mcp-bridge core)
SERVERS_DIR=""
if [[ -d "$SCRIPT_DIR/servers" ]]; then
    SERVERS_DIR="$SCRIPT_DIR/servers"
elif [[ -d "$SCRIPT_DIR/node_modules/@aiwerk/mcp-bridge/servers" ]]; then
    SERVERS_DIR="$SCRIPT_DIR/node_modules/@aiwerk/mcp-bridge/servers"
fi

echo "Available MCP Servers:"
echo "====================="

declare -A seen

# 1) User recipes (Universal Recipe Spec v2)
if [[ -d "$USER_RECIPES_DIR" ]]; then
    for recipe_dir in "$USER_RECIPES_DIR"/*; do
        if [[ -f "$recipe_dir/recipe.json" ]]; then
            server_name=$(basename "$recipe_dir")
            transport=$(python3 -c "import json; r=json.load(open('$recipe_dir/recipe.json')); print((r.get('transports') or [{}])[0].get('type', 'unknown'))" 2>/dev/null || echo "unknown")
            description=$(python3 -c "import json; r=json.load(open('$recipe_dir/recipe.json')); print(r.get('description', '')[:120])" 2>/dev/null || echo "")
            echo "- $server_name ($transport) [user-installed]"
            [[ -n "$description" ]] && echo "  $description"
            echo
            seen[$server_name]=1
        fi
    done
fi

# 2) Bundled servers (legacy config.json format)
if [[ -n "$SERVERS_DIR" ]]; then
    for server_dir in "$SERVERS_DIR"/*; do
        if [[ -d "$server_dir" ]]; then
            server_name=$(basename "$server_dir")
            [[ -n "${seen[$server_name]:-}" ]] && continue
            config_file="$server_dir/config.json"
            readme_file="$server_dir/README.md"

            transport=""
            if [[ -f "$config_file" ]]; then
                transport=$(python3 -c "import json; config=json.load(open('$config_file')); print(config.get('transport', 'unknown'))" 2>/dev/null || echo "unknown")
            fi

            description=""
            if [[ -f "$readme_file" ]]; then
                description=$(sed -n '3p' "$readme_file" | sed 's/^[[:space:]]*//')
                [[ -z "$description" ]] && description=$(sed -n '1p' "$readme_file" | sed 's/^# *//')
            fi

            echo "- $server_name ($transport) [bundled]"
            [[ -n "$description" ]] && echo "  $description"
            echo
        fi
    done
fi

if [[ -z "$SERVERS_DIR" ]] && [[ ! -d "$USER_RECIPES_DIR" ]]; then
    echo "(no servers found)"
    echo ""
    echo "Install a recipe with: npx @aiwerk/mcp-bridge install <name>"
fi
