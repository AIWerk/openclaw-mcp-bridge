# IMAP Email MCP Server

IMAP/SMTP email tools for any provider (list, read, search, move, flag, delete, send, reply, attachments).

## Requirements
- Node.js + npx
- IMAP credentials
- SMTP credentials (optional, for sending)

## Quick Install

### Linux / macOS
```bash
mcp-bridge install imap-email
```

### Windows (PowerShell)
```powershell
mcp-bridge install imap-email
```

## Required Environment Variables
- `IMAP_HOST`
- `IMAP_PORT`
- `IMAP_USER`
- `IMAP_PASS`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SEND_ENABLED`

Set `SMTP_SEND_ENABLED=true` to enable sending/replying via SMTP.

## Remove

```bash
./install-server.sh imap-email --remove
```
