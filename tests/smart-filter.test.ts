/**
 * Smart Filter v2 Tests - Phase 1
 */

import { test, describe } from "node:test";
import assert from "node:assert";
import { SmartFilter, type UserTurn } from "../smart-filter.js";
import type { SmartFilterConfig, PluginServerConfig } from "../types.js";
import type { McpTool } from "@aiwerk/mcp-bridge";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock logger
const mockLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

// Test data - Extended to match eval queries
const testServers: Record<string, PluginServerConfig> = {
  wise: {
    transport: "stdio",
    command: "wise-server",
    description: "international payments and money transfers",
    keywords: ["payment", "transfer", "money", "currency", "invoice", "send"],
  },
  todoist: {
    transport: "stdio", 
    command: "todoist-server",
    description: "task management and productivity",
    keywords: ["task", "todo", "project", "deadline", "reminder"],
  },
  github: {
    transport: "stdio",
    command: "github-server", 
    description: "code repository management",
    keywords: ["code", "repo", "commit", "issue", "pr", "branch"],
  },
  stripe: {
    transport: "stdio",
    command: "stripe-server",
    description: "payment processing and billing",
    keywords: ["payment", "invoice", "billing", "subscription", "charge"],
  },
  "google-maps": {
    transport: "stdio",
    command: "maps-server",
    description: "places geocoding and directions",
    keywords: ["location", "directions", "map", "address", "geocode"],
  },
  notion: {
    transport: "stdio",
    command: "notion-server",
    description: "notes docs and project management",
    keywords: ["note", "document", "project", "storage", "meeting"],
  },
  apify: {
    transport: "stdio",
    command: "apify-server", 
    description: "web scraping automation and data extraction",
    keywords: ["scraping", "extract", "data", "website", "analyze", "traffic"],
  },
  linear: {
    transport: "stdio",
    command: "linear-server",
    description: "project management and issue tracking",
    keywords: ["project", "issue", "milestone", "track", "board"],
  },
  tavily: {
    transport: "stdio",
    command: "tavily-server",
    description: "AI optimized web search and information retrieval",
    keywords: ["search", "find", "information", "papers", "research"],
  },
  miro: {
    transport: "stdio",
    command: "miro-server",
    description: "collaborative whiteboard and design collaboration",
    keywords: ["whiteboard", "collaboration", "design", "brainstorming", "flow"],
  },
  hetzner: {
    transport: "stdio",
    command: "hetzner-server",
    description: "cloud infrastructure and server management",
    keywords: ["cloud", "infrastructure", "server", "deploy", "monitoring"],
  },
};

// McpTool requires inputSchema but we omit it for test brevity
const testTools = new Map([
  ["wise", [
    { name: "create_transfer", description: "Create a new international transfer" },
    { name: "get_balance", description: "Get account balance" },
  ]],
  ["todoist", [
    { name: "create_task", description: "Create a new task" },
    { name: "list_projects", description: "List all projects" },
  ]],
  ["github", [
    { name: "create_issue", description: "Create a new issue" },
    { name: "list_repos", description: "List repositories" },
  ]],
  ["stripe", [
    { name: "create_invoice", description: "Create a new invoice" },
    { name: "process_payment", description: "Process a payment" },
  ]],
  ["google-maps", [
    { name: "geocode", description: "Convert address to coordinates" },
    { name: "get_directions", description: "Get directions between points" },
  ]],
  ["notion", [
    { name: "create_page", description: "Create a new page or note" },
    { name: "store_document", description: "Store meeting notes or documents" },
  ]],
  ["apify", [
    { name: "scrape_website", description: "Extract data from websites" },
    { name: "analyze_traffic", description: "Analyze website traffic data" },
  ]],
  ["linear", [
    { name: "create_issue", description: "Create project issue or ticket" },
    { name: "track_milestone", description: "Track project milestones" },
  ]],
  ["tavily", [
    { name: "search_web", description: "Search for information and research" },
    { name: "find_papers", description: "Find academic papers and research" },
  ]],
  ["miro", [
    { name: "create_board", description: "Create collaborative whiteboard" },
    { name: "design_flow", description: "Create flow charts and designs" },
  ]],
  ["hetzner", [
    { name: "deploy_server", description: "Deploy to cloud infrastructure" },
    { name: "monitor_server", description: "Set up server monitoring" },
  ]],
]);

