#!/usr/bin/env node
// Cross-check package.json `version` against openclaw.plugin.json `version`.
// OpenClaw reads the plugin version from the manifest (not package.json), so
// they MUST agree or `openclaw plugins inspect` reports the wrong version
// after install and `openclaw doctor` flags a duplicate-id mismatch.
// See https://github.com/AIWerk/openclaw-mcp-bridge/issues/8 .

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const manifest = JSON.parse(
  readFileSync(join(repoRoot, "openclaw.plugin.json"), "utf8")
);

if (pkg.version !== manifest.version) {
  console.error(
    `\n✗ Version mismatch:\n` +
      `    package.json:           ${pkg.version}\n` +
      `    openclaw.plugin.json:   ${manifest.version}\n\n` +
      `Both must agree before publishing — bump openclaw.plugin.json to ${pkg.version}.\n`
  );
  process.exit(1);
}

console.log(`✓ package.json + openclaw.plugin.json both at ${pkg.version}`);
