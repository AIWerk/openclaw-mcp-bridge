import { McpTransport, McpRequest, McpResponse, McpServerConfig, nextRequestId } from "./types.js";

export class SseTransport implements McpTransport {
  private config: McpServerConfig;
  private clientConfig: any;
  private endpointUrl: string | null = null;
  private connected = false;
  private pendingRequests = new Map<number, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }>();
  private logger: any;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private sseAbortController: AbortController | null = null;
  private onReconnected?: () => Promise<void>;
  private backoffDelay = 0;
  private currentDataBuffer: string[] = [];

  constructor(config: McpServerConfig, clientConfig: any, logger: any, onReconnected?: () => Promise<void>) {
    this.config = config;
    this.clientConfig = clientConfig;
    this.logger = logger;
    this.onReconnected = onReconnected;
  }

  async connect(): Promise<void> {
    if (!this.config.url) {
      throw new Error("SSE transport requires URL");
    }

    this.sseAbortController = new AbortController();
    
    // Start event stream in background (it runs forever)
    const connectionTimeout = this.clientConfig.connectionTimeoutMs || 10000;
    const streamReady = new Promise<void>((resolve, reject) => {
      this._onEndpointReceived = resolve;
      // Timeout if endpoint not received within connectionTimeout
      setTimeout(() => reject(new Error("SSE endpoint URL not received within timeout")), connectionTimeout);
    });

    // Fire and forget the stream reader
    this.startEventStream().catch((error) => {
      if (error instanceof Error && error.name !== 'AbortError') {
        this.logger.error("[mcp-client] SSE stream error:", error.message);
        this.scheduleReconnect();
      }
    });

    // Wait only until we get the endpoint URL
    await streamReady;
    this.connected = true;
    this.backoffDelay = this.clientConfig.reconnectIntervalMs || 30000;
  }
  
  private _onEndpointReceived: (() => void) | null = null;

  private async startEventStream(): Promise<void> {
    if (!this.config.url) return;

    const headers = this.resolveHeaders({
      ...this.config.headers,
      "Accept": "text/event-stream"
    });
    
    try {
      const response = await fetch(this.config.url, {
        method: "GET",
        headers,
        signal: this.sseAbortController?.signal
      });

      if (!response.ok) {
        throw new Error(`SSE connection failed: HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body for SSE stream");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let buffer = "";
      let currentEvent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ""; // Keep partial line in buffer

        for (const line of lines) {
          this.processEventLine(line, currentEvent);
          // Track current event type for proper SSE event+data pairing
          const trimmed = line.trim();
          if (trimmed.startsWith("event: ")) {
            currentEvent = trimmed.substring(7).trim();
          } else if (trimmed === "") {
            currentEvent = ""; // Reset on blank line (SSE event boundary)
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return; // Clean disconnection
      }
      this.logger.error("SSE stream error:", error);
      this.scheduleReconnect();
    }
  }

  private processEventLine(line: string, currentEvent: string = ""): void {
    const trimmed = line.trim();
    if (trimmed.startsWith("event: ")) return;

    if (trimmed.startsWith("data: ")) {
      this.currentDataBuffer.push(trimmed.substring(6));
      return;
    }

    if (trimmed === "") {
      if (this.currentDataBuffer.length === 0) return;

      const data = this.currentDataBuffer.join("\n");
      this.currentDataBuffer = [];

      // Handle endpoint event (SSE event type "endpoint" with URL as data)
      if (currentEvent === "endpoint") {
        if (data.startsWith("/")) {
          // Relative URL — resolve against base
          const base = new URL(this.config.url!);
          this.endpointUrl = `${base.origin}${data}`;
        } else if (data.startsWith("http")) {
          if (!this.isSameOrigin(data)) {
            this.logger.warn(`[mcp-client] Rejected SSE endpoint with mismatched origin: ${data}`);
            return;
          }
          this.endpointUrl = data;
        } else {
          this.logger.warn(`[mcp-client] Rejected SSE endpoint with unsupported URL format: ${data}`);
          return;
        }
        this.logger.info(`[mcp-client] SSE endpoint URL received: ${this.endpointUrl}`);
        if (this._onEndpointReceived) {
          this._onEndpointReceived();
          this._onEndpointReceived = null;
        }
        return;
      }

      // Try to parse as JSON-RPC message
      try {
        const message = JSON.parse(data);
        this.handleMessage(message);
      } catch (error) {
        this.logger.debug("Failed to parse SSE data as JSON:", data);
      }
    }
  }

  private handleMessage(message: any): void {
    if (!message.id && message.method === "notifications/tools/list_changed") {
      if (this.onReconnected) {
        this.onReconnected().catch((error) => {
          this.logger.error("[mcp-client] Failed to refresh tools after list_changed notification:", error);
        });
      }
      return;
    }

    if (message.id && this.pendingRequests.has(message.id)) {
      const pending = this.pendingRequests.get(message.id)!;
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(message.id);

      if (message.error) {
        pending.reject(new Error(message.error.message || "MCP error"));
      } else {
        pending.resolve(message);
      }
    }
  }

  async sendNotification(notification: any): Promise<void> {
    if (!this.connected || !this.endpointUrl) {
      throw new Error("SSE transport not connected or no endpoint URL");
    }
    const headers = this.resolveHeaders({
      ...this.config.headers,
      "Content-Type": "application/json"
    });
    await fetch(this.endpointUrl!, {
      method: "POST",
      headers,
      body: JSON.stringify(notification)
    });
  }

  async sendRequest(request: McpRequest): Promise<McpResponse> {
    if (!this.connected || !this.endpointUrl) {
      throw new Error("SSE transport not connected or no endpoint URL");
    }

    const id = nextRequestId();
    const requestWithId = { ...request, id };

    return new Promise((resolve, reject) => {
      const requestTimeout = this.clientConfig.requestTimeoutMs || 60000;
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout after ${requestTimeout}ms`));
      }, requestTimeout);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      // Send request to the endpoint URL
      const headers = this.resolveHeaders({
        ...this.config.headers,
        "Content-Type": "application/json"
      });

      fetch(this.endpointUrl!, {
        method: "POST",
        headers,
        body: JSON.stringify(requestWithId)
      })
        .then((response) => {
          if (!response.ok) {
            clearTimeout(timeout);
            this.pendingRequests.delete(id);
            reject(new Error(`HTTP ${response.status}`));
          }
        })
        .catch((error) => {
          clearTimeout(timeout);
          this.pendingRequests.delete(id);
          reject(error);
        });
    });
  }

  private isSameOrigin(url: string): boolean {
    try {
      if (!this.config.url) {
        return false;
      }
      const incoming = new URL(url);
      const base = new URL(this.config.url);
      return incoming.origin === base.origin;
    } catch (error) {
      return false;
    }
  }

  private resolveHeaders(headers: Record<string, string>): Record<string, string> {
    const resolved: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      resolved[key] = value.replace(/\$\{(\w+)\}/g, (_, envVar) => {
        const envValue = process.env[envVar];
        if (envValue === undefined) {
          this.logger.warn(`[mcp-client] Missing environment variable "${envVar}" while resolving header "${key}"`);
          return "";
        }
        return envValue;
      });
    }
    return resolved;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.connected = false;
    
    // Clear and reject all pending requests (fix memory leak)
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Connection lost, request cancelled"));
    }
    this.pendingRequests.clear();

    const baseDelay = this.clientConfig.reconnectIntervalMs || 30000;
    if (this.backoffDelay <= 0) {
      this.backoffDelay = baseDelay;
    }
    const jitter = 0.5 + Math.random(); // 0.5x-1.5x jitter
    const reconnectInterval = Math.round(this.backoffDelay * jitter);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
        this.logger.info("SSE transport reconnected successfully");
        this.backoffDelay = baseDelay;
        
        // Call the reconnection callback to re-initialize protocol and tools
        if (this.onReconnected) {
          await this.onReconnected();
        }
      } catch (error) {
        this.logger.error("Reconnection failed:", error);
        this.backoffDelay = Math.min(this.backoffDelay * 2, 300000);
        // Schedule another reconnect attempt
        this.scheduleReconnect();
      }
    }, reconnectInterval);
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.sseAbortController) {
      this.sseAbortController.abort();
      this.sseAbortController = null;
    }

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Connection closed"));
    }
    this.pendingRequests.clear();
  }

  isConnected(): boolean {
    return this.connected;
  }
}
