/**
 * Smart Filter v2 - Phase 1: Keyword-based filtering
 * Zero external dependencies, graceful degradation
 */

import type { SmartFilterConfig, PluginServerConfig } from "./types.js";
import type { McpTool } from "@aiwerk/mcp-bridge";
import type { OpenClawLogger } from "./types.js";

export interface FilterableServer {
  name: string;
  description: string;
  keywords: string[];
  tools: McpTool[];
}

export interface FilterResult {
  servers: FilterableServer[];
  tools: Array<{ serverId: string; tool: McpTool }>;
  metadata: {
    queryUsed: string;
    totalServersBeforeFilter: number;
    totalToolsBeforeFilter: number;
    filterMode: "keyword" | "disabled";
    timeoutOccurred: boolean;
    confidenceScore?: number;
  };
}

export interface UserTurn {
  content: string;
  timestamp: number;
}

/**
 * Smart Filter implementation - Phase 1
 */
export class SmartFilter {
  private config: Required<SmartFilterConfig>;
  private logger: OpenClawLogger;

  constructor(config: SmartFilterConfig, logger: OpenClawLogger) {
    // Apply defaults
    this.config = {
      enabled: config.enabled ?? false,
      embedding: config.embedding ?? "auto",
      topServers: config.topServers ?? 5,
      hardCap: config.hardCap ?? 8,
      topTools: config.topTools ?? 10,
      serverThreshold: config.serverThreshold ?? 0.01, // Very low threshold for maximum recall
      toolThreshold: config.toolThreshold ?? 0.05, // Much lower threshold for better recall  
      fallback: config.fallback ?? "keyword",
      alwaysInclude: config.alwaysInclude ?? [],
      timeoutMs: config.timeoutMs ?? 500,
      telemetry: config.telemetry ?? false,
    };
    this.logger = logger;
  }

  /**
   * Main filter entry point
   */
  async filter(
    servers: Record<string, PluginServerConfig>,
    allTools: Map<string, McpTool[]>,
    userTurns: UserTurn[]
  ): Promise<FilterResult> {
    if (!this.config.enabled) {
      return this.createUnfilteredResult(servers, allTools, "disabled");
    }

    const startTime = Date.now();
    let timeoutOccurred = false;

    try {
      // Set up timeout
      const timeoutPromise = new Promise<FilterResult>((resolve) => {
        setTimeout(() => {
          timeoutOccurred = true;
          this.logger.warn(`[smart-filter] Filter timeout after ${this.config.timeoutMs}ms, falling back to show all`);
          resolve(this.createUnfilteredResult(servers, allTools, "keyword"));
        }, this.config.timeoutMs);
      });

      const filterPromise = this.performFilter(servers, allTools, userTurns);

      const result = await Promise.race([filterPromise, timeoutPromise]);
      result.metadata.timeoutOccurred = timeoutOccurred;
      
      const duration = Date.now() - startTime;
      if (this.config.telemetry) {
        this.logTelemetry(result, duration);
      }

      return result;
    } catch (error) {
      this.logger.warn(`[smart-filter] Filter failed: ${error instanceof Error ? error.message : String(error)}, falling back to show all`);
      const result = this.createUnfilteredResult(servers, allTools, "keyword");
      result.metadata.timeoutOccurred = timeoutOccurred;
      return result;
    }
  }

  private async performFilter(
    servers: Record<string, PluginServerConfig>,
    allTools: Map<string, McpTool[]>,
    userTurns: UserTurn[]
  ): Promise<FilterResult> {
    // Step 1: Query synthesis
    const query = this.synthesizeQuery(userTurns);
    
    if (!query) {
      this.logger.debug("[smart-filter] No meaningful query found, showing all servers");
      return this.createUnfilteredResult(servers, allTools, "keyword", "");
    }

    // Step 2: Prepare filterable servers
    const filterableServers = this.prepareFilterableServers(servers, allTools);
    
    // Step 3: Level 1 - Server filtering
    const serverScores = this.scoreServers(query, filterableServers);
    const selectedServers = this.selectServers(serverScores, filterableServers);

    // Step 4: Level 2 - Tool filtering
    const toolResults = this.filterTools(query, selectedServers);

    return {
      servers: selectedServers.map(s => s.server),
      tools: toolResults,
      metadata: {
        queryUsed: query,
        totalServersBeforeFilter: Object.keys(servers).length,
        totalToolsBeforeFilter: Array.from(allTools.values()).flat().length,
        filterMode: "keyword",
        timeoutOccurred: false,
        confidenceScore: this.calculateConfidenceScore(serverScores),
      },
    };
  }

