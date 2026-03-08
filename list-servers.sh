#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Available MCP Servers:"
echo "====================="

for server_dir in "$SCRIPT_DIR/servers"/*; do
    if [[ -d "$server_dir" ]]; then
        server_name=$(basename "$server_dir")
        config_file="$server_dir/config.json"
        readme_file="$server_dir/README.md"
        
        # Extract transport from config
        transport=""
        if [[ -f "$config_file" ]]; then
            transport=$(python3 -c "import json; config=json.load(open('$config_file')); print(config.get('transport', 'unknown'))" 2>/dev/null || echo "unknown")
        fi
        
        # Extract first line from README (skip # header)
        description=""
        if [[ -f "$readme_file" ]]; then
            description=$(sed -n '3p' "$readme_file" | sed 's/^[[:space:]]*//')
            [[ -z "$description" ]] && description=$(sed -n '1p' "$readme_file" | sed 's/^# *//')
        fi
        
        echo "- $server_name ($transport)"
        [[ -n "$description" ]] && echo "  $description"
        echo
    fi
done