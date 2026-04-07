/**
 * Provider Adapter Module
 *
 * Factory and exports for provider adapters.
 * Use getProviderAdapter() to get the Claude Code adapter.
 */

export * from "./types";
export { BaseProviderAdapter } from "./base-adapter";
export { ClaudeCodeAdapter } from "./claude-adapter";

import type { IProviderAdapter } from "./types";
import { ClaudeCodeAdapter } from "./claude-adapter";

/**
 * Cache for adapter instance (singleton).
 */
let cachedAdapter: IProviderAdapter | undefined;

/**
 * Get the Claude Code provider adapter.
 * Returns a cached instance for efficiency.
 */
export function getProviderAdapter(_provider?: string): IProviderAdapter {
  if (cachedAdapter) return cachedAdapter;
  cachedAdapter = new ClaudeCodeAdapter();
  return cachedAdapter;
}

/**
 * Clear the adapter cache (useful for testing).
 */
export function clearAdapterCache(): void {
  cachedAdapter = undefined;
}

/**
 * Get all known provider types.
 */
export function getKnownProviderTypes(): string[] {
  return ["claude"];
}

