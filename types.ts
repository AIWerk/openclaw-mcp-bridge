// OpenClaw Plugin API surface (partial — covers what this plugin uses)
export interface OpenClawToolDefinition {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
  execute: (toolId: string, params: Record<string, unknown>) => Promise<unknown>;
}

export interface OpenClawPluginApi {
  registerTool: (tool: OpenClawToolDefinition) => void;
  log: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    debug: (...args: unknown[]) => void;
  };
  config: McpClientConfig;
}

export interface McpServerConfig {
  transport: "sse" | "stdio" | "streamable-http";
  /** Human-readable description for router tool description generation */
  description?: string;
  // SSE transport
  url?: string;
  headers?: Record<string, string>;
  // Stdio transport
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // Stdio framing override (default: auto-detect from first message)
  framing?: "auto" | "lsp" | "newline";
}

export interface McpClientConfig {
  servers: Record<string, McpServerConfig>;
  mode?: "direct" | "router";
  toolPrefix?: boolean | "auto";
  reconnectIntervalMs?: number;
  connectionTimeoutMs?: number;
  requestTimeoutMs?: number;
  routerIdleTimeoutMs?: number;
  routerMaxConcurrent?: number;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: any; // JSON Schema
}

export interface McpRequest {
  jsonrpc: "2.0";
  id?: number;
  method: string;
  params?: any;
}

let globalRequestId = 1;

export function nextRequestId(): number {
  return globalRequestId++;
}

export interface McpResponse {
  jsonrpc: "2.0";
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface McpTransport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendRequest(request: McpRequest): Promise<McpResponse>;
  sendNotification(notification: any): Promise<void>;
  isConnected(): boolean;
}

export interface McpServerConnection {
  name: string;
  transport: McpTransport;
  tools: McpTool[];
  isInitialized: boolean;
  registeredToolNames: string[];
}
