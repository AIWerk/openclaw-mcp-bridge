import {
  McpClientConfig,
  McpServerConfig,
  McpTool,
  McpTransport
} from "./types.js";
import { SseTransport } from "./transport-sse.js";
import { StdioTransport } from "./transport-stdio.js";
import { StreamableHttpTransport } from "./transport-streamable-http.js";
import { fetchToolsList, initializeProtocol, PLUGIN_VERSION } from "./protocol.js";

type RouterErrorCode =
  | "unknown_server"
  | "unknown_tool"
  | "connection_failed"
  | "mcp_error"
  | "invalid_params";

export interface RouterToolHint {
  name: string;
  description: string;
  requiredParams: string[];
}

export interface RouterServerStatus {
  name: string;
  transport: string;
  status: "connected" | "idle" | "disconnected";
  tools: number;
  lastUsed?: string;
}

export type RouterDispatchResponse =
  | { server: string; action: "list"; tools: RouterToolHint[] }
  | { server: string; action: "refresh"; refreshed: true; tools: RouterToolHint[] }
  | { server: string; action: "call"; tool: string; result: any }
  | { action: "status"; servers: RouterServerStatus[] }
  | {
      error: RouterErrorCode;
      message: string;
      available?: string[];
      code?: number;
    };

export interface RouterTransportRefs {
  sse: new (config: McpServerConfig, clientConfig: McpClientConfig, logger: any, onReconnected?: () => Promise<void>) => McpTransport;
  stdio: new (config: McpServerConfig, clientConfig: McpClientConfig, logger: any, onReconnected?: () => Promise<void>) => McpTransport;
  streamableHttp: new (config: McpServerConfig, clientConfig: McpClientConfig, logger: any, onReconnected?: () => Promise<void>) => McpTransport;
}

interface RouterServerState {
  transport: McpTransport;
  initialized: boolean;
  toolsCache?: RouterToolHint[];
  toolNames: string[];
  lastUsedAt: number;
  idleTimer: NodeJS.Timeout | null;
  initPromise?: Promise<void>;
}

const DEFAULT_IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_MAX_CONCURRENT = 5;

export class McpRouter {
  private readonly servers: Record<string, McpServerConfig>;
  private readonly clientConfig: McpClientConfig;
  private readonly logger: any;
  private readonly transportRefs: RouterTransportRefs;
  private readonly idleTimeoutMs: number;
  private readonly maxConcurrent: number;
  private readonly states = new Map<string, RouterServerState>();

  constructor(
    servers: Record<string, McpServerConfig>,
    clientConfig: McpClientConfig,
    logger: any,
    transportRefs?: Partial<RouterTransportRefs>
  ) {
    this.servers = servers;
    this.clientConfig = clientConfig;
    this.logger = logger;
    this.transportRefs = {
      sse: transportRefs?.sse ?? SseTransport,
      stdio: transportRefs?.stdio ?? StdioTransport,
      streamableHttp: transportRefs?.streamableHttp ?? StreamableHttpTransport
    };
    this.idleTimeoutMs = clientConfig.routerIdleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
    this.maxConcurrent = clientConfig.routerMaxConcurrent ?? DEFAULT_MAX_CONCURRENT;
  }

  static generateDescription(servers: Record<string, McpServerConfig>): string {
    const serverNames = Object.keys(servers);
    if (serverNames.length === 0) {
      return "Call MCP server tools. No servers configured.";
    }

    const serverList = serverNames
      .map((name) => {
        const desc = servers[name].description;
        return desc ? `${name} (${desc})` : name;
      })
      .join(", ");

    return `Call any MCP server tool. Servers: ${serverList}. Use action='list' to discover tools and required parameters, action='call' to execute a tool, action='refresh' to clear cache and re-discover tools, and action='status' to check server connection states. If the user mentions a specific tool by name, the call action auto-connects and works without listing first.`;
  }

