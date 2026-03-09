import { readFileSync } from "fs";
import { join } from "path";
import { McpRequest, McpResponse, McpTool, McpTransport } from "./types.js";

export const PLUGIN_VERSION: string = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf-8")).version;

export async function initializeProtocol(transport: McpTransport, version: string): Promise<void> {
  const initRequest: McpRequest = {
    jsonrpc: "2.0",
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "openclaw-mcp-bridge",
        version: version || PLUGIN_VERSION
      }
    }
  };

  const response = await transport.sendRequest(initRequest);
  if (response.error) {
    throw new Error(`Initialize failed: ${response.error.message}`);
  }

  await transport.sendNotification({
    jsonrpc: "2.0",
    method: "notifications/initialized"
  });
}

export async function fetchToolsList(transport: McpTransport): Promise<McpTool[]> {
  const allTools: McpTool[] = [];
  let cursor: string | undefined;

  while (true) {
    const request: McpRequest = {
      jsonrpc: "2.0",
      method: "tools/list",
      ...(cursor ? { params: { cursor } } : {})
    };

    const response: McpResponse = await transport.sendRequest(request);
    if (response.error) {
      throw new Error(response.error.message);
    }

    const pageTools = Array.isArray(response.result?.tools) ? response.result.tools : [];
    allTools.push(...pageTools);

    const nextCursor = response.result?.nextCursor;
    if (!nextCursor) {
      break;
    }
    cursor = nextCursor;
  }

  return allTools;
}
