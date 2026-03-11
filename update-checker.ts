import { execSync, exec as execCb } from "child_process";
import { OpenClawLogger } from "./types.js";
import { PLUGIN_VERSION } from "./protocol.js";

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  updateCommand: string;
}

const PACKAGE_NAME = "@aiwerk/openclaw-mcp-bridge";

let cachedUpdateInfo: UpdateInfo | null = null;
let noticeDelivered = false;

/**
 * Check npm registry for a newer version. Non-blocking, best-effort.
 * Caches result for the lifetime of the plugin (one gateway run).
 */
export async function checkForUpdate(logger: OpenClawLogger): Promise<UpdateInfo> {
  if (cachedUpdateInfo) return cachedUpdateInfo;

  const current = PLUGIN_VERSION;
  const updateCmd = `npm update -g ${PACKAGE_NAME}`;

  try {
    const latest = await npmViewVersion(logger);
    const updateAvailable = latest !== current && isNewer(latest, current);

    cachedUpdateInfo = {
      currentVersion: current,
      latestVersion: latest,
      updateAvailable,
      updateCommand: updateCmd,
    };

    if (updateAvailable) {
      logger.info(`[mcp-client] Update available: ${current} → ${latest}`);
    } else {
      logger.info(`[mcp-client] Version ${current} is up to date`);
    }
  } catch (err) {
    logger.warn(`[mcp-client] Version check failed: ${err instanceof Error ? err.message : err}`);
    cachedUpdateInfo = {
      currentVersion: current,
      latestVersion: current,
      updateAvailable: false,
      updateCommand: updateCmd,
    };
  }

  return cachedUpdateInfo;
}

/**
 * Build the notice string to inject into the first tool response.
 * Returns empty string if no update or already delivered.
 */
export function getUpdateNotice(): string {
  if (noticeDelivered || !cachedUpdateInfo?.updateAvailable) return "";
  noticeDelivered = true;
  return (
    `\n\n---\n⬆️ **MCP Bridge update available:** ${cachedUpdateInfo.currentVersion} → ${cachedUpdateInfo.latestVersion}\n` +
    `Run the \`mcp_bridge_update\` tool to update, or manually: \`${cachedUpdateInfo.updateCommand}\``
  );
}

/**
 * Reset the notice flag (for testing).
 */
export function resetNoticeFlag(): void {
  noticeDelivered = false;
}

/**
 * Execute the actual npm update. Returns a result message.
 */
export async function runUpdate(logger: OpenClawLogger): Promise<string> {
  const info = cachedUpdateInfo ?? await checkForUpdate(logger);

  if (!info.updateAvailable) {
    return `✅ MCP Bridge is already up to date (v${info.currentVersion}).`;
  }

  logger.info(`[mcp-client] Running update: ${info.updateCommand}`);

  try {
    const output = await execAsync(info.updateCommand, 60_000);
    // Invalidate cache so next check re-fetches
    cachedUpdateInfo = null;
    noticeDelivered = false;

    // Verify new version
    const newVersion = npmViewVersionSync(logger);
    return (
      `✅ MCP Bridge updated: ${info.currentVersion} → ${newVersion}\n` +
      `A gateway restart is needed to load the new version.\n\n` +
      `npm output:\n\`\`\`\n${output.trim()}\n\`\`\``
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[mcp-client] Update failed: ${msg}`);
    return (
      `❌ Update failed. You can try manually:\n` +
      `\`\`\`\n${info.updateCommand}\n\`\`\`\n\nError: ${msg}`
    );
  }
}

// --- helpers ---

function npmViewVersion(logger: OpenClawLogger): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("npm view timed out")), 10_000);
    execCb(`npm view ${PACKAGE_NAME} version`, { encoding: "utf-8" }, (err, stdout) => {
      clearTimeout(timeout);
      if (err) return reject(err);
      const ver = (stdout ?? "").trim();
      if (!ver) return reject(new Error("empty version from npm"));
      resolve(ver);
    });
  });
}

function npmViewVersionSync(logger: OpenClawLogger): string {
  try {
    return execSync(`npm view ${PACKAGE_NAME} version`, { encoding: "utf-8", timeout: 10_000 }).trim();
  } catch {
    return "unknown";
  }
}

function execAsync(cmd: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Command timed out after ${timeoutMs}ms`)), timeoutMs);
    execCb(cmd, { encoding: "utf-8", timeout: timeoutMs }, (err, stdout, stderr) => {
      clearTimeout(timeout);
      if (err) return reject(new Error(`${err.message}\n${stderr ?? ""}`));
      resolve(stdout ?? "");
    });
  });
}

function isNewer(latest: string, current: string): boolean {
  const l = latest.split(".").map(Number);
  const c = current.split(".").map(Number);
  for (let i = 0; i < Math.max(l.length, c.length); i++) {
    const lv = l[i] ?? 0;
    const cv = c[i] ?? 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}
