import { spawn, ChildProcess } from "child_process";
import { McpTransport, McpRequest, McpResponse, McpServerConfig } from "./types.js";

export class StdioTransport implements McpTransport {
  private config: McpServerConfig;
  private clientConfig: any;
  private process: ChildProcess | null = null;
  private connected = false;
  private pendingRequests = new Map<number, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }>();
  private nextId = 1;
  private logger: any;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private onReconnected?: () => Promise<void>;

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

    // Setup stdout handler for JSON-RPC responses
    let buffer = "";
    this.process.stdout.on("data", (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || ""; // Keep partial line in buffer

      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line.trim());
            this.handleMessage(message);
          } catch (error) {
            this.logger.debug("Failed to parse stdout JSON:", line);
          }
        }
      }
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
    });

    // Wait a bit for the process to start
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  private handleMessage(message: any): void {
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
    if (!this.connected || !this.process?.stdin) {
      throw new Error("Stdio transport not connected");
    }
    this.process.stdin.write(JSON.stringify(notification) + '\n');
  }

  async sendRequest(request: McpRequest): Promise<McpResponse> {
    if (!this.connected || !this.process?.stdin) {
      throw new Error("Stdio transport not connected");
    }

    const id = this.nextId++;
    const requestWithId = { ...request, id };

    return new Promise((resolve, reject) => {
      const requestTimeout = this.clientConfig.requestTimeoutMs || 60000;
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout after ${requestTimeout}ms`));
      }, requestTimeout);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      try {
        const messageStr = JSON.stringify(requestWithId) + '\n';
        this.process!.stdin!.write(messageStr);
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(error);
      }
    });
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

    const reconnectInterval = this.clientConfig.reconnectIntervalMs || 30000;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
        this.logger.info("Stdio transport reconnected successfully");
        
        // Call the reconnection callback to re-initialize protocol and tools
        if (this.onReconnected) {
          await this.onReconnected();
        }
      } catch (error) {
        this.logger.error("Reconnection failed:", error);
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
