import { McpRequest, McpResponse, McpServerConfig, nextRequestId } from "./types.js";
import { BaseTransport, resolveEnvRecord, warnIfNonTlsRemoteUrl } from "./transport-base.js";

export class SseTransport extends BaseTransport {
  private endpointUrl: string | null = null;
  private sseAbortController: AbortController | null = null;
  private currentDataBuffer: string[] = [];

  protected get transportName(): string { return "SSE"; }

  async connect(): Promise<void> {
    if (!this.config.url) {
      throw new Error("SSE transport requires URL");
    }

    warnIfNonTlsRemoteUrl(this.config.url, this.logger);
    // Validate that all header env vars resolve (fail fast)
    resolveEnvRecord(this.config.headers || {}, "header");

    this.sseAbortController = new AbortController();

    const connectionTimeout = this.clientConfig.connectionTimeoutMs || 10000;
    const streamReady = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("SSE endpoint URL not received within timeout")), connectionTimeout);
      this._onEndpointReceived = () => { clearTimeout(timer); resolve(); };
    });

    // Fire and forget the stream reader
    this.startEventStream().catch((error) => {
      if (error instanceof Error && error.name !== 'AbortError') {
        this.logger.error("[mcp-client] SSE stream error:", error.message);
        this.scheduleReconnect();
      }
    });

    await streamReady;
    this.connected = true;
    this.backoffDelay = this.clientConfig.reconnectIntervalMs || 30000;
  }

  private _onEndpointReceived: (() => void) | null = null;

  private async startEventStream(): Promise<void> {
    if (!this.config.url) return;

    const headers = resolveEnvRecord({
      ...this.config.headers,
      "Accept": "text/event-stream"
    }, "header");

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
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("event: ")) {
            currentEvent = trimmed.substring(7).trim();
          } else if (trimmed === "") {
            this.processEventLine(line, currentEvent);
            currentEvent = "";
          } else {
            this.processEventLine(line, currentEvent);
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
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

      if (currentEvent === "endpoint") {
        if (data.startsWith("/")) {
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

      try {
        const message = JSON.parse(data);
        this.handleMessage(message);
      } catch {
        this.logger.debug("Failed to parse SSE data as JSON:", data);
      }
    }
  }

  async sendNotification(notification: any): Promise<void> {
    if (!this.connected || !this.endpointUrl) {
      throw new Error("SSE transport not connected or no endpoint URL");
    }
    const headers = resolveEnvRecord({
      ...this.config.headers,
      "Content-Type": "application/json"
    }, "header");
    const response = await fetch(this.endpointUrl!, {
      method: "POST",
      headers,
      body: JSON.stringify(notification)
    });
    if (!response.ok) {
      this.logger.warn(`[mcp-client] SSE notification got HTTP ${response.status}`);
    }
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

      const headers = resolveEnvRecord({
        ...this.config.headers,
        "Content-Type": "application/json"
      }, "header");

      // The response arrives via the SSE stream (handleMessage), not from this fetch.
      // The fetch only confirms the server accepted the request (HTTP 200).
      // If the fetch fails, we reject immediately; otherwise we wait for the SSE stream.
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
      if (!this.config.url) return false;
      const incoming = new URL(url);
      const base = new URL(this.config.url);
      return incoming.origin === base.origin;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.cleanupReconnectTimer();

    if (this.sseAbortController) {
      this.sseAbortController.abort();
      this.sseAbortController = null;
    }

    this.rejectAllPending("Connection closed");
  }
}
