# Atlassian MCP Server

Confluence wiki and Jira project management - search, create, and update pages and issues.

## Requirements
- Python + uvx (or pip)
- Atlassian Cloud or Server/Data Center instance
- API token for authentication

## Quick Install

### Linux / macOS
```bash
# Using mcp-bridge CLI:
mcp-bridge install atlassian
```

### Windows (PowerShell)
```powershell
# Using mcp-bridge CLI:
mcp-bridge install atlassian
```

### Manual Setup
1. Get your API token: https://id.atlassian.com/manage-profile/security/api-tokens
2. Add to .env:
   ```
   CONFLUENCE_URL=https://your-domain.atlassian.net/wiki
   CONFLUENCE_USERNAME=your@email.com
   CONFLUENCE_API_TOKEN=your_token
   JIRA_URL=https://your-domain.atlassian.net
   JIRA_USERNAME=your@email.com
   JIRA_API_TOKEN=your_token
   ```
3. Add config to ~/.mcp-bridge/config.json (see config.json)
4. Restart mcp-bridge

## Configuration

You can use Confluence only, Jira only, or both. Just set the env vars for the services you need.

### Cloud vs Server/Data Center
- **Cloud**: Use API token authentication (as above)
- **Server/DC**: Use personal access token instead:
  ```
  CONFLUENCE_PERSONAL_TOKEN=your_pat
  JIRA_PERSONAL_TOKEN=your_pat
  ```

## What you get

### Confluence (12+ tools)
- Search pages and spaces
- Read, create, update, and delete pages
- Manage labels and attachments
- Get page comments

### Jira (10+ tools)
- Search issues (JQL)
- Create, update, and transition issues
- Manage sprints and boards
- Add comments and attachments

72 tools total. Uses [sooperset/mcp-atlassian](https://github.com/sooperset/mcp-atlassian) (MIT license).

## Remove

```bash
./install-server.sh atlassian --remove
```

Removes the server from config and cleans up the API tokens. The server recipe stays in `servers/atlassian/` for easy reinstall.
