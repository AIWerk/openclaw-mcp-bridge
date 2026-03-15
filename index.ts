import {
  McpRouter,
  SseTransport,
  StdioTransport,
  StreamableHttpTransport,
  createToolParameters,
  setSchemaLogger,
  fetchToolsList,
  initializeProtocol,
  PACKAGE_VERSION,
  pickRegisteredToolName,
  checkForUpdate,
  checkPluginUpdate,
  getUpdateNotice,
  runUpdate,
  filterServers,
  buildFilteredDescription,
} from "@aiwerk/mcp-bridge";
import type { McpClientConfig, McpServerConfig, McpServerConnection, McpTransport, McpTool, McpRequest } from "@aiwerk/mcp-bridge";
import type { OpenClawPluginApi, PluginClientConfig } from "./types.js";

export default function activate(api: OpenClawPluginApi) {
  const config = (api.pluginConfig ?? {}) as PluginClientConfig;
  const mode = config.mode ?? "direct";
  setSchemaLogger(api.logger);
  const connections = new Map<string, McpServerConnection>();
  const globalRegisteredToolNames = new Set<string>();
  const router = mode === "router" ? new McpRouter(config.servers || {}, config, api.logger) : null;

  if (!config.servers || Object.keys(config.servers).length === 0) {
    api.logger.info("[mcp-bridge] No servers configured, plugin inactive");
    return;
  }

  // Fire-and-forget version checks (non-blocking) — core + plugin
  const PLUGIN_NAME = "@aiwerk/openclaw-mcp-bridge";
  const PLUGIN_VERSION = require("./package.json").version as string;
  checkForUpdate(api.logger).catch(() => {});
  checkPluginUpdate(PLUGIN_NAME, PLUGIN_VERSION, api.logger).catch(() => {});

  // Register the manual update tool
  registerUpdateTool();

  if (mode === "router") {
    registerRouterTool();
  } else {
    // Initialize connections to all configured servers
    initializeServers();
  }

  function injectUpdateNotice(result: any): any {
    const notice = getUpdateNotice();
    if (!notice) return result;
    // Append notice to the last text content item
    if (result?.content && Array.isArray(result.content) && result.content.length > 0) {
      const lastText = [...result.content].reverse().find((c: any) => c.type === "text");
      if (lastText) {
        lastText.text += notice;
        return result;
      }
    }
    // Fallback: if result is a string
    if (typeof result === "string") return result + notice;
    // Fallback: add as new content item
    if (result?.content && Array.isArray(result.content)) {
      result.content.push({ type: "text", text: notice });
    }
    return result;
  }

  function registerUpdateTool() {
    api.registerTool({
      name: "mcp_bridge_update",
      label: "Update MCP Bridge plugin",
      description: "Check for and install updates to the MCP Bridge plugin (@aiwerk/openclaw-mcp-bridge). Run this when an update is available or to check manually.",
      parameters: {
        type: "object",
        properties: {
          check_only: {
            type: "boolean",
            description: "If true, only check for updates without installing"
          }
        }
      },
      async execute(_toolId: string, params: Record<string, unknown>) {
        const checkOnly = params?.check_only === true;
        if (checkOnly) {
          const info = await checkForUpdate(api.logger);
          if (info.updateAvailable) {
            return {
              content: [{
                type: "text",
                text: `⬆️ Update available: ${info.currentVersion} → ${info.latestVersion}\nRun this tool again without check_only to install.`
              }]
            };
          }
          return {
            content: [{
              type: "text",
              text: `✅ MCP Bridge v${info.currentVersion} is up to date.`
            }]
          };
        }
        const result = await runUpdate(api.logger);
        return {
          content: [{ type: "text", text: result }]
        };
      }
    });
  }

  /**
   * Build the router tool description, optionally filtered by smart filter.
   * Synchronous — the smart filter is pure keyword matching, no I/O.
   */
  function getRouterDescription(userTurns?: string[]): string {
    const sf = config.smartFilter;
    if (!sf?.enabled) {
      return McpRouter.generateDescription(config.servers);
    }
    const result = filterServers(config.servers, userTurns ?? [], sf, api.logger);
    if (result.reason !== "filtered") {
      return McpRouter.generateDescription(config.servers);
    }
    return buildFilteredDescription(config.servers, result.filteredServers);
  }

  function registerRouterTool() {
    api.registerTool({
      name: "mcp",
      label: "MCP Router",
      description: getRouterDescription(),
      parameters: {
        type: "object",
        properties: {
          server: { type: "string", description: "Server name (optional for action=intent/batch/status)" },
          action: { type: "string", description: "list | call | refresh | batch | status | intent | schema | promotions", default: "call" },
          tool: { type: "string", description: "Tool name for action=call/schema" },
          params: { type: "object", description: "Tool arguments for action=call" },
          intent: { type: "string", description: "Natural language intent for action=intent" },
          calls: { type: "array", description: "Array of {server, tool, params} for action=batch", items: { type: "object" } }
        },
        required: []
      },
      async execute(_toolId: string, params: Record<string, unknown>) {
        const result = await router!.dispatch(
          params?.server as string,
          params?.action as string,
          params?.tool as string,
          params?.params as Record<string, unknown> | undefined
        );
        return injectUpdateNotice(result);
      }
    });
  }

  async function initializeServers() {
    const serverEntries = Object.entries(config.servers);
    const results = await Promise.allSettled(
      serverEntries.map(async ([serverName, serverConfig]) => {
        api.logger.info(`[mcp-bridge] Connecting to server: ${serverName} (${serverConfig.transport}: ${serverConfig.url || serverConfig.command})`);
        await initializeServer(serverName, serverConfig, false);
        return serverName;
      })
    );

    let succeeded = 0;
    let failed = 0;
    const successfulConnections: McpServerConnection[] = [];

    results.forEach((result, idx) => {
      const serverName = serverEntries[idx][0];
      if (result.status === "fulfilled") {
        succeeded += 1;
        api.logger.info(`[mcp-bridge] Startup success: ${serverName}`);
        const conn = connections.get(serverName);
        if (conn) {
          successfulConnections.push(conn);
        }
      } else {
        failed += 1;
        const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
        api.logger.error(`[mcp-bridge] Startup failed: ${serverName}: ${reason}`);
      }
    });

    // Register all tools sequentially after discovery to avoid cross-server name race conditions.
    for (const connection of successfulConnections) {
      await registerServerTools(connection);
      connection.isInitialized = true;
      api.logger.info(`[mcp-bridge] Server ${connection.name} initialized, registered ${connection.tools.length} tools`);
    }

    api.logger.info(`[mcp-bridge] Server startup complete: ${succeeded} succeeded, ${failed} failed`);
  }

  async function initializeServer(name: string, serverConfig: McpServerConfig, registerTools = true): Promise<void> {
    let transport: McpTransport;

    // Create connection object first (needed for reconnect callback)
    const connection: McpServerConnection = {
      name,
      transport: null as any, // Will be set below
      tools: [],
      isInitialized: false,
      registeredToolNames: []
    };

    // Refresh lock to prevent concurrent re-initialization (reconnect + tools/list_changed race)
    let refreshInProgress = false;
    let refreshQueued = false;

    const refreshConnection = async () => {
      if (refreshInProgress) {
        refreshQueued = true;
        api.logger.info(`[mcp-bridge] Refresh already in progress for ${name}, queuing`);
        return;
      }
      refreshInProgress = true;
      try {
        api.logger.info(`[mcp-bridge] Re-initializing server: ${name}`);
        connection.isInitialized = false;
        connection.tools = [];

        await initializeProtocol(connection.transport, PACKAGE_VERSION);
        await discoverTools(connection);
        await registerServerTools(connection);

        connection.isInitialized = true;
        api.logger.info(`[mcp-bridge] Server ${name} re-initialized, registered ${connection.tools.length} tools`);
      } catch (error) {
        api.logger.error(`[mcp-bridge] Failed to re-initialize server ${name}:`, error);
      } finally {
        refreshInProgress = false;
        if (refreshQueued) {
          refreshQueued = false;
          api.logger.info(`[mcp-bridge] Processing queued refresh for ${name}`);
          await refreshConnection();
        }
      }
    };

    // Used by both reconnect and notifications/tools/list_changed
    const onReconnected = refreshConnection;

    // Create appropriate transport with reconnection callback
    if (serverConfig.transport === "sse") {
      transport = new SseTransport(serverConfig, config, api.logger, onReconnected);
    } else if (serverConfig.transport === "stdio") {
      transport = new StdioTransport(serverConfig, config, api.logger, onReconnected);
    } else if (serverConfig.transport === "streamable-http") {
      transport = new StreamableHttpTransport(serverConfig, config, api.logger, onReconnected);
    } else {
      throw new Error(`Unsupported transport: ${serverConfig.transport}`);
    }

    connection.transport = transport;
    connections.set(name, connection);

    try {
      // Connect to the server
      await transport.connect();
      api.logger.info(`[mcp-bridge] Connected to server: ${name}`);

      // Initialize the MCP protocol
      await initializeProtocol(connection.transport, PACKAGE_VERSION);

      // Get available tools
      await discoverTools(connection);
      if (registerTools) {
        // Register tools with OpenClaw
        await registerServerTools(connection);
        connection.isInitialized = true;
        api.logger.info(`[mcp-bridge] Server ${name} initialized, registered ${connection.tools.length} tools`);
      }

    } catch (error) {
      api.logger.error(`[mcp-bridge] Failed to initialize server ${name}:`, error);
      connections.delete(name);
      throw error;
    }
  }

  async function discoverTools(connection: McpServerConnection): Promise<void> {
    connection.tools = await fetchToolsList(connection.transport);
  }

  async function registerServerTools(connection: McpServerConnection): Promise<void> {
    for (const oldName of connection.registeredToolNames) {
      globalRegisteredToolNames.delete(oldName);
    }

    const usedToolNames = new Set<string>();
    const nextToolRegistrations = connection.tools.map((mcpTool) => {
      const registeredName = pickRegisteredToolName(
        connection.name,
        mcpTool.name,
        config.toolPrefix,
        usedToolNames,
        globalRegisteredToolNames,
        api.logger
      );
      usedToolNames.add(registeredName);
      return { mcpTool, registeredName };
    });
    const nextToolNames = nextToolRegistrations.map((entry) => entry.registeredName);

    const oldToolNames = connection.registeredToolNames;
    if (oldToolNames.length > 0) {
      if (typeof api.unregisterTool === "function") {
        for (const oldName of oldToolNames) {
          try {
            api.unregisterTool(oldName);
          } catch (error) {
            api.logger.warn(`[mcp-bridge] Failed to unregister tool ${oldName}:`, error);
          }
        }
      } else {
        const oldSorted = [...oldToolNames].sort();
        const nextSorted = [...nextToolNames].sort();
        const changed = oldSorted.length !== nextSorted.length || oldSorted.some((name, idx) => name !== nextSorted[idx]);
        if (changed) {
          api.logger.warn(`[mcp-bridge] Tool list changed for ${connection.name}, but unregisterTool API is unavailable. Existing tool registrations may remain stale.`);
        }
      }
    }

    connection.registeredToolNames = [];

    for (const { mcpTool, registeredName } of nextToolRegistrations) {
      try {
        const actualName = await registerMcpTool(connection, mcpTool, registeredName);
        connection.registeredToolNames.push(actualName);
        globalRegisteredToolNames.add(actualName);
      } catch (error) {
        api.logger.error(`[mcp-bridge] Failed to register tool ${mcpTool.name}:`, error);
      }
    }
  }

  async function registerMcpTool(connection: McpServerConnection, mcpTool: McpTool, validToolName: string): Promise<string> {
    // Create tool description (truncate for label)
    const label = mcpTool.description.length > 80
      ? mcpTool.description.substring(0, 77) + "..."
      : mcpTool.description;

    // Convert JSON Schema to TypeBox schema
    const parameters = await createToolParameters(mcpTool.inputSchema);

    // Register the tool with OpenClaw
    api.registerTool({
      name: validToolName,
      label: label,
      description: mcpTool.description,
      parameters: parameters,
      async execute(toolId: string, params: Record<string, unknown>) {
        try {
          return await executeMcpTool(connection, mcpTool.name, params);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          api.logger.error(`[mcp-bridge] Tool execution failed (server: ${connection.name}, tool: ${mcpTool.name}): ${errorMsg}`);
          return {
            content: [{
              type: "text",
              text: `Tool execution failed for ${connection.name}.${mcpTool.name}: ${errorMsg}`
            }]
          };
        }
      }
    });

    return validToolName;
  }

  async function executeMcpTool(
    connection: McpServerConnection,
    toolName: string,
    params: Record<string, unknown>
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    try {
      // Check connection state first
      if (!connection.transport.isConnected()) {
        throw new Error(`Server ${connection.name} connection lost`);
      }

      // Check if connection is properly initialized
      if (!connection.isInitialized) {
        throw new Error(`Server ${connection.name} not properly initialized`);
      }

      const callRequest: McpRequest = {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: toolName,
          arguments: params
        }
      };

      const response = await connection.transport.sendRequest(callRequest);

      if (response.error) {
        const code = response.error.code ? ` [code ${response.error.code}]` : "";
        throw new Error(`MCP error from ${connection.name}${code}: ${response.error.message}`);
      }

      // Extract content from response
      const result = response.result || {};
      const content = result.content || [];

      // Ensure content is in the expected format
      if (!Array.isArray(content)) {
        return {
          content: [{
            type: "text",
            text: typeof result === "string" ? result : JSON.stringify(result)
          }]
        };
      }

      // Convert content to expected format
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formattedContent = content.map((item: any) => ({
        type: String(item.type || "text"),
        text: String(item.text || item.content || JSON.stringify(item))
      }));

      return injectUpdateNotice({ content: formattedContent });
    } catch (error) {
      // Wrap connection-related errors with server context
      if (error instanceof Error) {
        if (error.message.includes("connection") || error.message.includes("timeout")) {
          throw new Error(`Connection error with server ${connection.name}: ${error.message}`);
        }
        // Re-throw with original message if already has context
        throw error;
      }
      throw new Error(`Unknown error executing tool ${toolName} on server ${connection.name}: ${String(error)}`);
    }
  }

  // Cleanup on deactivation
  api.on("deactivate", async () => {
    api.logger.info("[mcp-bridge] Deactivating, closing connections and unregistering tools");
    if (mode === "router") {
      if (typeof api.unregisterTool === "function") {
        try {
          api.unregisterTool("mcp");
        } catch (error) {
          api.logger.warn("[mcp-bridge] Failed to unregister mcp router tool during deactivation:", error);
        }
      }
      await router!.disconnectAll();
      return;
    }

    for (const connection of connections.values()) {
      // Unregister tools first
      if (typeof api.unregisterTool === "function") {
        for (const toolName of connection.registeredToolNames) {
          try {
            api.unregisterTool(toolName);
            globalRegisteredToolNames.delete(toolName);
          } catch (error) {
            api.logger.warn(`[mcp-bridge] Failed to unregister tool ${toolName} during deactivation:`, error);
          }
        }
      }
      try {
        await connection.transport.disconnect();
      } catch (error) {
        api.logger.error(`[mcp-bridge] Error disconnecting from ${connection.name}:`, error);
      }
    }
    connections.clear();
    globalRegisteredToolNames.clear();
  });

  api.logger.info(`[mcp-bridge] Plugin activated with ${Object.keys(config.servers).length} servers configured`);
}