  /**
   * Extract meaningful intent from last 1-3 user turns
   */
  private synthesizeQuery(userTurns: UserTurn[]): string {
    if (!userTurns || userTurns.length === 0) {
      return "";
    }

    // Take last 1-3 turns, newest first
    const recentTurns = userTurns
      .slice(-3)
      .reverse()
      .map(turn => turn.content.trim());

    for (const content of recentTurns) {
      const cleanedQuery = this.extractMeaningfulContent(content);
      if (cleanedQuery.length >= 3) {
        return cleanedQuery;
      }
    }

    // If all recent turns are too short, try combining them
    const combined = recentTurns
      .map(content => this.extractMeaningfulContent(content))
      .filter(content => content.length > 0)
      .join(" ")
      .trim();

    return combined.length >= 3 ? combined : "";
  }

  private extractMeaningfulContent(content: string): string {
    // Remove metadata patterns
    const cleaned = content
      .replace(/\[.*?\]/g, "") // [timestamps], [commands]
      .replace(/^\s*[>]*\s*/gm, "") // quote markers
      .replace(/^\s*[-*•]\s*/gm, "") // list markers
      .trim();

    // Filter out noise words/confirmations
    const noisePatterns = [
      /^(yes|no|ok|okay|sure|thanks?|thank you)\.?$/i,
      /^(do it|go ahead|proceed)\.?$/i,
      /^(yes,?\s+(do it|go ahead|proceed))\.?$/i,
      /^\?+$/,
      /^\.+$/,
      /^!+$/,
    ];

    if (noisePatterns.some(pattern => pattern.test(cleaned))) {
      return "";
    }

    // Remove trailing "please" and other politeness words
    const withoutPoliteness = cleaned
      .replace(/\s+please\.?$/i, "")
      .replace(/\s+thanks?\.?$/i, "")
      .trim();

    return withoutPoliteness;
  }

  private prepareFilterableServers(
    servers: Record<string, PluginServerConfig>,
    allTools: Map<string, McpTool[]>
  ): FilterableServer[] {
    return Object.entries(servers).map(([name, config]) => ({
      name,
      description: config.description || "",
      keywords: this.normalizeKeywords(config.keywords || []),
      tools: allTools.get(name) || [],
    }));
  }

  private normalizeKeywords(keywords: string[]): string[] {
    return keywords
      .slice(0, 30) // Max 30 keywords
      .map(kw => kw.toLowerCase().trim())
      .filter(kw => kw.length > 0)
      .filter((kw, index, arr) => arr.indexOf(kw) === index); // Deduplicate
  }

  /**
   * Score servers using weighted overlap scoring
   */
  private scoreServers(query: string, servers: FilterableServer[]): Array<{ server: FilterableServer; score: number }> {
    const queryWords = this.tokenize(query.toLowerCase());
    
    return servers.map(server => ({
      server,
      score: this.calculateServerScore(queryWords, server),
    }));
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter(word => word.length > 0);
  }

