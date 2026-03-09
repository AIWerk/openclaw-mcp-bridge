import test from "node:test";
import assert from "node:assert/strict";
import { McpRouter } from "../mcp-router.ts";
import type { McpRequest, McpResponse, McpServerConfig, McpTransport, McpTool } from "../types.ts";

type Behavior = {
  tools: McpTool[];
  callResult?: any;
  callError?: { code: number; message: string };
  connectError?: Error;
};

class MockTransport implements McpTransport {
  static behaviors = new Map<string, Behavior>();
  static instances = new Map<string, MockTransport>();

  static reset(): void {
    this.behaviors.clear();
    this.instances.clear();
  }

  connected = false;
  requests: McpRequest[] = [];
  connectCount = 0;
  disconnectCount = 0;
  private readonly key: string;

  constructor(config: McpServerConfig, _clientConfig?: any, _logger?: any, _onReconnected?: () => Promise<void>) {
    this.key = config.url || config.command || "default";
    MockTransport.instances.set(this.key, this);
  }

  async connect(): Promise<void> {
    this.connectCount += 1;
    const behavior = MockTransport.behaviors.get(this.key);
    if (behavior?.connectError) {
      throw behavior.connectError;
    }
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.disconnectCount += 1;
    this.connected = false;
  }

  async sendRequest(request: McpRequest): Promise<McpResponse> {
    this.requests.push(request);
    const behavior = MockTransport.behaviors.get(this.key);

    if (request.method === "initialize") {
      return { jsonrpc: "2.0", id: 1, result: {} };
    }

    if (request.method === "tools/list") {
      return { jsonrpc: "2.0", id: 2, result: { tools: behavior?.tools || [] } };
    }

    if (request.method === "tools/call") {
      if (behavior?.callError) {
        return {
          jsonrpc: "2.0",
          id: 3,
          error: {
            code: behavior.callError.code,
            message: behavior.callError.message
          }
        };
      }
      return { jsonrpc: "2.0", id: 3, result: behavior?.callResult || { ok: true } };
    }

    return { jsonrpc: "2.0", id: 4, result: {} };
  }

  async sendNotification(_notification: any): Promise<void> {
    return;
  }

  isConnected(): boolean {
    return this.connected;
  }
}

function makeLogger() {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {}
  };
}

function makeRouter(
  servers: Record<string, McpServerConfig>,
  overrides: { routerIdleTimeoutMs?: number; routerMaxConcurrent?: number } = {}
): McpRouter {
  return new McpRouter(
    servers,
    {
      servers,
      routerIdleTimeoutMs: overrides.routerIdleTimeoutMs,
      routerMaxConcurrent: overrides.routerMaxConcurrent
    },
    makeLogger(),
    {
      sse: MockTransport,
      stdio: MockTransport,
      streamableHttp: MockTransport
    }
  );
}

test.beforeEach(() => {
  MockTransport.reset();
});

test("dispatch returns unknown_server error for missing server", async () => {
  const router = makeRouter({
    alpha: { transport: "sse", url: "mock://alpha" }
  });

  const result = await router.dispatch("missing", "list");
  assert.equal("error" in result ? result.error : "", "unknown_server");
});

test("dispatch action=list returns cached tool list", async () => {
  const server = { transport: "sse" as const, url: "mock://cache" };
  MockTransport.behaviors.set("mock://cache", {
    tools: [
      {
        name: "create_server",
        description: "Create server",
        inputSchema: {
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"]
        }
      }
    ]
  });

  const router = makeRouter({ cache: server });
  const first = await router.dispatch("cache", "list");
  const second = await router.dispatch("cache", "list");

  assert.equal("error" in first, false);
  assert.equal("error" in second, false);
  if (!("error" in first) && first.action === "list") {
    assert.deepEqual(first.tools, [
      {
        name: "create_server",
        description: "Create server",
        requiredParams: ["name"]
      }
    ]);
  }

  const instance = MockTransport.instances.get("mock://cache");
  assert.ok(instance);
  const listCalls = instance!.requests.filter((req) => req.method === "tools/list");
  assert.equal(listCalls.length, 1);
});

