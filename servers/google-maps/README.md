# Google Maps MCP Server

Google Maps MCP tools for places, geocoding, and routing.

## Requirements
- Node.js + npx
- Google Maps API key

## Quick Install

### Linux / macOS
```bash
cd ~/.openclaw/extensions/mcp-client/servers/google-maps
chmod +x install.sh && ./install.sh
```

### Windows (PowerShell)
```powershell
cd $env:USERPROFILE\.openclaw\extensions\mcp-client\servers\google-maps
.\install.ps1
```

### Manual Setup
1. Get your token: https://console.cloud.google.com/apis/credentials
2. Add to .env: `GOOGLE_MAPS_API_KEY=your_token`
3. Add config to openclaw.json (see config.json)
4. Restart gateway

## What you get
- Geocoding and reverse geocoding
- Places search and details
- Routing and distance tools

## Remove

```bash
./install-server.sh google-maps --remove
```

Removes the server from config and cleans up the API token. The server recipe stays in `servers/google-maps/` for easy reinstall.
