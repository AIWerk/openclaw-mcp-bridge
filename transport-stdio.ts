import { spawn, ChildProcess } from "child_process";
import { McpTransport, McpRequest, McpResponse, McpServerConfig, nextRequestId } from "./types.js";

export class StdioTransport implements McpTransport {
  private config: McpServerConfig;
  private clientConfig: any;
  private process: ChildProcess | null = null;
  private connected = false;
  private pendingRequests = new Map<number, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }>();
  private logger: any;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private onReconnected?: () => Promise<void>;
  private backoffDelay = 0;
  private framingMode: "auto" | "lsp" | "newline" = "auto";
  private stdoutBuffer = Buffer.alloc(0);

  constructor(config: McpServerConfig, clientConfig: any, logger: any, onReconnected?: () => Promise<void>) {
    this.config = config;
    this.clientConfig = clientConfig;
    this.logger = logger;
    this.onReconnected = onReconnected;
  }

  async connect(): Promise<void> {
    if (!this.config.command) {
      throw new Error("Stdio transport requires command");
    }

    try {
      await this.startProcess();
      this.connected = true;
      this.backoffDelay = this.clientConfig.reconnectIntervalMs || 30000;
    } catch (error) {
      this.logger.error("Stdio transport connection failed:", error);
      throw error;
    }
  }

  private async startProcess(): Promise<void> {
    if (!this.config.command) return;

    const env = { ...process.env, ...this.resolveEnv(this.config.env || {}) };
    const args = this.config.args || [];

    this.process = spawn(this.config.command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env
    });

    if (!this.process.stdin || !this.process.stdout || !this.process.stderr) {
      throw new Error("Failed to create process pipes");
    }

    this.framingMode = this.config.framing || "auto";
    this.stdoutBuffer = Buffer.alloc(0);
    this.process.stdout.on("data", (data: Buffer) => {
      this.stdoutBuffer = Buffer.concat([this.stdoutBuffer, data]);
      // Safety limit: prevent unbounded buffer growth from misbehaving servers
      const MAX_BUFFER = 50 * 1024 * 1024; // 50MB
      if (this.stdoutBuffer.length > MAX_BUFFER) {
        this.logger.error(`[mcp-client] Stdio buffer exceeded ${MAX_BUFFER} bytes, killing process`);
        this.process?.kill();
        return;
      }
      this.processStdoutBuffer();
    });

    // Setup stderr handler for debugging
    this.process.stderr.on("data", (data: Buffer) => {
      this.logger.debug(`MCP server stderr: ${data.toString()}`);
    });

    // Handle process exit
    this.process.on("exit", (code, signal) => {
      this.logger.debug(`MCP server process exited: code=${code}, signal=${signal}`);
      this.connected = false;
      this.process = null;

      // Reject all pending requests
      for (const [id, pending] of this.pendingRequests) {
        clearTimeout(pending.timeout);
        pending.reject(new Error("Process exited"));
      }
      this.pendingRequests.clear();

      this.scheduleReconnect();
    });

    this.process.on("error", (error) => {
      this.logger.error("MCP server process error:", error);
      this.connected = false;
      this.process = null;

      // Reject all pending requests
      for (const [id, pending] of this.pendingRequests) {
        clearTimeout(pending.timeout);
        pending.reject(new Error("Process error"));
      }
      this.pendingRequests.clear();

      this.scheduleReconnect();
    });

    const connectionTimeout = this.clientConfig.connectionTimeoutMs || 5000;
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let timeout: NodeJS.Timeout;

      const cleanup = () => {
        this.process?.stdout?.off("data", onFirstData);
        this.process?.off("error", onProcessError);
        this.process?.off("exit", onProcessExit);
        clearTimeout(timeout);
      };

      const settleResolve = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };

      const settleReject = (error: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };

      const onFirstData = () => settleResolve();
      const onProcessError = (error: Error) => settleReject(error);
      const onProcessExit = () => settleReject(new Error("MCP server exited before stdout became ready"));

      this.process!.stdout!.once("data", onFirstData);
      this.process!.once("error", onProcessError);
      this.process!.once("exit", onProcessExit);

      timeout = setTimeout(() => {
        this.logger.warn(`[mcp-client] Stdio startup stdout readiness timed out after ${connectionTimeout}ms; continuing`);
        settleResolve();
      }, connectionTimeout);
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

  private writeMessage(message: any): void {
    const json = JSON.stringify(message);
    if (this.framingMode === "lsp") {
      const body = Buffer.from(json, "utf8");
      this.process!.stdin!.write(`Content-Length: ${body.length}\r\n\r\n`);
      this.process!.stdin!.write(body);
    } else {
      this.process!.stdin!.write(json + '\n');
    }
  }

  async sendNotification(notification: any): Promise<void> {
    if (!this.connected || !this.process?.stdin) {
      throw new Error("Stdio transport not connected");
    }
    this.writeMessage(notification);
  }

  async sendRequest(request: McpRequest): Promise<McpResponse> {
    if (!this.connected || !this.process?.stdin) {
      throw new Error("Stdio transport not connected");
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

      try {
        this.writeMessage(requestWithId);
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(error);
      }
    });
  }

  private processStdoutBuffer(): void {
    while (true) {
      if (this.framingMode === "auto") {
        const bufferText = this.stdoutBuffer.toString("utf8");
        if (bufferText.includes("Content-Length:")) {
          this.framingMode = "lsp";
        } else if (this.stdoutBuffer.includes(0x0a)) {
          this.framingMode = "newline";
        } else {
          return;
        }
      }

      if (this.framingMode === "lsp") {
        const consumed = this.parseLspMessageFromBuffer();
        if (!consumed) {
          return;
        }
        continue;
      }

      const consumed = this.parseNewlineMessageFromBuffer();
      if (!consumed) {
        return;
      }
    }
  }

  private parseNewlineMessageFromBuffer(): boolean {
    const newlineIndex = this.stdoutBuffer.indexOf(0x0a);
    if (newlineIndex === -1) {
      return false;
    }

    const lineBuffer = this.stdoutBuffer.subarray(0, newlineIndex);
    this.stdoutBuffer = this.stdoutBuffer.subarray(newlineIndex + 1);

    const line = lineBuffer.toString("utf8").trim();
    if (!line) {
      return true;
    }

    try {
      const message = JSON.parse(line);
      this.handleMessage(message);
    } catch (error) {
      this.logger.debug("Failed to parse stdout JSON:", line);
    }
    return true;
  }

  private parseLspMessageFromBuffer(): boolean {
    const separator = Buffer.from("\r\n\r\n");
    let headerEndIndex = this.stdoutBuffer.indexOf(separator);
    let headerLength = separator.length;

    if (headerEndIndex === -1) {
      const altSeparator = Buffer.from("\n\n");
      headerEndIndex = this.stdoutBuffer.indexOf(altSeparator);
      headerLength = altSeparator.length;
    }

    if (headerEndIndex === -1) {
      return false;
    }

    const headerText = this.stdoutBuffer.subarray(0, headerEndIndex).toString("utf8");
    const contentLengthMatch = headerText.match(/Content-Length:\s*(\d+)/i);
    if (!contentLengthMatch) {
      this.logger.warn("[mcp-client] Missing Content-Length in LSP-framed stdout message; dropping malformed frame");
      this.stdoutBuffer = this.stdoutBuffer.subarray(headerEndIndex + headerLength);
      return true;
    }

    const contentLength = Number.parseInt(contentLengthMatch[1], 10);
    const bodyStart = headerEndIndex + headerLength;
    const bodyEnd = bodyStart + contentLength;

    if (this.stdoutBuffer.length < bodyEnd) {
      return false;
    }

    const body = this.stdoutBuffer.subarray(bodyStart, bodyEnd).toString("utf8");
    this.stdoutBuffer = this.stdoutBuffer.subarray(bodyEnd);

    try {
      const message = JSON.parse(body);
      this.handleMessage(message);
    } catch (error) {
      this.logger.debug("Failed to parse LSP stdout JSON:", body);
    }

    return true;
  }

  private resolveEnv(env: Record<string, string>): Record<string, string> {
    const resolved: Record<string, string> = {};
    for (const [key, value] of Object.entries(env)) {
      resolved[key] = value.replace(/\$\{(\w+)\}/g, (_, envVar) => {
        const envValue = process.env[envVar];
        if (envValue === undefined) {
          this.logger.warn(`[mcp-client] Missing environment variable "${envVar}" while resolving env key "${key}"`);
          return "";
        }
        return envValue;
      });
    }
    return resolved;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

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
        this.logger.info("Stdio transport reconnected successfully");
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

    if (this.process) {
      this.process.kill();
      this.process = null;
    }

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Connection closed"));
    }
    this.pendingRequests.clear();
  }

  isConnected(): boolean {
    return this.connected && this.process !== null;
  }
}
