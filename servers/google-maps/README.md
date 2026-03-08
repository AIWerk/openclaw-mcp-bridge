# Google Maps MCP Server

Location, geocoding, places, and directions via MCP — **official Anthropic reference server** (`@modelcontextprotocol/server-google-maps`).

## What it provides

Tools for Google Maps operations:
- Geocoding (address → coordinates and reverse)
- Place search and details
- Directions and route calculation
- Distance matrix

## Requirements

- Node.js 18+
- Google Maps API key with relevant APIs enabled

## Install

No installation needed — runs via `npx`.

## Get your API key

1. Go to https://console.cloud.google.com/apis/credentials
2. Create or select a project
3. Enable these APIs: Maps JavaScript API, Geocoding API, Places API, Directions API
4. Create an API key under Credentials

## Configuration

```json
"google-maps": {
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-google-maps"],
  "env": {
    "GOOGLE_MAPS_API_KEY": "${GOOGLE_MAPS_API_KEY}"
  }
}
```

## Verify

After gateway restart, check logs for:
```
Server google-maps initialized, registered N tools
```
