import { beforeEach, describe, expect, it, vi } from "vitest";

const bridgeMock = vi.hoisted(() => {
  const transports: MockTransport[] = [];
  const routerInstances: MockRouter[] = [];

  class MockTransport {
    readonly kind: string;
    readonly serverConfig: unknown;
    readonly clientConfig: unknown;
    readonly logger: unknown;
    readonly onReconnected: (() => Promise<void> | void) | undefined;

    connect = vi.fn(async () => {});
    disconnect = vi.fn(async () => {});
    isConnected = vi.fn(() => true);
    sendRequest = vi.fn(async () => ({ result: { content: [{ type: "text", text: "ok" }] } }));

    constructor(kind: string, serverConfig: unknown, clientConfig: unknown, logger: unknown, onReconnected?: () => Promise<void> | void) {
      this.kind = kind;
      this.serverConfig = serverConfig;
      this.clientConfig = clientConfig;
      this.logger = logger;
      this.onReconnected = onReconnected;
      transports.push(this);
    }

    async triggerReconnect() {
      await this.onReconnected?.();
    }
  }

  class MockRouter {
    servers: unknown;
    config: unknown;
    logger: unknown;
    dispatch = vi.fn(async () => ({ content: [{ type: "text", text: "router" }] }));
    disconnectAll = vi.fn(async () => {});

    constructor(servers: unknown, config: unknown, logger: unknown) {
      this.servers = servers;
      this.config = config;
      this.logger = logger;
      routerInstances.push(this);
    }

    static generateDescription = vi.fn(() => "router-description");
  }

  const state = {
    transports,
    routerInstances,
    setSchemaLogger: vi.fn(),
    createToolParameters: vi.fn(async () => ({ type: "object", properties: { p: { type: "string" } } })),
    fetchToolsList: vi.fn(async () => []),
    initializeProtocol: vi.fn(async () => {}),
    pickRegisteredToolName: vi.fn(
      (server: string, tool: string, toolPrefix: boolean | "auto" | undefined, used: Set<string>, globalUsed: Set<string>) => {
        let base = tool;
        if (toolPrefix === true || toolPrefix === undefined) {
          base = `${server}_${tool}`;
        } else if (toolPrefix === "auto") {
          base = used.has(tool) || globalUsed.has(tool) ? `${server}_${tool}` : tool;
        }

        let candidate = base;
        let i = 2;
        while (used.has(candidate) || globalUsed.has(candidate)) {
          candidate = `${base}_${i++}`;
        }
        return candidate;
      }
    ),
    checkForUpdate: vi.fn(async () => ({ updateAvailable: false, currentVersion: "1.0.0", latestVersion: "1.0.0" })),
    checkPluginUpdate: vi.fn(async () => {}),
    getUpdateNotice: vi.fn(() => ""),
    runUpdate: vi.fn(async () => "updated"),
    filterServers: vi.fn(() => ({ reason: "not_enabled", filteredServers: [] as string[] })),
    buildFilteredDescription: vi.fn(() => "filtered-description"),
    bootstrapCatalog: vi.fn().mockResolvedValue([]),
    mergeRecipesIntoConfig: vi.fn().mockImplementation((cfg: any) => ({ ...cfg, servers: cfg.servers || {} })),
    reset() {
      transports.length = 0;
      routerInstances.length = 0;
      this.setSchemaLogger.mockReset();
      this.createToolParameters.mockReset();
      this.createToolParameters.mockResolvedValue({ type: "object", properties: { p: { type: "string" } } });
      this.fetchToolsList.mockReset();
      this.fetchToolsList.mockResolvedValue([]);
      this.initializeProtocol.mockReset();
      this.initializeProtocol.mockResolvedValue(undefined);
      this.pickRegisteredToolName.mockClear();
      this.checkForUpdate.mockReset();
      this.checkForUpdate.mockResolvedValue({ updateAvailable: false, currentVersion: "1.0.0", latestVersion: "1.0.0" });
      this.checkPluginUpdate.mockReset();
      this.checkPluginUpdate.mockResolvedValue(undefined);
      this.getUpdateNotice.mockReset();
      this.getUpdateNotice.mockReturnValue("");
      this.runUpdate.mockReset();
      this.runUpdate.mockResolvedValue("updated");
      this.filterServers.mockReset();
      this.filterServers.mockReturnValue({ reason: "not_enabled", filteredServers: [] });
      this.buildFilteredDescription.mockReset();
      this.buildFilteredDescription.mockReturnValue("filtered-description");
      this.bootstrapCatalog.mockReset();
      this.bootstrapCatalog.mockResolvedValue([]);
      this.mergeRecipesIntoConfig.mockReset();
      this.mergeRecipesIntoConfig.mockImplementation((cfg: any) => ({ ...cfg, servers: cfg.servers || {} }));
      MockRouter.generateDescription.mockReset();
      MockRouter.generateDescription.mockReturnValue("router-description");
    },
  };

  return { state, MockTransport, MockRouter };
});