  private calculateServerScore(queryWords: string[], server: FilterableServer): number {
    if (queryWords.length === 0) return 0;

    const descriptionWords = this.tokenize(server.description);
    const keywordWords = server.keywords;
    const allServerWords = [...descriptionWords, ...keywordWords];

    // Calculate overlaps
    const descMatches = this.countOverlap(queryWords, descriptionWords);
    const keywordOnlyMatches = this.countOverlap(queryWords, keywordWords) - descMatches;

    // Add basic synonym matching for common terms
    let semanticMatches = 0;
    for (const queryWord of queryWords) {
      semanticMatches += this.getSemanticScore(queryWord, allServerWords);
    }

    // Also check for partial/substring matches for better recall
    let partialMatches = 0;
    for (const queryWord of queryWords) {
      for (const serverWord of allServerWords) {
        if (queryWord.length > 3 && serverWord.includes(queryWord)) {
          partialMatches += 0.3; // Partial match gets partial credit
        }
      }
    }

    // Weighted scoring: description 1.0x, keywords 0.7x, semantic 0.5x, partial matches 0.3x
    const score = (descMatches * 1.0 + Math.max(0, keywordOnlyMatches) * 0.7 + semanticMatches * 0.5 + partialMatches) / queryWords.length;

    return score;
  }

  private getSemanticScore(queryWord: string, serverWords: string[]): number {
    // Comprehensive synonym/semantic matching
    const synonymMap: Record<string, string[]> = {
      // Finance/payment terms
      money: ["payment", "transfer", "currency", "invoice", "billing", "charge", "account", "balance"],
      payment: ["money", "transfer", "invoice", "billing", "charge", "process"],
      send: ["transfer", "payment", "international"],
      transfer: ["send", "payment", "money", "international"],
      invoice: ["bill", "charge", "payment", "billing", "customer"],
      account: ["balance", "money", "payment"],
      balance: ["account", "money"],
      international: ["transfer", "money", "payment"],
      
      // Task/productivity terms  
      task: ["todo", "reminder", "project", "management", "productivity"],
      todo: ["task", "reminder", "management"],
      create: ["add", "new", "task", "issue"],
      project: ["task", "management", "board", "productivity"],
      manage: ["task", "project", "productivity"],
      schedule: ["meeting", "calendar", "appointment"],
      meeting: ["schedule", "calendar"],
      
      // Development terms
      code: ["repo", "repository", "commit", "branch", "github"],
      issue: ["bug", "ticket", "github", "repository"],
      bug: ["issue", "github"],
      repository: ["repo", "code", "github"],
      commit: ["code", "repository", "github"],
      
      // Location/maps terms
      location: ["map", "address", "directions", "geocode", "places"],
      directions: ["map", "route", "location"],
      address: ["location", "geocode"],
      geocode: ["address", "location"],
      restaurant: ["location", "places", "map"],
      nearby: ["location", "map"],
      
      // Storage/document terms
      upload: ["store", "save", "file", "document"],
      document: ["file", "note", "upload", "storage"],
      store: ["save", "upload", "note"],
      notes: ["document", "store"],
      
      // Infrastructure terms
      deploy: ["infrastructure", "cloud", "server"],
      cloud: ["infrastructure", "deploy"],
      server: ["infrastructure", "monitoring"],
      infrastructure: ["cloud", "server", "deploy"],
      monitoring: ["server", "infrastructure"],
      
      // Collaboration terms
      whiteboard: ["collaboration", "brainstorming"],
      brainstorming: ["whiteboard", "collaboration"],
      collaboration: ["whiteboard", "design"],
      
      // Search terms
      search: ["find", "information", "papers"],
      find: ["search", "information"],
      information: ["search", "find"],
      
      // Web scraping terms
      analyze: ["data", "extract", "website"],
      extract: ["data", "scraping", "website"],
      website: ["scraping", "analyze", "extract"],
      data: ["extract", "analyze", "scraping"],
      traffic: ["website", "analyze"],
    };

    const synonyms = synonymMap[queryWord.toLowerCase()] || [];
    let matches = 0;
    
    for (const synonym of synonyms) {
      if (serverWords.includes(synonym)) {
        matches += 1;
      }
    }
    
    return matches;
  }

  private countOverlap(words1: string[], words2: string[]): number {
    const set2 = new Set(words2);
    return words1.filter(word => set2.has(word)).length;
  }

