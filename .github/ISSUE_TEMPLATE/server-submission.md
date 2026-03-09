---
name: Server submission
about: Propose a new MCP server for the OpenClaw MCP Bridge catalog
title: "[Server Submission] <name> — <description>"
labels: ["server-submission"]
assignees: []
---

## Server details
- Name:
- Description (one line, lowercase):
- Transport (`stdio` | `sse` | `streamable-http`):
- Command (if stdio):
- URL (if sse/http):
- Args (if applicable):
- Required env vars (`${VAR}` format):
- Credentials URL:
- Install method (npm/pip/docker with pinned version):
- Source URL:

## Test results
- Command/test used:
- Result of `mcp(server="<name>", action="list")`:
- If auth-required and credentials not set, what was validated instead:

## Checklist
- [ ] I have tested this locally and tools/list returns results
