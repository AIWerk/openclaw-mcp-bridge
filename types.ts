export interface McpServerConfig {
  transport: "sse" | "stdio" | "streamable-http";
  // SSE transport
  url?: string;
  headers?: Record<string, string>;
  // Stdio transport
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface McpClientConfig {
  servers: Record<string, McpServerConfig>;
  toolPrefix?: boolean;
  reconnectIntervalMs?: number;
  connectionTimeoutMs?: number;
  requestTimeoutMs?: number;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: any; // JSON Schema
}

export interface McpRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: any;
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
