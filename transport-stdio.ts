import { spawn, ChildProcess } from "child_process";
import { McpRequest, McpResponse, McpServerConfig, nextRequestId } from "./types.js";
import { BaseTransport, resolveEnvRecord, resolveArgs } from "./transport-base.js";

export class StdioTransport extends BaseTransport {
  private process: ChildProcess | null = null;
  private framingMode: "auto" | "lsp" | "newline" = "auto";
  private stdoutBuffer = Buffer.alloc(0);
  private isShuttingDown = false;

  protected get transportName(): string { return "stdio"; }

  async connect(): Promise<void> {
    if (!this.config.command) {
      throw new Error("Stdio transport requires command");
    }

    try {
      this.isShuttingDown = false;
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

    const env = { ...process.env, ...resolveEnvRecord(this.config.env || {}, "env key") };
    const args = resolveArgs(this.config.args || [], env);

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

    this.process.stderr.on("data", (data: Buffer) => {
      this.logger.debug(`MCP server stderr: ${data.toString()}`);
    });

    this.process.on("exit", (code, signal) => {
      this.logger.debug(`MCP server process exited: code=${code}, signal=${signal}`);
      this.connected = false;
      this.process = null;
      this.rejectAllPending("Process exited");

      if (!this.isShuttingDown) {
        this.scheduleReconnect();
      }
    });

    this.process.on("error", (error) => {
      this.logger.error("MCP server process error:", error);
      this.connected = false;
      this.process = null;
      this.rejectAllPending("Process error");

      if (!this.isShuttingDown) {
        this.scheduleReconnect();
      }
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
        if (!this.parseLspMessageFromBuffer()) return;
        continue;
      }

      if (!this.parseNewlineMessageFromBuffer()) return;
    }
  }

  private parseNewlineMessageFromBuffer(): boolean {
    const newlineIndex = this.stdoutBuffer.indexOf(0x0a);
    if (newlineIndex === -1) return false;

    const lineBuffer = this.stdoutBuffer.subarray(0, newlineIndex);
    this.stdoutBuffer = this.stdoutBuffer.subarray(newlineIndex + 1);

    const line = lineBuffer.toString("utf8").trim();
    if (!line) return true;

    try {
      const message = JSON.parse(line);
      this.handleMessage(message);
    } catch {
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

    if (headerEndIndex === -1) return false;

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

    if (this.stdoutBuffer.length < bodyEnd) return false;

    const body = this.stdoutBuffer.subarray(bodyStart, bodyEnd).toString("utf8");
    this.stdoutBuffer = this.stdoutBuffer.subarray(bodyEnd);

    try {
      const message = JSON.parse(body);
      this.handleMessage(message);
    } catch {
      this.logger.debug("Failed to parse LSP stdout JSON:", body);
    }

    return true;
  }

  async disconnect(): Promise<void> {
    this.isShuttingDown = true;
    this.connected = false;
    this.cleanupReconnectTimer();

    const activeProcess = this.process;
    if (activeProcess) {
      if (activeProcess.stdin && !activeProcess.stdin.destroyed) {
        try {
          this.writeMessage({ jsonrpc: "2.0", method: "close" });
        } catch {
          this.logger.debug("[mcp-client] Failed to send close notification during stdio disconnect");
        }
      }

      await this.terminateProcessGracefully(activeProcess);
      if (this.process === activeProcess) {
        this.process = null;
      }
    }

    this.rejectAllPending("Connection closed");
  }

  isConnected(): boolean {
    return this.connected && this.process !== null;
  }

  private async terminateProcessGracefully(proc: ChildProcess): Promise<void> {
    if (proc.exitCode !== null || proc.killed) return;

    await new Promise<void>((resolve) => {
      let done = false;
      let forceKillTimer: NodeJS.Timeout | null = null;

      const finish = () => {
        if (done) return;
        done = true;
        if (forceKillTimer) clearTimeout(forceKillTimer);
        proc.off("exit", onExit);
        resolve();
      };

      const onExit = () => finish();
      proc.once("exit", onExit);

      try {
        proc.kill("SIGINT");
      } catch {
        finish();
        return;
      }

      forceKillTimer = setTimeout(() => {
        if (proc.exitCode === null && !proc.killed) {
          try { proc.kill("SIGTERM"); } catch { /* ignore */ }
        }
        setTimeout(finish, 200);
      }, 2000);
    });
  }
}