test("dispatch action=call proxies to transport", async () => {
  MockTransport.behaviors.set("mock://call", {
    tools: [{ name: "list_servers", description: "List", inputSchema: { type: "object" } }],
    callResult: { servers: [{ id: "1" }] }
  });

  const router = makeRouter({
    call: { transport: "sse", url: "mock://call" }
  });

  const result = await router.dispatch("call", "call", "list_servers", { region: "eu-central" });
  assert.equal("error" in result, false);
  if (!("error" in result) && result.action === "call") {
    assert.deepEqual(result.result, { servers: [{ id: "1" }] });
  }

  const instance = MockTransport.instances.get("mock://call");
  assert.ok(instance);
  const callRequest = instance!.requests.find((req) => req.method === "tools/call");
  assert.ok(callRequest);
  assert.deepEqual(callRequest!.params, {
    name: "list_servers",
    arguments: { region: "eu-central" }
  });
});

test("evicts least recently used connection when max concurrent exceeded", async () => {
  const servers = {
    a: { transport: "sse" as const, url: "mock://a" },
    b: { transport: "sse" as const, url: "mock://b" },
    c: { transport: "sse" as const, url: "mock://c" }
  };

  for (const key of Object.keys(servers)) {
    MockTransport.behaviors.set(`mock://${key}`, {
      tools: [{ name: "ping", description: "Ping", inputSchema: { type: "object" } }]
    });
  }

  const router = makeRouter(servers, { routerMaxConcurrent: 2, routerIdleTimeoutMs: 60_000 });

  await router.dispatch("a", "list");
  await new Promise((resolve) => setTimeout(resolve, 5));
  await router.dispatch("b", "list");
  await new Promise((resolve) => setTimeout(resolve, 5));
  await router.dispatch("c", "list");

  assert.equal(MockTransport.instances.get("mock://a")?.disconnectCount, 1);
  assert.equal(MockTransport.instances.get("mock://b")?.isConnected(), true);
  assert.equal(MockTransport.instances.get("mock://c")?.isConnected(), true);
});

test("disconnects idle connection after timeout", async () => {
  MockTransport.behaviors.set("mock://idle", {
    tools: [{ name: "ping", description: "Ping", inputSchema: { type: "object" } }]
  });

  const router = makeRouter(
    { idle: { transport: "sse", url: "mock://idle" } },
    { routerIdleTimeoutMs: 25, routerMaxConcurrent: 5 }
  );

  await router.dispatch("idle", "list");
  await new Promise((resolve) => setTimeout(resolve, 80));

  const instance = MockTransport.instances.get("mock://idle");
  assert.ok(instance);
  assert.equal(instance!.disconnectCount >= 1, true);
  assert.equal(instance!.isConnected(), false);
});

test("generateDescription includes configured servers", () => {
  const description = McpRouter.generateDescription({
    hetzner: { transport: "sse", url: "mock://h" },
    github: { transport: "sse", url: "mock://g" }
  });

  assert.match(description, /hetzner/);
  assert.match(description, /github/);
  assert.match(description, /action='list'/);
  assert.match(description, /action='call'/);
  assert.match(description, /action='refresh'/);
});

test("status action returns all servers with connection state", async () => {
  const servers = {
    alpha: { transport: "stdio" as const, command: "node", args: ["fake.js"] },
    beta: { transport: "sse" as const, url: "http://localhost:9999/sse" }
  };
  const router = makeRouter(servers);

  const result = await router.dispatch(undefined, "status");
  assert.equal("action" in result && result.action, "status");
  if ("servers" in result) {
    assert.equal(result.servers.length, 2);
    const alpha = result.servers.find(s => s.name === "alpha");
    assert.ok(alpha);
    assert.equal(alpha!.status, "disconnected");
    assert.equal(alpha!.tools, 0);
    assert.equal(alpha!.transport, "stdio");
    const beta = result.servers.find(s => s.name === "beta");
    assert.ok(beta);
    assert.equal(beta!.status, "disconnected");
    assert.equal(beta!.transport, "sse");
  }
});

test("status action shows connected server after list", async () => {
  const servers = {
    alpha: { transport: "stdio" as const, command: "node", args: ["fake.js"] }
  };
  MockTransport.behaviors.set("node", {
    tools: [
      { name: "tool_a", description: "A", inputSchema: { type: "object" } },
      { name: "tool_b", description: "B", inputSchema: { type: "object" } }
    ]
  });
  const router = makeRouter(servers);

  // List triggers connection + tool fetch
  await router.dispatch("alpha", "list");

  const result = await router.dispatch(undefined, "status");
  if ("servers" in result) {
    const alpha = result.servers.find(s => s.name === "alpha");
    assert.ok(alpha);
    assert.equal(alpha!.status, "connected");
    assert.equal(alpha!.tools, 2);
  }
});

test("generateDescription includes status action", () => {
  const description = McpRouter.generateDescription({
    test: { transport: "stdio", command: "node", args: [] }
  });
  assert.match(description, /action='status'/);
});
