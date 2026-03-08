#!/bin/bash
# Install Wise MCP server (community, by Szotasz)
# No npm package — must clone and build from source

set -e

INSTALL_DIR="${1:-$HOME/bin/wise-mcp}"

if [ -d "$INSTALL_DIR" ]; then
  echo "Wise MCP already installed at $INSTALL_DIR"
  echo "To update: cd $INSTALL_DIR && git pull && npm install && npm run build"
  exit 0
fi

echo "Cloning wise-mcp..."
git clone https://github.com/Szotasz/wise-mcp.git "$INSTALL_DIR"
cd "$INSTALL_DIR"
npm install
npm run build

echo ""
echo "✅ Wise MCP installed at $INSTALL_DIR"
echo "Binary: node $INSTALL_DIR/dist/cli.js"
echo ""
echo "Update your openclaw.json args to point to: $INSTALL_DIR/dist/cli.js"
