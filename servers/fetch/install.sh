#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SERVER_NAME="$(basename "$(dirname "$0")")"
exec "$DIR/install-server.sh" "$SERVER_NAME" "$@"
