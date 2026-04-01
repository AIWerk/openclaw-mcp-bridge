// OpenClaw-specific interfaces — not part of the core MCP bridge.

import type { McpClientConfig, McpServerConfig } from "@aiwerk/mcp-bridge";

/** Smart filter configuration for router mode. */
export interface SmartFilterConfig {
  enabled?: boolean;
  embedding?: "auto" | "ollama" | "openai" | "gemini" | "keyword";
  topServers?: number;
  hardCap?: number;
  topTools?: number;
  serverThreshold?: number;
  toolThreshold?: number;
  fallback?: "keyword";
  alwaysInclude?: string[];
  timeoutMs?: number;
  telemetry?: boolean;
}

/** Extended server config with optional keywords for smart filter. */
export interface PluginServerConfig extends McpServerConfig {
  keywords?: string[];
}

/** Extended client config with smartFilter and keyword-aware servers. */
export interface PluginClientConfig extends Omit<McpClientConfig, "servers"> {
  servers: Record<string, PluginServerConfig>;
  smartFilter?: SmartFilterConfig;
}

export interface OpenClawToolDefinition {
  name: string;
  label?: string;
  description: string;
  parameters?: Record<string, unknown>;
  execute: (toolId: string, params: Record<string, unknown>) => Promise<unknown>;
}

export interface OpenClawLogger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

export interface OpenClawPluginApi {
  pluginConfig: McpClientConfig;
  logger: OpenClawLogger;
  registerTool: (tool: OpenClawToolDefinition) => void;
  unregisterTool: (name: string) => void;
  on: (event: string, handler: (...args: unknown[]) => void | Promise<void>) => void;
}

// Re-export shared types from the core package.
export type {
  McpServerConfig,
  McpClientConfig,
  McpTool,
  McpRequest,
  McpResponse,
  McpTransport,
  McpServerConnection,
  Logger,
} from "@aiwerk/mcp-bridge";
