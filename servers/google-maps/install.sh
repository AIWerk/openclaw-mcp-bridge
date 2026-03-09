#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_NAME="$(basename "$SCRIPT_DIR")"
exec "$SCRIPT_DIR/../../install-server.sh" "$SERVER_NAME" "$@"