vi.mock("@aiwerk/mcp-bridge", () => {
  const { state, MockTransport, MockRouter } = bridgeMock;

  return {
    PACKAGE_VERSION: "9.9.9",
    McpRouter: MockRouter,
    SseTransport: class extends MockTransport {
      constructor(serverConfig: unknown, clientConfig: unknown, logger: unknown, onReconnected?: () => Promise<void> | void, _tokenManager?: unknown, _requestIdGenerator?: unknown, _serverName?: string) {
        super("sse", serverConfig, clientConfig, logger, onReconnected);
      }
    },
    StdioTransport: class extends MockTransport {
      constructor(serverConfig: unknown, clientConfig: unknown, logger: unknown, onReconnected?: () => Promise<void> | void) {
        super("stdio", serverConfig, clientConfig, logger, onReconnected);
      }
    },
    StreamableHttpTransport: class extends MockTransport {
      constructor(serverConfig: unknown, clientConfig: unknown, logger: unknown, onReconnected?: () => Promise<void> | void, _tokenManager?: unknown, _requestIdGenerator?: unknown, _serverName?: string) {
        super("streamable-http", serverConfig, clientConfig, logger, onReconnected);
      }
    },
    OAuth2TokenManager: class {
      constructor(_logger?: unknown, _tokenStore?: unknown) {}
      getTokenForAuthCode() { return Promise.resolve("mock-token"); }
      getTokenForDeviceCode() { return Promise.resolve("mock-token"); }
      getToken() { return Promise.resolve("mock-token"); }
    },
    FileTokenStore: class {
      load() { return null; }
      save() {}
      remove() {}
      list() { return {}; }
    },
    createToolParameters: state.createToolParameters,
    setSchemaLogger: state.setSchemaLogger,
    fetchToolsList: state.fetchToolsList,
    initializeProtocol: state.initializeProtocol,
    pickRegisteredToolName: state.pickRegisteredToolName,
    checkForUpdate: state.checkForUpdate,
    checkPluginUpdate: state.checkPluginUpdate,
    getUpdateNotice: state.getUpdateNotice,
    runUpdate: state.runUpdate,
    filterServers: state.filterServers,
    buildFilteredDescription: state.buildFilteredDescription,
    bootstrapCatalog: state.bootstrapCatalog,
    mergeRecipesIntoConfig: state.mergeRecipesIntoConfig,
  };
});

type ToolDef = {
  name: string;
  label?: string;
  description: string;
  parameters?: Record<string, unknown>;
  execute: (toolId: string, params: Record<string, unknown>) => Promise<any>;
};

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function settle(times = 4) {
  for (let i = 0; i < times; i += 1) {
    await tick();
  }
}

function createApi(pluginConfig: Record<string, unknown>) {
  const tools: ToolDef[] = [];
  const handlers = new Map<string, (...args: unknown[]) => Promise<void> | void>();
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  const api = {
    pluginConfig,
    logger,
    registerTool: vi.fn((tool: ToolDef) => {
      tools.push(tool);
    }),
    unregisterTool: vi.fn(),
    on: vi.fn((event: string, handler: (...args: unknown[]) => Promise<void> | void) => {
      handlers.set(event, handler);
    }),
  };

  return {
    api,
    logger,
    tools,
    handlers,
    getTool(name: string) {
      const tool = tools.find((t) => t.name === name);
      if (!tool) throw new Error(`Tool not registered: ${name}`);
      return tool;
    },
    async deactivate() {
      const handler = handlers.get("deactivate");
      await handler?.();
    },
  };
}

