# GitHub MCP Server

Official MCP server by GitHub (`github/github-mcp-server`).

## What it provides

41 tools for GitHub operations:
- Repository management (browse code, search files, analyze commits)
- Issue & PR automation (create, update, review, merge)
- CI/CD monitoring (workflow runs, build failures)
- Code analysis (security findings, Dependabot alerts)

## Requirements

- Docker
- GitHub Personal Access Token

## Install

```bash
./install.sh
```

Or manually:

```bash
docker pull ghcr.io/github/github-mcp-server
```

## Get your token

1. Go to https://github.com/settings/personal-access-tokens/new
2. Select the repositories you want to access
3. Enable permissions: Contents (read), Issues (read/write), Pull requests (read/write)
4. Copy the token

## Configuration

Add to your `openclaw.json` under `plugins.entries.mcp-client.config.servers`:

```json
"github": {
  "transport": "stdio",
  "command": "docker",
  "args": ["run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN", "ghcr.io/github/github-mcp-server"],
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_MCP_TOKEN}"
  }
}
```

## Windows

Docker Desktop required. Same configuration works on Windows.

## Verify

After gateway restart, check logs for:
```
Server github initialized, registered 41 tools
```
