import { describe, expect, it } from "vitest";
import type { OpenClawPluginApi, PluginClientConfig, SmartFilterConfig } from "../types.js";

describe("types", () => {
  it("accepts PluginClientConfig with multiple transport server definitions", () => {
    const cfg: PluginClientConfig = {
      mode: "direct",
      toolPrefix: "auto",
      servers: {
        local: {
          transport: "stdio",
          command: "node",
          args: ["server.js"],
          env: { TOKEN: "abc" },
          keywords: ["dev", "tools"],
        },
        remoteSse: {
          transport: "sse",
          url: "https://example.com/sse",
          headers: { Authorization: "Bearer token" },
          description: "SSE server",
          keywords: ["network"],
        },
        remoteHttp: {
          transport: "streamable-http",
          url: "https://example.com/mcp",
          auth: { type: "bearer", token: "x" },
          description: "HTTP server",
        },
      },
    };

    expect(Object.keys(cfg.servers)).toHaveLength(3);
  });

  it("accepts SmartFilterConfig shape used by router mode", () => {
    const smartFilter: SmartFilterConfig = {
      enabled: true,
      embedding: "keyword",
      topServers: 3,
      hardCap: 5,
      topTools: 10,
      serverThreshold: 0.2,
      toolThreshold: 0.1,
      fallback: "keyword",
      alwaysInclude: ["github"],
      timeoutMs: 1500,
      telemetry: false,
    };

    expect(smartFilter.enabled).toBe(true);
  });

  it("supports OpenClawPluginApi tool registration surface", () => {
    const api: OpenClawPluginApi = {
      pluginConfig: {
        mode: "router",
        servers: {
          test: { transport: "sse", url: "https://example.com" },
        },
      },
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
      },
      registerTool: () => {},
      unregisterTool: () => {},
      on: () => {},
    };

    expect(api.pluginConfig.mode).toBe("router");
  });
});
