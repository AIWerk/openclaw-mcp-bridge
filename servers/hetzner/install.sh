#!/bin/bash

echo "Installing Hetzner MCP server..."
pip install --break-system-packages git+https://github.com/dkruyt/mcp-hetzner.git
echo "Hetzner MCP server installed successfully!"