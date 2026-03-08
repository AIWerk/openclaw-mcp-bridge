import { McpTransport, McpRequest, McpResponse, McpServerConfig, nextRequestId } from "./types.js";

export class StreamableHttpTransport implements McpTransport {
  private config: McpServerConfig;
  private clientConfig: any;
  private connected = false;
  private pendingRequests = new Map<number, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }>();
  private logger: any;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private onReconnected?: () => Promise<void>;
  private sessionId?: string;
  private backoffDelay = 0;

  constructor(config: McpServerConfig, clientConfig: any, logger: any, onReconnected?: () => Promise<void>) {
    this.config = config;
    this.clientConfig = clientConfig;
    this.logger = logger;
    this.onReconnected = onReconnected;
  }

  async connect(): Promise<void> {
    if (!this.config.url) {
      throw new Error("Streamable HTTP transport requires URL");
    }

    this.warnIfNonTlsRemoteUrl(this.config.url);
    this.resolveHeaders(this.config.headers || {});
    await this.probeServer();

    this.connected = true;
    this.backoffDelay = this.clientConfig.reconnectIntervalMs || 30000;
    this.logger.info(`[mcp-client] Streamable HTTP transport ready for ${this.config.url}`);
  }

  async sendRequest(request: McpRequest): Promise<McpResponse> {
    if (!this.connected || !this.config.url) {
      throw new Error("Streamable HTTP transport not connected");
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

      // Send request (Accept both JSON and SSE per MCP spec)
      const headers = this.resolveHeaders({
        "Accept": "application/json, text/event-stream",
        ...this.config.headers,
        "Content-Type": "application/json"
      });

      // Include session ID if we have one
      if (this.sessionId) {
        headers["mcp-session-id"] = this.sessionId;
      }

      fetch(this.config.url!, {
        method: "POST",
        headers,
        body: JSON.stringify(requestWithId)
      })
        .then(async response => {
          // Extract session ID from response headers if present
          const responseSessionId = response.headers.get("mcp-session-id");
          if (responseSessionId) {
            this.sessionId = responseSessionId;
          }

          if (!response.ok) {
            clearTimeout(timeout);
            this.pendingRequests.delete(id);
            reject(new Error(`HTTP ${response.status}: ${response.statusText}`));
            return;
          }

          try {
            const contentType = response.headers.get("content-type") || "";
            let jsonResponse: any;
            
            if (contentType.includes("text/event-stream")) {
              // Parse SSE response: extract data from "data: {...}" lines
              const text = await response.text();
              const dataLines = text.split('\n')
                .filter((line: string) => line.startsWith('data:'))
                .map((line: string) => line.substring(5).trim());
              if (dataLines.length > 0) {
                jsonResponse = JSON.parse(dataLines[dataLines.length - 1]);
              } else {
                throw new Error("No data lines in SSE response");
              }
            } else {
              jsonResponse = await response.json();
            }
            
            this.handleMessage(jsonResponse);
          } catch (error) {
            clearTimeout(timeout);
            this.pendingRequests.delete(id);
            reject(new Error("Failed to parse response: " + (error instanceof Error ? error.message : String(error))));
          }
        })
        .catch(error => {
          clearTimeout(timeout);
          this.pendingRequests.delete(id);
          
          // Check if this is a connection error that should trigger reconnect
          if (error.name === 'TypeError' && error.message.includes('fetch')) {
            this.logger.error("Connection error, scheduling reconnect:", error.message);
            this.scheduleReconnect();
          }
          
          reject(error);
        });
    });
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

    if (!message.id && message.method) {
      this.logger.debug(`[mcp-client] Unhandled streamable-http notification: ${message.method}`);
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
    if (!this.connected || !this.config.url) {
      throw new Error("Streamable HTTP transport not connected");
    }

    const headers = this.resolveHeaders({
      "Accept": "application/json, text/event-stream",
      ...this.config.headers,
      "Content-Type": "application/json"
    });

    // Include session ID if we have one
    if (this.sessionId) {
      headers["mcp-session-id"] = this.sessionId;
    }

    try {
      const response = await fetch(this.config.url, {
        method: "POST",
        headers,
        body: JSON.stringify(notification)
      });

      // Extract session ID from response headers if present
      const responseSessionId = response.headers.get("mcp-session-id");
      if (responseSessionId) {
        this.sessionId = responseSessionId;
      }

      // For notifications, we don't care about the response content
      // but we should handle connection errors
      if (!response.ok && response.status >= 500) {
        throw new Error(`Server error: HTTP ${response.status}`);
      }
    } catch (error) {
      // Check if this is a connection error that should trigger reconnect
      if (error instanceof Error && error.name === 'TypeError' && error.message.includes('fetch')) {
        this.logger.error("Connection error during notification, scheduling reconnect:", error.message);
        this.scheduleReconnect();
      }
      throw error;
    }
  }

  private resolveHeaders(headers: Record<string, string>): Record<string, string> {
    const resolved: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      resolved[key] = value.replace(/\$\{(\w+)\}/g, (_, envVar) => {
        const envValue = process.env[envVar];
        if (envValue === undefined) {
          throw new Error(`[mcp-client] Missing required environment variable "${envVar}" while resolving header "${key}"`);
        }
        return envValue;
      });
    }
    return resolved;
  }

  private async probeServer(): Promise<void> {
    if (!this.config.url) {
      return;
    }

    try {
      // OPTIONS preflight without auth headers (standard CORS behavior)
      const optionsResponse = await fetch(this.config.url, { method: "OPTIONS" });
      if (optionsResponse.ok) {
        return;
      }
      // Fallback: HEAD with auth headers
      const headers = this.resolveHeaders(this.config.headers || {});
      const headResponse = await fetch(this.config.url, { method: "HEAD", headers });
      if (!headResponse.ok) {
        this.logger.warn(`[mcp-client] Streamable HTTP server probe: OPTIONS ${optionsResponse.status}, HEAD ${headResponse.status} (non-blocking, connection continues)`);
      }
    } catch (error: any) {
      this.logger.warn(`[mcp-client] Streamable HTTP server probe failed (non-blocking): ${error?.message || error}`);
    }
  }

  private warnIfNonTlsRemoteUrl(rawUrl: string): void {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== "http:") {
        return;
      }
      const host = parsed.hostname;
      if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
        return;
      }
      this.logger.warn(`[mcp-client] WARNING: Non-TLS connection to ${host} — credentials may be transmitted in plaintext`);
    } catch (error) {
      // Ignore malformed URL here; connect() validation will fail later.
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.connected = false;
    
    // Clear and reject all pending requests
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
        this.logger.info("Streamable HTTP transport reconnected successfully");
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

    // Send DELETE request if we have a session to clean up
    if (this.sessionId && this.config.url) {
      try {
        const headers = this.resolveHeaders(this.config.headers || {});
        headers["mcp-session-id"] = this.sessionId;

        await fetch(this.config.url, {
          method: "DELETE",
          headers
        });
        
        this.sessionId = undefined;
        this.logger.info("Streamable HTTP session cleaned up");
      } catch (error) {
        this.logger.warn("Failed to clean up session on disconnect:", error);
      }
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