describe("openclaw-mcp-bridge plugin", () => {
  beforeEach(async () => {
    vi.resetModules();
    bridgeMock.state.reset();
    vi.stubGlobal("require", (id: string) => {
      if (id === "./package.json") return { version: "0.0.0-test" };
      throw new Error(`Unexpected require: ${id}`);
    });
  });

  describe("router mode", () => {
    it("registers mcp tool and uses default description when smartFilter disabled", async () => {
      const { default: activate } = await import("../index");
      const ctx = createApi({ mode: "router", servers: { srv: { transport: "sse", url: "http://x" } } });

      activate(ctx.api as any);

      expect(ctx.getTool("mcp").description).toBe("router-description");
      expect(bridgeMock.state.filterServers).not.toHaveBeenCalled();
    });

    it("uses filtered router description when smartFilter returns filtered", async () => {
      bridgeMock.state.filterServers.mockReturnValue({ reason: "filtered", filteredServers: ["a"] });
      bridgeMock.state.buildFilteredDescription.mockReturnValue("smart-desc");
      const { default: activate } = await import("../index");
      const ctx = createApi({
        mode: "router",
        smartFilter: { enabled: true },
        servers: {
          a: { transport: "sse", url: "http://a" },
          b: { transport: "sse", url: "http://b" },
        },
      });

      activate(ctx.api as any);

      expect(ctx.getTool("mcp").description).toBe("smart-desc");
      expect(bridgeMock.state.filterServers).toHaveBeenCalledTimes(1);
      expect(bridgeMock.state.buildFilteredDescription).toHaveBeenCalledTimes(1);
    });

    it("falls back to full description when smartFilter result is not filtered", async () => {
      bridgeMock.state.filterServers.mockReturnValue({ reason: "error", filteredServers: [] });
      const { default: activate } = await import("../index");
      const ctx = createApi({ mode: "router", smartFilter: { enabled: true }, servers: { srv: { transport: "sse", url: "http://x" } } });

      activate(ctx.api as any);

      expect(ctx.getTool("mcp").description).toBe("router-description");
      expect(bridgeMock.state.buildFilteredDescription).not.toHaveBeenCalled();
    });

    it("registers mcp tool schema and dispatches call", async () => {
      const { default: activate } = await import("../index");
      const ctx = createApi({ mode: "router", servers: { srv: { transport: "sse", url: "http://x" } } });

      activate(ctx.api as any);
      const mcpTool = ctx.getTool("mcp");
      await mcpTool.execute("mcp", { server: "srv", action: "call", tool: "t", params: { q: 1 } });

      expect(mcpTool.parameters).toMatchObject({
        type: "object",
        properties: {
          server: expect.any(Object),
          action: expect.any(Object),
          tool: expect.any(Object),
          params: expect.any(Object),
          intent: expect.any(Object),
          calls: expect.any(Object),
        },
      });
      expect(bridgeMock.state.routerInstances[0].dispatch).toHaveBeenCalledWith("srv", "call", "t", { q: 1 });
    });

    it("injects update notice into router text content", async () => {
      bridgeMock.state.getUpdateNotice.mockReturnValue("\nNOTICE");
      const { default: activate } = await import("../index");
      const ctx = createApi({ mode: "router", servers: { srv: { transport: "sse", url: "http://x" } } });
      bridgeMock.state.routerInstances.length = 0;

      activate(ctx.api as any);
      bridgeMock.state.routerInstances[0].dispatch.mockResolvedValue({ content: [{ type: "text", text: "base" }] });

      const result = await ctx.getTool("mcp").execute("mcp", {});
      expect(result.content[0].text).toBe("base\nNOTICE");
    });

    it("injects update notice for string results", async () => {
      bridgeMock.state.getUpdateNotice.mockReturnValue(" +notice");
      const { default: activate } = await import("../index");
      const ctx = createApi({ mode: "router", servers: { srv: { transport: "sse", url: "http://x" } } });

      activate(ctx.api as any);
      bridgeMock.state.routerInstances[0].dispatch.mockResolvedValue("raw-result");

      const result = await ctx.getTool("mcp").execute("mcp", {});
      expect(result).toBe("raw-result +notice");
    });

    it("injects update notice as new content when content array is empty", async () => {
      bridgeMock.state.getUpdateNotice.mockReturnValue("notice");
      const { default: activate } = await import("../index");
      const ctx = createApi({ mode: "router", servers: { srv: { transport: "sse", url: "http://x" } } });

      activate(ctx.api as any);
      bridgeMock.state.routerInstances[0].dispatch.mockResolvedValue({ content: [] });

      const result = await ctx.getTool("mcp").execute("mcp", {});
      expect(result.content).toEqual([{ type: "text", text: "notice" }]);
    });

    it("returns original result when no update notice is available", async () => {
      bridgeMock.state.getUpdateNotice.mockReturnValue("");
      const { default: activate } = await import("../index");
      const ctx = createApi({ mode: "router", servers: { srv: { transport: "sse", url: "http://x" } } });

      activate(ctx.api as any);
      bridgeMock.state.routerInstances[0].dispatch.mockResolvedValue({ content: [{ type: "text", text: "x" }] });

      const result = await ctx.getTool("mcp").execute("mcp", {});
      expect(result.content[0].text).toBe("x");
    });

    it("registers mcp_bridge_update tool and supports check_only=true", async () => {
      bridgeMock.state.checkForUpdate.mockResolvedValue({ updateAvailable: true, currentVersion: "1.0.0", latestVersion: "1.2.0" });
      const { default: activate } = await import("../index");
      const ctx = createApi({ mode: "router", servers: { srv: { transport: "sse", url: "http://x" } } });

      activate(ctx.api as any);
      const result = await ctx.getTool("mcp_bridge_update").execute("mcp_bridge_update", { check_only: true });

      expect(result.content[0].text).toContain("Update available: 1.0.0 → 1.2.0");
      expect(bridgeMock.state.runUpdate).not.toHaveBeenCalled();
    });

    it("mcp_bridge_update check_only returns up-to-date message", async () => {
      bridgeMock.state.checkForUpdate.mockResolvedValue({ updateAvailable: false, currentVersion: "1.2.0", latestVersion: "1.2.0" });
      const { default: activate } = await import("../index");
      const ctx = createApi({ mode: "router", servers: { srv: { transport: "sse", url: "http://x" } } });

      activate(ctx.api as any);
      const result = await ctx.getTool("mcp_bridge_update").execute("mcp_bridge_update", { check_only: true });

      expect(result.content[0].text).toContain("v1.2.0 is up to date");
    });

    it("mcp_bridge_update installs update when check_only is false", async () => {
      bridgeMock.state.runUpdate.mockResolvedValue("install complete");
      const { default: activate } = await import("../index");
      const ctx = createApi({ mode: "router", servers: { srv: { transport: "sse", url: "http://x" } } });

      activate(ctx.api as any);
      const result = await ctx.getTool("mcp_bridge_update").execute("mcp_bridge_update", {});

      expect(result.content[0].text).toBe("install complete");
      expect(bridgeMock.state.runUpdate).toHaveBeenCalledTimes(1);
    });

    it("deactivation unregisters router tool and disconnects router", async () => {
      const { default: activate } = await import("../index");
      const ctx = createApi({ mode: "router", servers: { srv: { transport: "sse", url: "http://x" } } });

      activate(ctx.api as any);
      await ctx.deactivate();

      expect(ctx.api.unregisterTool).toHaveBeenCalledWith("mcp");
      expect(bridgeMock.state.routerInstances[0].disconnectAll).toHaveBeenCalledTimes(1);
    });
  });

  describe("direct mode", () => {
    it("registers individual server tools with default prefixed names", async () => {
      bridgeMock.state.fetchToolsList.mockResolvedValue([{ name: "search", description: "Search docs", inputSchema: {} }]);
      const { default: activate } = await import("../index");
      const ctx = createApi({ mode: "direct", servers: { alpha: { transport: "sse", url: "http://x" } } });

      activate(ctx.api as any);
      await settle();

      expect(ctx.getTool("alpha_search").description).toBe("Search docs");
    });

    it("supports toolPrefix=false naming", async () => {
      bridgeMock.state.fetchToolsList.mockResolvedValue([{ name: "search", description: "Search docs", inputSchema: {} }]);
      const { default: activate } = await import("../index");
      const ctx = createApi({ mode: "direct", toolPrefix: false, servers: { alpha: { transport: "sse", url: "http://x" } } });

      activate(ctx.api as any);
      await settle();

      expect(ctx.getTool("search").description).toBe("Search docs");
    });

    it("supports toolPrefix=auto collision naming", async () => {
      bridgeMock.state.fetchToolsList.mockResolvedValue([{ name: "search", description: "Search docs", inputSchema: {} }]);
      const { default: activate } = await import("../index");
      const ctx = createApi({
        mode: "direct",
        toolPrefix: "auto",
        servers: {
          alpha: { transport: "sse", url: "http://a" },
          beta: { transport: "sse", url: "http://b" },
        },
      });

      activate(ctx.api as any);
      await settle(8);

      expect(ctx.getTool("search")).toBeTruthy();
      expect(ctx.getTool("beta_search")).toBeTruthy();
    });

    it("registers tool with parameters converted via createToolParameters", async () => {
      bridgeMock.state.fetchToolsList.mockResolvedValue([{ name: "search", description: "Search docs", inputSchema: { type: "object" } }]);
      bridgeMock.state.createToolParameters.mockResolvedValue({ type: "object", properties: { q: { type: "string" } } });
      const { default: activate } = await import("../index");
      const ctx = createApi({ mode: "direct", servers: { alpha: { transport: "sse", url: "http://x" } } });

      activate(ctx.api as any);
      await settle();

      expect(bridgeMock.state.createToolParameters).toHaveBeenCalledWith({ type: "object" });
      expect(ctx.getTool("alpha_search").parameters).toEqual({ type: "object", properties: { q: { type: "string" } } });
    });

    it("initializes stdio, sse, and streamable-http transports", async () => {
      const { default: activate } = await import("../index");
      const ctx = createApi({
        mode: "direct",
        servers: {
          std: { transport: "stdio", command: "node", args: ["server.js"], env: { A: "1" } },
          sse: { transport: "sse", url: "http://sse" },
          http: { transport: "streamable-http", url: "http://http", headers: { X: "1" } },
        },
      });

      activate(ctx.api as any);
      await settle(8);

      const kinds = bridgeMock.state.transports.map((t: { kind: string }) => t.kind).sort();
      expect(kinds).toEqual(["sse", "stdio", "streamable-http"]);
    });

    it("passes server config into transport constructors", async () => {
      const { default: activate } = await import("../index");
      const stdioConfig = { transport: "stdio", command: "node", args: ["tool.mjs"], env: { TOKEN: "abc" } };
      const ctx = createApi({ mode: "direct", servers: { local: stdioConfig } });

      activate(ctx.api as any);
      await settle();

      expect(bridgeMock.state.transports[0].serverConfig).toEqual(stdioConfig);
    });

    it("refresh lock queues concurrent reconnect and processes queued refresh", async () => {
      let protocolCalls = 0;
      let releaseRefresh: (() => void) | null = null;
      const refreshWait = new Promise<void>((resolve) => {
        releaseRefresh = resolve;
      });

      bridgeMock.state.fetchToolsList.mockResolvedValue([{ name: "search", description: "Search docs", inputSchema: {} }]);
      bridgeMock.state.initializeProtocol.mockImplementation(async () => {
        protocolCalls += 1;
        if (protocolCalls === 2) {
          await refreshWait;
        }
      });

      const { default: activate } = await import("../index");
      const ctx = createApi({ mode: "direct", servers: { alpha: { transport: "sse", url: "http://x" } } });

      activate(ctx.api as any);
      await settle();

      const transport = bridgeMock.state.transports[0];
      const p1 = transport.triggerReconnect();
      const p2 = transport.triggerReconnect();

      await tick();
      expect(ctx.logger.info).toHaveBeenCalledWith("[mcp-bridge] Refresh already in progress for alpha, queuing");

      if (releaseRefresh) releaseRefresh();
      await Promise.all([p1, p2]);
      await settle();

      expect(bridgeMock.state.initializeProtocol).toHaveBeenCalledTimes(3);
      expect(ctx.logger.info).toHaveBeenCalledWith("[mcp-bridge] Processing queued refresh for alpha");
    });

    it("deactivation unregisters direct mode tools and disconnects connections", async () => {
      bridgeMock.state.fetchToolsList.mockResolvedValue([{ name: "search", description: "Search docs", inputSchema: {} }]);
      const { default: activate } = await import("../index");
      const ctx = createApi({ mode: "direct", servers: { alpha: { transport: "sse", url: "http://x" } } });

      activate(ctx.api as any);
      await settle();
      await ctx.deactivate();

      expect(ctx.api.unregisterTool).toHaveBeenCalledWith("alpha_search");
      expect(bridgeMock.state.transports[0].disconnect).toHaveBeenCalledTimes(1);
    });

    it("deactivation logs disconnect errors and keeps going", async () => {
      bridgeMock.state.fetchToolsList.mockResolvedValue([{ name: "a", description: "A", inputSchema: {} }]);
      const { default: activate } = await import("../index");
      const ctx = createApi({ mode: "direct", servers: { alpha: { transport: "sse", url: "http://x" } } });

      activate(ctx.api as any);
      await settle();

      bridgeMock.state.transports[0].disconnect.mockRejectedValue(new Error("boom"));
      await ctx.deactivate();

      expect(ctx.logger.error).toHaveBeenCalledWith("[mcp-bridge] Error disconnecting from alpha:", expect.any(Error));
    });

    it("deactivation warns when unregisterTool throws", async () => {
      bridgeMock.state.fetchToolsList.mockResolvedValue([{ name: "search", description: "Search docs", inputSchema: {} }]);
      const { default: activate } = await import("../index");
      const ctx = createApi({ mode: "direct", servers: { alpha: { transport: "sse", url: "http://x" } } });
      ctx.api.unregisterTool = vi.fn(() => {
        throw new Error("cannot unregister");
      }) as any;

      activate(ctx.api as any);
      await settle();
      await ctx.deactivate();

      expect(ctx.logger.warn).toHaveBeenCalledWith("[mcp-bridge] Failed to unregister tool alpha_search during deactivation:", expect.any(Error));
    });
  });

  it("returns early when no servers configured", async () => {
    const { default: activate } = await import("../index");
    const ctx = createApi({ mode: "direct", servers: {} });

    activate(ctx.api as any);

    expect(ctx.api.registerTool).not.toHaveBeenCalled();
    expect(ctx.logger.info).toHaveBeenCalledWith("[mcp-bridge] No servers configured, plugin inactive");
  });

  describe("catalog and autoMerge passthrough", () => {
    it("passes catalog option to bootstrapCatalog", async () => {
      const { default: activate } = await import("../index");
      const ctx = createApi({ mode: "router", catalog: false, servers: { srv: { transport: "sse", url: "http://x" } } });

      activate(ctx.api as any);
      await settle();

      expect(bridgeMock.state.bootstrapCatalog).toHaveBeenCalledWith(
        expect.objectContaining({ catalog: false })
      );
    });

    it("passes autoMerge option to mergeRecipesIntoConfig", async () => {
      const { default: activate } = await import("../index");
      const ctx = createApi({ mode: "router", autoMerge: true, servers: { srv: { transport: "sse", url: "http://x" } } });

      activate(ctx.api as any);
      await settle();

      expect(bridgeMock.state.mergeRecipesIntoConfig).toHaveBeenCalledWith(
        expect.objectContaining({ autoMerge: true }),
        expect.any(Object)
      );
    });

    it("omits catalog and autoMerge when not set in config", async () => {
      const { default: activate } = await import("../index");
      const ctx = createApi({ mode: "router", servers: { srv: { transport: "sse", url: "http://x" } } });

      activate(ctx.api as any);
      await settle();

      expect(bridgeMock.state.bootstrapCatalog).toHaveBeenCalledWith(
        expect.objectContaining({ catalog: undefined })
      );
      expect(bridgeMock.state.mergeRecipesIntoConfig).toHaveBeenCalledWith(
        expect.objectContaining({ autoMerge: undefined }),
        expect.any(Object)
      );
    });
  });
});
