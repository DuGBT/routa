/**
 * MCP Setup for Claude Code
 *
 * Configures MCP (Model Context Protocol) so that Claude Code can reach
 * the Routa MCP coordination server at /api/mcp.
 *
 * Claude Code accepts inline JSON via --mcp-config <json>.
 */

import type { McpServerConfig } from "@anthropic-ai/claude-agent-sdk";
import {
  getDefaultRoutaMcpConfig,
  type RoutaMcpConfig,
} from "./mcp-config-generator";
import {
  type CustomMcpServerConfig,
  getCustomMcpServerStore,
  mergeCustomMcpServers,
} from "../store/custom-mcp-server-store";

// ─── Types ─────────────────────────────────────────────────────────────

export type McpSupportedProvider = "claude";

/**
 * Result of a file-based MCP setup (OpenCode / Auggie).
 * `mcpConfigs` is the array of strings that should end up in
 * AcpProcessConfig.mcpConfigs (empty for OpenCode because it reads a file).
 */
export interface McpSetupResult {
  /** Strings to pass as --mcp-config <value> */
  mcpConfigs: string[];
  /** Human-readable summary for logs */
  summary: string;
}

// ─── Public API ────────────────────────────────────────────────────────

export function providerSupportsMcp(providerId: string): boolean {
  return providerId === "claude";
}

/**
 * Load enabled custom MCP servers from the database.
 * Returns an empty array if the database is unavailable.
 */
async function loadCustomMcpServers(workspaceId?: string): Promise<CustomMcpServerConfig[]> {
  try {
    const store = getCustomMcpServerStore();
    if (!store) return [];
    return await store.listEnabled(workspaceId);
  } catch (err) {
    console.warn("[MCP] Failed to load custom MCP servers:", err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Ensure MCP is configured for `providerId` and return the values that
 * should be forwarded to the process (if any).
 *
 * Call this **before** spawning the process.
 *
 * When `config.includeCustomServers` is not explicitly false, custom MCP servers
 * from the database are merged alongside the built-in routa-coordination server.
 */
export async function ensureMcpForProvider(
  providerId: string,
  config?: RoutaMcpConfig,
): Promise<McpSetupResult> {
  if (!providerSupportsMcp(providerId)) {
    return { mcpConfigs: [], summary: `${providerId}: MCP not supported` };
  }

  const cfg = config || getDefaultRoutaMcpConfig();
  // Use the direct endpoint override if the standalone MCP server is running
  const mcpEndpoint = cfg.mcpEndpoint || `${cfg.routaServerUrl}/api/mcp`;

  // Load custom MCP servers from DB
  let customServers: CustomMcpServerConfig[] = [];
  if (cfg.includeCustomServers !== false) {
    customServers = await loadCustomMcpServers(cfg.workspaceId);
    if (customServers.length > 0) {
      console.log(`[MCP] Loaded ${customServers.length} custom MCP server(s)`);
    }
  }

  return ensureMcpForClaude(mcpEndpoint, cfg.workspaceId, customServers);
}

// ─── Claude Code ───────────────────────────────────────────────────────
//
// Claude Code accepts inline JSON via --mcp-config <json>

function ensureMcpForClaude(
  mcpEndpoint: string,
  workspaceId?: string,
  customServers: CustomMcpServerConfig[] = [],
): McpSetupResult {
  const builtIn: Record<string, unknown> = {
    "routa-coordination": {
      url: mcpEndpoint,
      type: "http",
      env: { ROUTA_WORKSPACE_ID: workspaceId || "" },
    },
  };
  const json = JSON.stringify({
    mcpServers: mergeCustomMcpServers(builtIn, customServers),
  });

  return {
    mcpConfigs: [json],
    summary: `claude: inline JSON (${json.length} bytes)`,
  };
}

// ─── Legacy convenience wrappers ───────────────────────────────────────

/** @deprecated Use ensureMcpForProvider("claude", config) */
export async function setupMcpForProvider(
  config?: RoutaMcpConfig,
): Promise<string[]> {
  return (await ensureMcpForProvider("claude", config)).mcpConfigs;
}

export async function setupMcpForClaudeCode(config?: RoutaMcpConfig): Promise<string[]> {
  return (await ensureMcpForProvider("claude", config)).mcpConfigs;
}

// ─── Helpers ───────────────────────────────────────────────────────────

export function isMcpConfigured(mcpConfigs?: string[]): boolean {
  return !!mcpConfigs && mcpConfigs.length > 0;
}

/**
 * Parse Claude-style inline MCP config JSON into the SDK's `mcpServers` object.
 * Ignores unreadable entries so callers can fall back safely.
 */
export function parseMcpServersFromConfigs(mcpConfigs?: string[]): Record<string, McpServerConfig> | undefined {
  if (!mcpConfigs || mcpConfigs.length === 0) {
    return undefined;
  }

  const merged: Record<string, McpServerConfig> = {};

  for (const rawConfig of mcpConfigs) {
    try {
      const parsed = JSON.parse(rawConfig) as { mcpServers?: Record<string, McpServerConfig> } | null;
      if (parsed?.mcpServers && typeof parsed.mcpServers === "object") {
        Object.assign(merged, parsed.mcpServers);
      }
    } catch {
      // Ignore non-inline configs; Claude SDK path only relies on JSON strings.
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

export function getMcpStatus(
  providerId: string,
  mcpConfigs?: string[],
): { supported: boolean; configured: boolean; configCount: number } {
  return {
    supported: providerSupportsMcp(providerId),
    configured: isMcpConfigured(mcpConfigs),
    configCount: mcpConfigs?.length || 0,
  };
}
