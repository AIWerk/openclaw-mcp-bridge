import test from "node:test";
import assert from "node:assert/strict";
import { resolveEnvVars, resolveEnvRecord, resolveArgs } from "../transport-base.ts";

test("resolveEnvRecord throws when env var is missing", () => {
  assert.throws(
    () => resolveEnvRecord({ TOKEN: "${MISSING_TEST_ENV}" }, "env key"),
    /Missing required environment variable/
  );
});

test("resolveArgs resolves env vars in args", () => {
  const env = { MY_TOKEN: "secret123" };
  const result = resolveArgs(["--token", "${MY_TOKEN}", "--verbose"], env);
  assert.deepStrictEqual(result, ["--token", "secret123", "--verbose"]);
});

test("resolveArgs throws when env var is missing in args", () => {
  assert.throws(
    () => resolveArgs(["--token", "${MISSING_TEST_ENV}"], {}),
    /Missing required environment variable/
  );
});

test("resolveArgs passes through args without variables", () => {
  const result = resolveArgs(["-y", "@llmindset/mcp-miro", "--verbose"], {});
  assert.deepStrictEqual(result, ["-y", "@llmindset/mcp-miro", "--verbose"]);
});

test("resolveEnvRecord resolves headers with env vars", () => {
  process.env.__TEST_MCP_TOKEN = "test-secret-456";
  try {
    const result = resolveEnvRecord(
      { Authorization: "Bearer ${__TEST_MCP_TOKEN}" },
      "header"
    );
    assert.deepStrictEqual(result, { Authorization: "Bearer test-secret-456" });
  } finally {
    delete process.env.__TEST_MCP_TOKEN;
  }
});

test("resolveEnvRecord throws for missing header env var", () => {
  assert.throws(
    () => resolveEnvRecord({ Authorization: "Bearer ${MISSING_TEST_ENV}" }, "header"),
    /Missing required environment variable/
  );
});

test("resolveEnvVars resolves single value", () => {
  process.env.__TEST_MCP_SINGLE = "hello";
  try {
    const result = resolveEnvVars("prefix-${__TEST_MCP_SINGLE}-suffix", "test");
    assert.equal(result, "prefix-hello-suffix");
  } finally {
    delete process.env.__TEST_MCP_SINGLE;
  }
});

test("resolveEnvVars uses extraEnv before process.env", () => {
  process.env.__TEST_MCP_PRIO = "from-process";
  try {
    const result = resolveEnvVars("${__TEST_MCP_PRIO}", "test", { __TEST_MCP_PRIO: "from-extra" });
    assert.equal(result, "from-extra");
  } finally {
    delete process.env.__TEST_MCP_PRIO;
  }
});
