#!/usr/bin/env node
// Strict-ESM load smoke test for the built plugin.
//
// vitest tests don't catch CommonJS-isms in the source because vitest's
// loader is more permissive than Node's strict-ESM mode (OpenClaw 2026.4.22+
// runs the plugin via the latter). Issue #7 shipped specifically because
// the vitest suite was green but production loading threw
// `ReferenceError: require is not defined`.
//
// This script imports the built dist with `import` under raw Node ESM —
// same code path as OpenClaw — and fails the publish if anything goes
// wrong on import or the default export isn't a function.

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const distEntry = join(repoRoot, "dist", "index.js");

if (!existsSync(distEntry)) {
  console.error(`✗ dist/index.js missing — run \`npm run build\` first`);
  process.exit(1);
}

const mod = await import(distEntry);
const activate = mod.default;

if (typeof activate !== "function") {
  console.error(
    `✗ default export is not a function (got ${typeof activate}) — plugin contract broken`
  );
  process.exit(1);
}

console.log(`✓ dist/index.js loads under strict ESM and exposes a default activate()`);
