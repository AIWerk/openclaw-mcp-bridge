import {
  McpClientConfig,
  McpServerConfig,
  McpServerConnection,
  McpTransport,
  McpTool,
  McpRequest
} from "./types.js";
import { SseTransport } from "./transport-sse.js";
import { StdioTransport } from "./transport-stdio.js";
import { StreamableHttpTransport } from "./transport-streamable-http.js";
import { createToolParameters, setSchemaLogger } from "./schema-convert.js";

export default function activate(api: any) {
  const config = (api.pluginConfig ?? {}) as McpClientConfig;
  setSchemaLogger(api.logger);
  const connections = new Map<string, McpServerConnection>();
  
  if (!config.servers || Object.keys(config.servers).length === 0) {
    api.logger.info("[mcp-client] No servers configured, plugin inactive");
    return;
  }

  // Initialize connections to all configured servers
  initializeServers();

  async function initializeServers() {
    for (const [serverName, serverConfig] of Object.entries(config.servers)) {
      try {
        api.logger.info(`[mcp-client] Connecting to server: ${serverName} (${serverConfig.transport}: ${serverConfig.url || serverConfig.command})`);
        await initializeServer(serverName, serverConfig);
      } catch (error: any) {
        api.logger.error(`[mcp-client] Failed to initialize server ${serverName}:`, error?.message || error);
        // Continue with other servers, don't fail completely
      }
    }
  }

  async function initializeServer(name: string, serverConfig: McpServerConfig): Promise<void> {
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
        api.logger.info(`[mcp-client] Refresh already in progress for ${name}, queuing`);
        return;
      }
      refreshInProgress = true;
      try {
        api.logger.info(`[mcp-client] Re-initializing server: ${name}`);
        connection.isInitialized = false;
        connection.tools = [];
        
        await initializeProtocol(connection);
        await discoverTools(connection);
        registerServerTools(connection);

        connection.isInitialized = true;
        api.logger.info(`[mcp-client] Server ${name} re-initialized, registered ${connection.tools.length} tools`);
      } catch (error) {
        api.logger.error(`[mcp-client] Failed to re-initialize server ${name}:`, error);
      } finally {
        refreshInProgress = false;
        if (refreshQueued) {
          refreshQueued = false;
          api.logger.info(`[mcp-client] Processing queued refresh for ${name}`);
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
      api.logger.info(`[mcp-client] Connected to server: ${name}`);

      // Initialize the MCP protocol
      await initializeProtocol(connection);
      
      // Get available tools
      await discoverTools(connection);
      
      // Register tools with OpenClaw
      registerServerTools(connection);

      connection.isInitialized = true;
      api.logger.info(`[mcp-client] Server ${name} initialized, registered ${connection.tools.length} tools`);
      
    } catch (error) {
      api.logger.error(`[mcp-client] Failed to initialize server ${name}:`, error);
      connections.delete(name);
    }
  }

  async function initializeProtocol(connection: McpServerConnection): Promise<void> {
    // Send initialize request
    const initRequest: McpRequest = {
      jsonrpc: "2.0",
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "openclaw-mcp-client",
          version: "1.3.4"
        }
      }
    };

    const response = await connection.transport.sendRequest(initRequest);
    
    if (response.error) {
      throw new Error(`Initialize failed: ${response.error.message}`);
    }

    // Send initialized notification (no id = JSON-RPC notification, no response expected)
    await connection.transport.sendNotification({
      jsonrpc: "2.0",
      method: "notifications/initialized"
    });
  }

  async function discoverTools(connection: McpServerConnection): Promise<void> {
    const allTools: McpTool[] = [];
    let cursor: string | undefined = undefined;

    while (true) {
      const listRequest: McpRequest = {
        jsonrpc: "2.0",
        method: "tools/list",
        ...(cursor ? { params: { cursor } } : {})
      };

      const response = await connection.transport.sendRequest(listRequest);
      
      if (response.error) {
        throw new Error(`Tools list failed: ${response.error.message}`);
      }

      const pageTools = Array.isArray(response.result?.tools) ? response.result.tools : [];
      allTools.push(...pageTools);

      const nextCursor = response.result?.nextCursor;
      if (!nextCursor) {
        break;
      }
      cursor = nextCursor;
    }

    connection.tools = allTools;
  }

  function registerServerTools(connection: McpServerConnection): void {
    const usedToolNames = new Set<string>();
    const nextToolRegistrations = connection.tools.map((mcpTool) => {
      const toolName = config.toolPrefix !== false
        ? `${connection.name}_${mcpTool.name}`
        : mcpTool.name;
      const sanitizedBaseName = toolName.replace(/[^a-zA-Z0-9_]/g, "_");
      let uniqueName = sanitizedBaseName;
      let suffix = 2;

      while (usedToolNames.has(uniqueName)) {
        uniqueName = `${sanitizedBaseName}_${suffix}`;
        suffix += 1;
      }

      if (uniqueName !== sanitizedBaseName) {
        api.logger.warn(
          `[mcp-client] Tool name collision after sanitization on server ${connection.name}: "${sanitizedBaseName}" -> "${uniqueName}"`
        );
      }

      usedToolNames.add(uniqueName);
      return { mcpTool, registeredName: uniqueName };
    });
    const nextToolNames = nextToolRegistrations.map((entry) => entry.registeredName);

    const oldToolNames = connection.registeredToolNames;
    if (oldToolNames.length > 0) {
      if (typeof api.unregisterTool === "function") {
        for (const oldName of oldToolNames) {
          try {
            api.unregisterTool(oldName);
          } catch (error) {
            api.logger.warn(`[mcp-client] Failed to unregister tool ${oldName}:`, error);
          }
        }
      } else {
        const oldSorted = [...oldToolNames].sort();
        const nextSorted = [...nextToolNames].sort();
        const changed = oldSorted.length !== nextSorted.length || oldSorted.some((name, idx) => name !== nextSorted[idx]);
        if (changed) {
          api.logger.warn(`[mcp-client] Tool list changed for ${connection.name}, but unregisterTool API is unavailable. Existing tool registrations may remain stale.`);
        }
      }
    }

    connection.registeredToolNames = [];

    for (const { mcpTool, registeredName } of nextToolRegistrations) {
      try {
        const actualName = registerMcpTool(connection, mcpTool, registeredName);
        connection.registeredToolNames.push(actualName);
      } catch (error) {
        api.logger.error(`[mcp-client] Failed to register tool ${mcpTool.name}:`, error);
      }
    }
  }

  function registerMcpTool(connection: McpServerConnection, mcpTool: McpTool, validToolName: string): string {
    // Create tool description (truncate for label)
    const label = mcpTool.description.length > 80 
      ? mcpTool.description.substring(0, 77) + "..."
      : mcpTool.description;

    // Convert JSON Schema to TypeBox schema
    const parameters = createToolParameters(mcpTool.inputSchema);

    // Register the tool with OpenClaw
    api.registerTool({
      name: validToolName,
      label: label,
      description: mcpTool.description,
      parameters: parameters,
      async execute(toolId: string, params: any) {
        try {
          return await executeMcpTool(connection, mcpTool.name, params);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          api.logger.error(`[mcp-client] Tool execution failed (server: ${connection.name}, tool: ${mcpTool.name}): ${errorMsg}`);
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
    params: any
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
        throw new Error(`MCP error from ${connection.name}: ${response.error.message}`);
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
      const formattedContent = content.map((item: any) => ({
        type: item.type || "text",
        text: item.text || item.content || JSON.stringify(item)
      }));

      return { content: formattedContent };
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
    api.logger.info("[mcp-client] Deactivating, closing connections and unregistering tools");
    for (const connection of connections.values()) {
      // Unregister tools first
      if (typeof api.unregisterTool === "function") {
        for (const toolName of connection.registeredToolNames) {
          try {
            api.unregisterTool(toolName);
          } catch (error) {
            api.logger.warn(`[mcp-client] Failed to unregister tool ${toolName} during deactivation:`, error);
          }
        }
      }
      try {
        await connection.transport.disconnect();
      } catch (error) {
        api.logger.error(`[mcp-client] Error disconnecting from ${connection.name}:`, error);
      }
    }
    connections.clear();
  });

  api.logger.info(`[mcp-client] Plugin activated with ${Object.keys(config.servers).length} servers configured`);
}
