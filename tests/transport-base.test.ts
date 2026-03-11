import test from "node:test";
import assert from "node:assert/strict";
import { BaseTransport } from "@aiwerk/mcp-bridge";
import type { McpRequest, McpResponse, McpServerConfig } from "@aiwerk/mcp-bridge";

class TestableTransport extends BaseTransport {
  protected get transportName(): string {
    return "test";
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async sendRequest(_request: McpRequest): Promise<McpResponse> {
    return { jsonrpc: "2.0", id: 0, result: {} };
  }

  async sendNotification(_notification: any): Promise<void> {
    return;
  }

  testHandleMessage(message: any): void {
    this.handleMessage(message);
  }

  testScheduleReconnect(): void {
    this.scheduleReconnect();
  }

  testRejectAllPending(reason: string): void {
    this.rejectAllPending(reason);
  }

  testCleanupReconnectTimer(): void {
    this.cleanupReconnectTimer();
  }

  getPendingRequests() {
    return this.pendingRequests;
  }

  setConnected(value: boolean): void {
    this.connected = value;
  }

  getReconnectTimer() {
    return this.reconnectTimer;
  }
}

function makeLogger() {
  return {
    debugCalls: [] as string[],
    errorCalls: [] as any[],
    infoCalls: [] as string[],
    debug(msg: string) {
      this.debugCalls.push(msg);
    },
    error(...args: any[]) {
      this.errorCalls.push(args);
    },
    info(msg: string) {
      this.infoCalls.push(msg);
    },
  };
}

function makeTransport(onReconnected?: () => Promise<void>) {
  const config: McpServerConfig = { transport: "sse", url: "http://localhost:1234/sse" };
  const clientConfig = { reconnectIntervalMs: 10_000 };
  const logger = makeLogger();
  const transport = new TestableTransport(config, clientConfig, logger, onReconnected);
  return { transport, logger };
}

test("handleMessage resolves pending request when response.id matches", async () => {
  const { transport } = makeTransport();

  let resolved: any;
  const promise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("timeout")), 1000);
    transport.getPendingRequests().set(1, { resolve, reject, timeout });
  });

  transport.testHandleMessage({ jsonrpc: "2.0", id: 1, result: { ok: true } });

  resolved = await promise;
  assert.deepEqual(resolved, { jsonrpc: "2.0", id: 1, result: { ok: true } });
  assert.equal(transport.getPendingRequests().size, 0);
});

test("handleMessage rejects pending request when response has error", async () => {
  const { transport } = makeTransport();

  const promise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("timeout")), 1000);
    transport.getPendingRequests().set(2, { resolve, reject, timeout });
  });

  transport.testHandleMessage({ jsonrpc: "2.0", id: 2, error: { code: -1, message: "boom" } });

  await assert.rejects(promise, /boom/);
  assert.equal(transport.getPendingRequests().size, 0);
});

test("handleMessage ignores messages with unknown id (no crash)", () => {
  const { transport } = makeTransport();

  assert.doesNotThrow(() => {
    transport.testHandleMessage({ jsonrpc: "2.0", id: 999, result: { ok: true } });
  });

  assert.equal(transport.getPendingRequests().size, 0);
});

test("handleMessage calls onReconnected on notifications/tools/list_changed", async () => {
  let called = 0;
  const { transport } = makeTransport(async () => {
    called += 1;
  });

  transport.testHandleMessage({ jsonrpc: "2.0", method: "notifications/tools/list_changed" });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(called, 1);
});

test("handleMessage logs debug for unknown notifications", () => {
  const { transport, logger } = makeTransport();

  assert.doesNotThrow(() => {
    transport.testHandleMessage({ jsonrpc: "2.0", method: "notifications/other" });
  });

  assert.equal(logger.debugCalls.length, 1);
  assert.match(logger.debugCalls[0], /Unhandled test notification: notifications\/other/);
});

test("rejectAllPending rejects all pending and clears the map", async () => {
  const { transport } = makeTransport();

  const p1 = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("timeout")), 1000);
    transport.getPendingRequests().set(1, { resolve, reject, timeout });
  });
  const p2 = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("timeout")), 1000);
    transport.getPendingRequests().set(2, { resolve, reject, timeout });
  });

  transport.testRejectAllPending("cancelled");

  await assert.rejects(p1, /cancelled/);
  await assert.rejects(p2, /cancelled/);
  assert.equal(transport.getPendingRequests().size, 0);
});

test("rejectAllPending with empty map doesn't crash", () => {
  const { transport } = makeTransport();

  assert.doesNotThrow(() => {
    transport.testRejectAllPending("anything");
  });

  assert.equal(transport.getPendingRequests().size, 0);
});

test("scheduleReconnect sets connected=false and rejects pending", async () => {
  const { transport } = makeTransport();
  transport.setConnected(true);

  const pending = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("timeout")), 1000);
    transport.getPendingRequests().set(10, { resolve, reject, timeout });
  });

  transport.testScheduleReconnect();

  assert.equal(transport.isConnected(), false);
  await assert.rejects(pending, /Connection lost, request cancelled/);
  assert.equal(transport.getPendingRequests().size, 0);

  transport.testCleanupReconnectTimer();
});

test("scheduleReconnect doesn't schedule twice (idempotent)", () => {
  const { transport } = makeTransport();

  transport.testScheduleReconnect();
  const firstTimer = transport.getReconnectTimer();

  transport.testScheduleReconnect();
  const secondTimer = transport.getReconnectTimer();

  assert.ok(firstTimer);
  assert.equal(firstTimer, secondTimer);

  transport.testCleanupReconnectTimer();
});

test("cleanupReconnectTimer clears the timer", () => {
  const { transport } = makeTransport();

  transport.testScheduleReconnect();
  assert.ok(transport.getReconnectTimer());

  transport.testCleanupReconnectTimer();
  assert.equal(transport.getReconnectTimer(), null);
});