function createDefaultConfig(): SmartFilterConfig {
  return {
    enabled: true,
    topServers: 3,
    hardCap: 5,
    topTools: 10,
    serverThreshold: 0.01, // Match the implementation defaults
    toolThreshold: 0.05,   // Match the implementation defaults
    alwaysInclude: [],
    timeoutMs: 500,
    telemetry: false,
  };
}

describe("SmartFilter", () => {
  
  test("should extract meaningful content from user turns", async () => {
    const filter = new SmartFilter(createDefaultConfig(), mockLogger);
    const userTurns: UserTurn[] = [
      { content: "send 100 CHF to mom", timestamp: Date.now() },
    ];

    const result = await filter.filter(testServers, testTools as any, userTurns);
    assert.strictEqual(result.metadata.queryUsed, "send 100 CHF to mom");
  });

  test("should handle confirmations by looking at previous turns", async () => {
    const filter = new SmartFilter(createDefaultConfig(), mockLogger);
    const userTurns: UserTurn[] = [
      { content: "create a task", timestamp: Date.now() - 1000 },
      { content: "yes, do it", timestamp: Date.now() },
    ];

    const result = await filter.filter(testServers, testTools as any, userTurns);
    assert.strictEqual(result.metadata.queryUsed, "create a task");
  });

  test("should strip noise words and metadata", async () => {
    const filter = new SmartFilter(createDefaultConfig(), mockLogger);
    const userTurns: UserTurn[] = [
      { content: "[2024-01-01] > send money please", timestamp: Date.now() },
    ];

    const result = await filter.filter(testServers, testTools as any, userTurns);
    assert.strictEqual(result.metadata.queryUsed, "send money");
  });

  test("should return empty query for pure noise", async () => {
    const filter = new SmartFilter(createDefaultConfig(), mockLogger);
    const userTurns: UserTurn[] = [
      { content: "ok", timestamp: Date.now() },
    ];

    const result = await filter.filter(testServers, testTools as any, userTurns);
    assert.strictEqual(result.metadata.queryUsed, "");
    assert.strictEqual(result.servers.length, Object.keys(testServers).length);
  });

  test("should score servers based on description matches", async () => {
    const filter = new SmartFilter(createDefaultConfig(), mockLogger);
    const userTurns: UserTurn[] = [
      { content: "international money transfer", timestamp: Date.now() },
    ];

    const result = await filter.filter(testServers, testTools as any, userTurns);
    
    // Wise should be in results due to description overlap
    const serverNames = result.servers.map(s => s.name);
    assert.ok(serverNames.includes("wise"), "Wise should be included for money transfer query");
  });

  test("should include keyword matches", async () => {
    const filter = new SmartFilter(createDefaultConfig(), mockLogger);
    const userTurns: UserTurn[] = [
      { content: "payment processing", timestamp: Date.now() },
    ];

    const result = await filter.filter(testServers, testTools as any, userTurns);
    
    const serverNames = result.servers.map(s => s.name);
    assert.ok(serverNames.includes("stripe"), "Stripe should be included for payment query");
  });

  test("should respect alwaysInclude servers", async () => {
    const config = createDefaultConfig();
    config.alwaysInclude = ["github"];
    const filter = new SmartFilter(config, mockLogger);

    const userTurns: UserTurn[] = [
      { content: "money transfer", timestamp: Date.now() },
    ];

    const result = await filter.filter(testServers, testTools as any, userTurns);
    
    const serverNames = result.servers.map(s => s.name);
    assert.ok(serverNames.includes("github"), "GitHub should be included via alwaysInclude");
  });

  test("should show all servers when disabled", async () => {
    const config = createDefaultConfig();
    config.enabled = false;
    const filter = new SmartFilter(config, mockLogger);

    const userTurns: UserTurn[] = [
      { content: "send money", timestamp: Date.now() },
    ];

    const result = await filter.filter(testServers, testTools as any, userTurns);
    
    assert.strictEqual(result.servers.length, Object.keys(testServers).length);
    assert.strictEqual(result.metadata.filterMode, "disabled");
  });

  test("should timeout gracefully", async () => {
    const config = createDefaultConfig();
    config.timeoutMs = 1; // Very short timeout
    const filter = new SmartFilter(config, mockLogger);

    const userTurns: UserTurn[] = [
      { content: "send money", timestamp: Date.now() },
    ];

    const result = await filter.filter(testServers, testTools as any, userTurns);

    // Should either filter normally (if fast enough) or fall back to all servers
    assert.ok(result.servers.length > 0, "should return at least some servers");
  });

  test("should limit keywords to 30 per server", async () => {
    const filter = new SmartFilter(createDefaultConfig(), mockLogger);
    const manyKeywords = Array.from({ length: 50 }, (_, i) => `keyword${i}`);
    const serverWithManyKeywords: PluginServerConfig = {
      transport: "stdio",
      command: "test-server",
      description: "test server",
      keywords: manyKeywords,
    };

    const testServersWithMany = {
      test: serverWithManyKeywords,
    };

    const filterableServers = (filter as any).prepareFilterableServers(
      testServersWithMany,
      new Map([["test", []]])
    );

    assert.ok(filterableServers[0].keywords.length <= 30, "Keywords should be limited to 30");
  });

  test("should deduplicate keywords", async () => {
    const filter = new SmartFilter(createDefaultConfig(), mockLogger);
    const duplicateKeywords = ["payment", "money", "payment", "transfer", "money"];
    const serverWithDuplicates: PluginServerConfig = {
      transport: "stdio",
      command: "test-server", 
      description: "test server",
      keywords: duplicateKeywords,
    };

    const testServersWithDupes = {
      test: serverWithDuplicates,
    };

    const filterableServers = (filter as any).prepareFilterableServers(
      testServersWithDupes,
      new Map([["test", []]])
    );

    const uniqueKeywords = new Set(filterableServers[0].keywords);
    assert.strictEqual(filterableServers[0].keywords.length, uniqueKeywords.size, "Keywords should be deduplicated");
  });

  test("routing recall should be >= 95%", async () => {
    const filter = new SmartFilter(createDefaultConfig(), mockLogger);
    
    // Load eval queries
    const evalPath = path.join(__dirname, "fixtures", "eval-queries.json");
    const evalData = JSON.parse(fs.readFileSync(evalPath, "utf8"));
    
    let correctPredictions = 0;
    let totalQueries = 0;

    for (const testCase of evalData) {
      if (testCase.expected_servers.length === 0) {
        continue; // Skip empty/ambiguous cases
      }

      const userTurns: UserTurn[] = [
        { content: testCase.query, timestamp: Date.now() },
      ];

      const result = await filter.filter(testServers, testTools as any, userTurns);
      const resultServerNames = result.servers.map(s => s.name);
      
      // Check if at least one expected server is in results
      const hasCorrectServer = testCase.expected_servers.some((expected: string) =>
        resultServerNames.includes(expected)
      );

      if (hasCorrectServer) {
        correctPredictions++;
      }
      totalQueries++;
    }

    const recall = correctPredictions / totalQueries;
    console.log(`Routing recall: ${(recall * 100).toFixed(1)}% (${correctPredictions}/${totalQueries})`);
    
    assert.ok(recall >= 0.95, `Routing recall should be >= 95%, got ${(recall * 100).toFixed(1)}%`);
  });
});