  async dispatch(server?: string, action: string = "call", tool?: string, params?: any): Promise<RouterDispatchResponse> {
    try {
      const normalizedAction = action || "call";

      // Status action: no server required, shows all server states
      if (normalizedAction === "status") {
        return this.getStatus();
      }

      if (!server) {
        return this.error("invalid_params", "server is required");
      }
      if (!this.servers[server]) {
        return this.error("unknown_server", `Server '${server}' not found`, Object.keys(this.servers));
      }
      if (normalizedAction === "list") {
        try {
          const tools = await this.getToolList(server);
          return { server, action: "list", tools };
        } catch (error) {
          return this.error("connection_failed", `Failed to connect to ${server}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      if (normalizedAction === "refresh") {
        try {
          const state = await this.ensureConnected(server);
          state.toolsCache = undefined;
          state.toolNames = [];
          const tools = await this.getToolList(server);
          return { server, action: "refresh", refreshed: true, tools };
        } catch (error) {
          return this.error("connection_failed", `Failed to connect to ${server}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      if (normalizedAction !== "call") {
        return this.error("invalid_params", `action must be one of: list, call, refresh`);
      }

      if (!tool) {
        return this.error("invalid_params", "tool is required for action=call");
      }

      try {
        await this.getToolList(server);
      } catch (error) {
        return this.error("connection_failed", `Failed to connect to ${server}: ${error instanceof Error ? error.message : String(error)}`);
      }
      const state = this.states.get(server)!;

      if (!state.toolNames.includes(tool)) {
        return this.error("unknown_tool", `Tool '${tool}' not found on server '${server}'`, state.toolNames);
      }

      this.markUsed(server);
      const response = await state.transport.sendRequest({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: tool,
          arguments: params ?? {}
        }
      });

      if (response.error) {
        return this.error("mcp_error", response.error.message, undefined, response.error.code);
      }

      return { server, action: "call", tool, result: response.result };
    } catch (error) {
      return this.error("mcp_error", error instanceof Error ? error.message : String(error));
    }
  }

  async getToolList(server: string): Promise<RouterToolHint[]> {
    if (!this.servers[server]) {
      throw new Error(`Server '${server}' not found`);
    }

    const state = await this.ensureConnected(server);
    if (state.toolsCache) {
      this.markUsed(server);
      return state.toolsCache;
    }

    const tools = await fetchToolsList(state.transport);
    state.toolNames = tools.map((tool) => tool.name);
    state.toolsCache = tools.map((tool) => ({
      name: tool.name,
      description: tool.description || "",
      requiredParams: this.extractRequiredParams(tool)
    }));

    this.markUsed(server);
    return state.toolsCache;
  }

  private getStatus(): RouterDispatchResponse {
    const serverStatuses: RouterServerStatus[] = Object.entries(this.servers).map(([name, config]) => {
      const state = this.states.get(name);
      let status: "connected" | "idle" | "disconnected" = "disconnected";
      if (state?.transport.isConnected()) {
        const idleMs = Date.now() - state.lastUsedAt;
        status = idleMs > 60_000 ? "idle" : "connected";
      }
      return {
        name,
        transport: config.transport,
        status,
        tools: state?.toolNames.length ?? 0,
        ...(state?.lastUsedAt ? { lastUsed: new Date(state.lastUsedAt).toISOString() } : {})
      };
    });
    return { action: "status", servers: serverStatuses };
  }

  async disconnectAll(): Promise<void> {
    for (const serverName of Object.keys(this.servers)) {
      await this.disconnectServer(serverName);
    }
  }

  private async ensureConnected(server: string): Promise<RouterServerState> {
    let state = this.states.get(server);
    if (!state) {
      const transport = this.createTransport(server, this.servers[server]);
      state = {
        transport,
        initialized: false,
        toolNames: [],
        lastUsedAt: Date.now(),
        idleTimer: null
      };
      this.states.set(server, state);
    }

    if (state.initPromise) {
      await state.initPromise;
      return state;
    }

    state.initPromise = (async () => {
      if (!state!.transport.isConnected()) {
        await state!.transport.connect();
      }
      if (!state!.initialized) {
        await initializeProtocol(state!.transport, PLUGIN_VERSION);
        state!.initialized = true;
      }
      this.markUsed(server);
      await this.enforceMaxConcurrent(server);
    })();

    try {
      await state.initPromise;
      return state;
    } finally {
      state.initPromise = undefined;
    }
  }

  private async enforceMaxConcurrent(activeServer: string): Promise<void> {
    const connectedServers = [...this.states.entries()]
      .filter(([_, s]) => s.transport.isConnected())
      .map(([name, s]) => ({ name, lastUsedAt: s.lastUsedAt }));

    if (connectedServers.length <= this.maxConcurrent) {
      return;
    }

    connectedServers.sort((a, b) => a.lastUsedAt - b.lastUsedAt);
    for (const candidate of connectedServers) {
      if (candidate.name === activeServer) {
        continue;
      }
      await this.disconnectServer(candidate.name);
      this.logger.info(`[mcp-client] Router evicted idle server via LRU: ${candidate.name}`);
      return;
    }
  }

  private async disconnectServer(server: string): Promise<void> {
    const state = this.states.get(server);
    if (!state) return;

    if (state.idleTimer) {
      clearTimeout(state.idleTimer);
      state.idleTimer = null;
    }

    if (state.transport.isConnected()) {
      await state.transport.disconnect();
    }

    state.initialized = false;
    state.toolsCache = undefined;
    state.toolNames = [];
  }

  private markUsed(server: string): void {
    const state = this.states.get(server);
    if (!state) return;

    state.lastUsedAt = Date.now();

    if (state.idleTimer) {
      clearTimeout(state.idleTimer);
    }

    state.idleTimer = setTimeout(() => {
      this.disconnectServer(server).catch((error) => {
        this.logger.warn(`[mcp-client] Router idle disconnect failed for ${server}:`, error);
      });
    }, this.idleTimeoutMs);
  }

  private createTransport(serverName: string, serverConfig: McpServerConfig): McpTransport {
    const onReconnected = async () => {
      const state = this.states.get(serverName);
      if (!state) return;
      state.initialized = false;
      state.toolsCache = undefined;
      state.toolNames = [];
    };

    if (serverConfig.transport === "sse") {
      return new this.transportRefs.sse(serverConfig, this.clientConfig, this.logger, onReconnected);
    }
    if (serverConfig.transport === "stdio") {
      return new this.transportRefs.stdio(serverConfig, this.clientConfig, this.logger, onReconnected);
    }
    if (serverConfig.transport === "streamable-http") {
      return new this.transportRefs.streamableHttp(serverConfig, this.clientConfig, this.logger, onReconnected);
    }

    throw new Error(`Unsupported transport: ${serverConfig.transport}`);
  }

  private extractRequiredParams(tool: McpTool): string[] {
    const required = tool.inputSchema?.required;
    if (!Array.isArray(required)) {
      return [];
    }
    return required.filter((name: unknown) => typeof name === "string");
  }

  private error(error: RouterErrorCode, message: string, available?: string[], code?: number): RouterDispatchResponse {
    return {
      error,
      message,
      ...(available ? { available } : {}),
      ...(typeof code === "number" ? { code } : {})
    };
  }
}
