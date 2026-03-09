import { McpTransport, McpRequest, McpResponse, McpServerConfig } from "./types.js";

export type PendingRequest = { resolve: Function; reject: Function; timeout: NodeJS.Timeout };

/**
 * Base class for all MCP transports. Provides shared logic for:
 * - Message handling (JSON-RPC response routing, notification dispatch)
 * - Pending request management with timeout
 * - Reconnection with exponential backoff + jitter
 * - Environment variable resolution for headers, env, and args
 * - Non-TLS remote URL warnings
 */
export abstract class BaseTransport implements McpTransport {
  protected config: McpServerConfig;
  protected clientConfig: any;
  protected connected = false;
  protected pendingRequests = new Map<number, PendingRequest>();
  protected logger: any;
  protected reconnectTimer: NodeJS.Timeout | null = null;
  protected onReconnected?: () => Promise<void>;
  protected backoffDelay = 0;

  constructor(config: McpServerConfig, clientConfig: any, logger: any, onReconnected?: () => Promise<void>) {
    this.config = config;
    this.clientConfig = clientConfig;
    this.logger = logger;
    this.onReconnected = onReconnected;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract sendRequest(request: McpRequest): Promise<McpResponse>;
  abstract sendNotification(notification: any): Promise<void>;

  isConnected(): boolean {
    return this.connected;
  }

  /** Human-readable transport name for log messages (e.g. "stdio", "SSE", "streamable-http"). */
  protected abstract get transportName(): string;

  /**
   * Route an incoming JSON-RPC message to the appropriate handler:
   * - notifications/tools/list_changed → trigger tool refresh
   * - Other notifications → debug log
   * - Responses with id → resolve/reject matching pending request
   */
  protected handleMessage(message: any): void {
    if (!message.id && message.method === "notifications/tools/list_changed") {
      if (this.onReconnected) {
        this.onReconnected().catch((error) => {
          this.logger.error("[mcp-client] Failed to refresh tools after list_changed notification:", error);
        });
      }
      return;
    }

    if (!message.id && message.method) {
      this.logger.debug(`[mcp-client] Unhandled ${this.transportName} notification: ${message.method}`);
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

  /** Reject and clear all pending requests with the given reason. */
  protected rejectAllPending(reason: string): void {
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(reason));
    }
    this.pendingRequests.clear();
  }

  /**
   * Schedule a reconnection attempt with exponential backoff and jitter.
   * Rejects all pending requests before scheduling.
   */
  protected scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.connected = false;
    this.rejectAllPending("Connection lost, request cancelled");

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
        this.logger.info(`${this.transportName} transport reconnected successfully`);
        this.backoffDelay = baseDelay;

        if (this.onReconnected) {
          await this.onReconnected();
        }
      } catch (error) {
        this.logger.error("Reconnection failed:", error);
        this.backoffDelay = Math.min(this.backoffDelay * 2, 300000);
        this.scheduleReconnect();
      }
    }, reconnectInterval);
  }

  /** Cancel any scheduled reconnection timer. */
  protected cleanupReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

// ── Shared utility functions ──────────────────────────────────────────

/**
 * Resolve ${VAR} placeholders in a single string value using environment variables.
 * Throws if a referenced variable is not defined.
 *
 * @param value - String potentially containing ${VAR} placeholders
 * @param contextDescription - Human-readable context for error messages (e.g. 'header "Authorization"')
 * @param extraEnv - Additional env vars to check before process.env (e.g. merged child process env)
 */
export function resolveEnvVars(
  value: string,
  contextDescription: string,
  extraEnv?: Record<string, string | undefined>
): string {
  return value.replace(/\$\{(\w+)\}/g, (_, varName) => {
    const resolved = extraEnv?.[varName] ?? process.env[varName];
    if (resolved === undefined) {
      throw new Error(`[mcp-client] Missing required environment variable "${varName}" while resolving ${contextDescription}`);
    }
    return resolved;
  });
}

/**
 * Resolve ${VAR} placeholders in all values of a Record<string, string>.
 *
 * @param record - Key-value pairs with potential ${VAR} placeholders in values
 * @param contextPrefix - Prefix for error context (e.g. "header", "env key")
 * @param extraEnv - Additional env vars to check before process.env
 */
export function resolveEnvRecord(
  record: Record<string, string>,
  contextPrefix: string,
  extraEnv?: Record<string, string | undefined>
): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    resolved[key] = resolveEnvVars(value, `${contextPrefix} "${key}"`, extraEnv);
  }
  return resolved;
}

/**
 * Resolve ${VAR} placeholders in an array of command arguments.
 *
 * @param args - Array of argument strings with potential ${VAR} placeholders
 * @param extraEnv - Additional env vars to check before process.env
 */
export function resolveArgs(
  args: string[],
  extraEnv?: Record<string, string | undefined>
): string[] {
  return args.map(arg =>
    resolveEnvVars(arg, `arg "${arg}"`, extraEnv)
  );
}

/**
 * Warn if a URL uses non-TLS HTTP to a remote (non-localhost) host.
 */
export function warnIfNonTlsRemoteUrl(rawUrl: string, logger: any): void {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:") return;
    const host = parsed.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return;
    logger.warn(`[mcp-client] WARNING: Non-TLS connection to ${host} — credentials may be transmitted in plaintext`);
  } catch {
    // Ignore malformed URL here; connect() validation will fail later.
  }
}
