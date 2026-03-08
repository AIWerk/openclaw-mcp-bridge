# Contributing

Thanks for your interest in contributing to the OpenClaw MCP Client Plugin!

## Adding a new server

1. Create `servers/my-server/` with these files:
   - `config.json` — server config with `${ENV_VAR}` placeholders
   - `install.sh` — installation script (follow existing format)
   - `env_vars` — one env var name per line (no values!)
   - `README.md` — follow the standard format (see any existing server)

2. Test locally:
   ```bash
   ./install-server.sh my-server --dry-run
   ./install-server.sh my-server
   ```

3. Submit a Pull Request with a brief description of the server and how many tools it provides.

## Code changes

1. Fork the repo and create a feature branch
2. Make your changes to the TypeScript files
3. Test with at least one MCP server connected
4. Submit a PR — describe what you changed and why

## Guidelines

- Keep server READMEs concise (~40 lines) and consistent with existing ones
- Config files must use `${VAR}` for secrets — never hardcode tokens
- Install scripts should include "Next steps" guidance
- Be respectful in discussions and reviews

## Questions?

Open an issue — we're happy to help.