  /**
   * Select servers using dynamic topServers with confidence-based expansion
   */
  private selectServers(
    serverScores: Array<{ server: FilterableServer; score: number }>,
    allServers: FilterableServer[]
  ): Array<{ server: FilterableServer; score: number }> {
    // Include always-included servers first
    const alwaysIncluded = allServers
      .filter(s => this.config.alwaysInclude.includes(s.name))
      .map(server => ({ server, score: 1.0 }));

    // Sort all servers by score
    const allScoredServers = serverScores
      .filter(({ server }) => !this.config.alwaysInclude.includes(server.name))
      .sort((a, b) => b.score - a.score);

    // Primary filter: servers that meet threshold
    const thresholdServers = allScoredServers.filter(({ score }) => score >= this.config.serverThreshold);
    
    // Fallback: if too few servers pass threshold, include more based on ranking
    let scoredServers = thresholdServers;
    if (thresholdServers.length < 2) {
      // Take at least top 3 servers regardless of threshold for better recall
      scoredServers = allScoredServers.slice(0, Math.max(3, this.config.topServers));
      this.logger.debug(`[smart-filter] Only ${thresholdServers.length} servers met threshold, expanding to top ${scoredServers.length}`);
    }

    // Dynamic topServers based on confidence
    let numServers = this.config.topServers;
    if (scoredServers.length >= 2) {
      const topScore = scoredServers[0].score;
      const cutoffScore = scoredServers[Math.min(this.config.topServers - 1, scoredServers.length - 1)].score;
      const gap = topScore - cutoffScore;

      // If gap is small (uncertain), expand toward hard cap
      if (gap < 0.1 && scoredServers.length > numServers) {
        numServers = Math.min(this.config.hardCap, scoredServers.length);
        this.logger.debug(`[smart-filter] Low confidence (gap: ${gap.toFixed(3)}), expanding to ${numServers} servers`);
      }
    }

    const selectedScored = scoredServers.slice(0, numServers);
    return [...alwaysIncluded, ...selectedScored];
  }

  /**
   * Filter tools within selected servers
   */
  private filterTools(
    query: string,
    selectedServers: Array<{ server: FilterableServer; score: number }>
  ): Array<{ serverId: string; tool: McpTool }> {
    const queryWords = this.tokenize(query);
    const allTools: Array<{ serverId: string; tool: McpTool; score: number }> = [];

    for (const { server } of selectedServers) {
      for (const tool of server.tools) {
        const score = this.calculateToolScore(queryWords, tool);
        if (score >= this.config.toolThreshold) {
          allTools.push({ serverId: server.name, tool, score });
        }
      }
    }

    // Sort by score and take top N
    return allTools
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.topTools)
      .map(({ serverId, tool }) => ({ serverId, tool }));
  }

  private calculateToolScore(queryWords: string[], tool: McpTool): number {
    if (queryWords.length === 0) return 0;

    const nameWords = this.tokenize(tool.name);
    const descWords = this.tokenize(tool.description || "");

    const nameMatches = this.countOverlap(queryWords, nameWords);
    const descMatches = this.countOverlap(queryWords, descWords) - this.countOverlap(queryWords, nameWords);

    // Weighted: description 1.0x, name 0.5x (name is less descriptive usually)
    const score = (descMatches * 1.0 + nameMatches * 0.5) / queryWords.length;

    return score;
  }

  private calculateConfidenceScore(serverScores: Array<{ server: FilterableServer; score: number }>): number {
    if (serverScores.length < 2) return 1.0;

    const scores = serverScores.map(s => s.score).sort((a, b) => b - a);
    const topScore = scores[0];
    const secondScore = scores[1];

    // Confidence based on gap between top scores
    if (topScore === 0) return 0;
    return Math.min(1.0, (topScore - secondScore) / topScore);
  }

  private createUnfilteredResult(
    servers: Record<string, PluginServerConfig>,
    allTools: Map<string, McpTool[]>,
    filterMode: "keyword" | "disabled",
    queryUsed = ""
  ): FilterResult {
    const filterableServers = this.prepareFilterableServers(servers, allTools);
    const tools = Array.from(allTools.entries()).flatMap(([serverId, tools]) =>
      tools.map(tool => ({ serverId, tool }))
    );

    return {
      servers: filterableServers,
      tools,
      metadata: {
        queryUsed,
        totalServersBeforeFilter: Object.keys(servers).length,
        totalToolsBeforeFilter: tools.length,
        filterMode,
        timeoutOccurred: false,
      },
    };
  }

  private logTelemetry(result: FilterResult, durationMs: number): void {
    const telemetry = {
      timestamp: new Date().toISOString(),
      query: result.metadata.queryUsed,
      serversReturned: result.servers.length,
      toolsReturned: result.tools.length,
      totalServersBefore: result.metadata.totalServersBeforeFilter,
      totalToolsBefore: result.metadata.totalToolsBeforeFilter,
      filterMode: result.metadata.filterMode,
      durationMs,
      confidenceScore: result.metadata.confidenceScore,
      timeoutOccurred: result.metadata.timeoutOccurred,
    };

    this.logger.debug("[smart-filter] Telemetry:", JSON.stringify(telemetry));
  }
}

