import test from "node:test";
import assert from "node:assert/strict";
import { StdioTransport } from "../transport-stdio.ts";
import { SseTransport } from "../transport-sse.ts";
import { StreamableHttpTransport } from "../transport-streamable-http.ts";

const logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {}
};

test("stdio resolveEnv throws when env var is missing", () => {
  const transport = new StdioTransport({ transport: "stdio", command: "echo" }, {}, logger);
  assert.throws(() => (transport as any).resolveEnv({ TOKEN: "${MISSING_TEST_ENV}" }), /Missing required environment variable/);
});

test("stdio resolveArgs resolves env vars in args", () => {
  const transport = new StdioTransport({ transport: "stdio", command: "echo" }, {}, logger);
  const env = { MY_TOKEN: "secret123" };
  const result = (transport as any).resolveArgs(["--token", "${MY_TOKEN}", "--verbose"], env);
  assert.deepStrictEqual(result, ["--token", "secret123", "--verbose"]);
});

test("stdio resolveArgs throws when env var is missing in args", () => {
  const transport = new StdioTransport({ transport: "stdio", command: "echo" }, {}, logger);
  assert.throws(() => (transport as any).resolveArgs(["--token", "${MISSING_TEST_ENV}"], {}), /Missing required environment variable/);
});

test("stdio resolveArgs passes through args without variables", () => {
  const transport = new StdioTransport({ transport: "stdio", command: "echo" }, {}, logger);
  const result = (transport as any).resolveArgs(["-y", "@llmindset/mcp-miro", "--verbose"], {});
  assert.deepStrictEqual(result, ["-y", "@llmindset/mcp-miro", "--verbose"]);
});

test("sse resolveHeaders throws when env var is missing", () => {
  const transport = new SseTransport({ transport: "sse", url: "http://localhost:3000" }, {}, logger);
  assert.throws(() => (transport as any).resolveHeaders({ Authorization: "Bearer ${MISSING_TEST_ENV}" }), /Missing required environment variable/);
});

test("streamable-http resolveHeaders throws when env var is missing", () => {
  const transport = new StreamableHttpTransport({ transport: "streamable-http", url: "http://localhost:3000" }, {}, logger);
  assert.throws(() => (transport as any).resolveHeaders({ Authorization: "Bearer ${MISSING_TEST_ENV}" }), /Missing required environment variable/);
});