// ── Standalone utility exports (for testing and external use) ────────────────

const MAX_KEYWORDS = 30;

const NOISE_WORDS = new Set([
  "yes", "no", "ok", "okay", "sure", "yep", "nope", "yeah", "nah",
  "do", "it", "please", "thanks", "thank", "you", "hi", "hello",
  "hey", "right", "alright", "fine", "got", "hmm", "hm",
]);

export const DEFAULTS: Required<SmartFilterConfig> = {
  enabled: false,
  embedding: "keyword",
  topServers: 5,
  hardCap: 8,
  topTools: 10,
  serverThreshold: 0.15,
  toolThreshold: 0.10,
  fallback: "keyword",
  alwaysInclude: [],
  timeoutMs: 500,
  telemetry: false,
};

/** Lowercase, split on whitespace + punctuation, preserve numbers, drop empties. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\p{P}]+/u)
    .filter(t => t.length > 0);
}

/** Normalize keywords: lowercase, trim, dedup, strip empties, cap at MAX_KEYWORDS. */
export function validateKeywords(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const kw of raw) {
    const normalized = kw.toLowerCase().trim();
    if (normalized.length === 0 || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
    if (out.length >= MAX_KEYWORDS) break;
  }
  return out;
}

/**
 * Extract a meaningful intent string from the last 1-3 user turns.
 * Returns null if no meaningful query can be extracted.
 */
export function synthesizeQuery(userTurns: string[]): string | null {
  const recent = userTurns.slice(-3).reverse();
  for (const turn of recent) {
    const tokens = tokenize(turn).filter(t => !NOISE_WORDS.has(t));
    if (tokens.length >= 2) {
      return tokens.join(" ");
    }
  }
  return null;
}

export interface ServerScore {
  name: string;
  score: number;
}

/**
 * Score a single server against a query using weighted word overlap.
 * desc_matches * 1.0 + kw_only_matches * 0.5, normalized by query length.
 */
export function scoreServer(
  queryTokens: string[],
  serverName: string,
  description: string,
  keywords: string[],
): number {
  if (queryTokens.length === 0) return 0;

  const descTokens = new Set(tokenize(description));
  for (const t of tokenize(serverName)) descTokens.add(t);
  const kwTokens = new Set(validateKeywords(keywords).flatMap(kw => tokenize(kw)));

  let descMatches = 0;
  let kwOnlyMatches = 0;

  for (const qt of queryTokens) {
    if (descTokens.has(qt)) {
      descMatches++;
    } else if (kwTokens.has(qt)) {
      kwOnlyMatches++;
    }
  }

  return (descMatches * 1.0 + kwOnlyMatches * 0.5) / queryTokens.length;
}

/** Score all servers, return sorted highest-first. */
export function scoreAllServers(
  queryTokens: string[],
  servers: Record<string, PluginServerConfig>,
): ServerScore[] {
  const scores: ServerScore[] = [];
  for (const [name, cfg] of Object.entries(servers)) {
    scores.push({ name, score: scoreServer(queryTokens, name, cfg.description ?? "", cfg.keywords ?? []) });
  }
  return scores.sort((a, b) => b.score - a.score);
}

/**
 * Select top servers with dynamic expansion toward hardCap.
 * If top score < threshold AND gap small → show all (true uncertainty).
 */
export function selectTopServers(
  scores: ServerScore[],
  topServers: number,
  hardCap: number,
  threshold: number,
  alwaysInclude: string[],
): string[] {
  if (scores.length === 0) return [];

  const topScore = scores[0].score;

  if (topScore < threshold && scores.length > 1) {
    const gap = topScore - scores[Math.min(scores.length - 1, topServers - 1)].score;
    if (gap < 0.05) {
      return scores.map(s => s.name);
    }
  }

  let k = Math.min(topServers, scores.length);

  if (k < scores.length && k < hardCap) {
    const kthScore = scores[k - 1].score;
    while (k < Math.min(hardCap, scores.length)) {
      if (scores[k].score >= kthScore * 0.8 && scores[k].score >= threshold) {
        k++;
      } else {
        break;
      }
    }
  }

  const selected = new Set<string>();
  for (let i = 0; i < k && i < scores.length; i++) {
    if (scores[i].score >= threshold || i === 0) {
      selected.add(scores[i].name);
    }
  }

  for (const name of alwaysInclude) selected.add(name);

  return [...selected];
}

// ── Main filter entry point ─────────────────────────────────────────────────

export interface SmartFilterResult {
  filteredServers: string[];
  allServers: string[];
  query: string | null;
  scores: ServerScore[];
  reason: "filtered" | "no-query" | "timeout" | "error" | "disabled";
}

/**
 * Run the smart filter. Returns the list of server names to include.
 * Guarantees: never throws, never blocks longer than timeoutMs.
 */
export function filterServers(
  servers: Record<string, PluginServerConfig>,
  userTurns: string[],
  config: SmartFilterConfig,
  logger?: OpenClawLogger,
): SmartFilterResult {
  const allServers = Object.keys(servers);
  const showAll = (reason: SmartFilterResult["reason"], query: string | null = null): SmartFilterResult => ({
    filteredServers: allServers,
    allServers,
    query,
    scores: [],
    reason,
  });

  if (!config.enabled) return showAll("disabled");

  try {
    const merged = { ...DEFAULTS, ...config };
    const startTime = Date.now();

    const query = synthesizeQuery(userTurns);
    if (!query) return showAll("no-query");

    if (Date.now() - startTime > merged.timeoutMs) {
      logger?.warn("[smart-filter] Timeout during query synthesis");
      return showAll("timeout", query);
    }

    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return showAll("no-query");

    const scores = scoreAllServers(queryTokens, servers);

    if (Date.now() - startTime > merged.timeoutMs) {
      logger?.warn("[smart-filter] Timeout during scoring");
      return showAll("timeout", query);
    }

    const filteredServers = selectTopServers(
      scores,
      merged.topServers,
      merged.hardCap,
      merged.serverThreshold,
      merged.alwaysInclude,
    );

    return { filteredServers, allServers, query, scores, reason: "filtered" };
  } catch (err) {
    logger?.error("[smart-filter] Error during filtering, showing all servers:", err);
    return showAll("error");
  }
}

/** Build a filtered router tool description string. */
export function buildFilteredDescription(
  allServers: Record<string, PluginServerConfig>,
  filteredNames: string[],
): string {
  const included = new Set(filteredNames);
  const serverList = Object.entries(allServers)
    .filter(([name]) => included.has(name))
    .map(([name, cfg]) => {
      const desc = cfg.description;
      return desc ? `${name} (${desc})` : name;
    })
    .join(", ");

  if (!serverList) {
    return "Call MCP server tools. No servers matched the current context.";
  }

  return `Call any MCP server tool. Servers: ${serverList}. Use action='list' to discover tools and required parameters, action='call' to execute a tool, action='refresh' to clear cache and re-discover tools, and action='status' to check server connection states. If the user mentions a specific tool by name, the call action auto-connects and works without listing first.`;
}