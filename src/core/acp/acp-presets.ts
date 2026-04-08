/**
 * ACP Agent Presets
 *
 * Well-known ACP agent presets with their standard command-line invocations.
 * Currently only Claude Code is supported as a provider.
 *
 * Ported from AcpAgentPresets.kt with TypeScript adaptations.
 */

import { AgentRole, ModelTier } from "../models/agent";

export interface AcpAgentPreset {
  /** Unique identifier for this preset */
  id: string;
  /** Human-readable display name */
  name: string;
  /** CLI command to execute */
  command: string;
  /** Command-line arguments for ACP mode */
  args: string[];
  /** Short description of the agent */
  description: string;
  /** Optional environment variable for overriding the binary path */
  envBinOverride?: string;
  /**
   * Whether this agent uses a non-standard ACP API.
   * Claude Code natively supports ACP without needing an --acp flag.
   */
  nonStandardApi?: boolean;
  /** Capabilities supported by this provider (e.g., "mcp_tool", "code_generation", "file_operations") */
  capabilities?: string[];
  /** Agent roles that this provider is suitable for (ROUTA, CRAFTER, GATE, DEVELOPER) */
  supportedRoles?: AgentRole[];
  /** Preferred model tier for this provider (SMART, BALANCED, FAST) */
  preferredTier?: ModelTier;
}

/**
 * All known ACP agent presets.
 */
export const ACP_AGENT_PRESETS: readonly AcpAgentPreset[] = [
  {
    id: "claude",
    name: "Claude Code",
    command: "claude",
    args: [],
    description: "Anthropic Claude Code (native ACP support)",
    nonStandardApi: true,
    capabilities: ["mcp_tool", "code_generation", "file_operations", "web_search", "image_analysis"],
    supportedRoles: [AgentRole.ROUTA, AgentRole.CRAFTER, AgentRole.GATE, AgentRole.DEVELOPER],
    preferredTier: ModelTier.SMART,
  },
] as const;

/**
 * Get a preset by its ID.
 */
export function getPresetById(id: string): AcpAgentPreset | undefined {
  return ACP_AGENT_PRESETS.find((p) => p.id === id);
}

/**
 * Get the default preset (Claude Code).
 */
export function getDefaultPreset(): AcpAgentPreset {
  return ACP_AGENT_PRESETS[0];
}

/**
 * Resolve the actual binary path for a preset.
 * Checks in this order:
 * 1. Environment variable override
 * 2. node_modules/.bin (for locally installed packages)
 * 3. Default command (for globally installed or in PATH)
 *
 * On Windows, npm creates a bash wrapper (no extension) alongside a `.cmd`
 * batch file in node_modules/.bin. The extensionless wrapper cannot be
 * spawned directly by Node.js on Windows, so we prefer the `.cmd` version.
 */
export function resolveCommand(preset: AcpAgentPreset): string {
  // Import bridge lazily to avoid circular dependencies at module load time
  const { getServerBridge } = require("@/core/platform");
  const bridge = getServerBridge();
  const isWindows = bridge.env.osPlatform() === "win32";

  // 1. Check environment variable override
  if (preset.envBinOverride) {
    const envValue = bridge.env.getEnv(preset.envBinOverride);
    if (envValue) return envValue;
  }

  // 2. Check node_modules/.bin (for locally installed packages)
  const path = require("path");
  const localBinBase = path.join(bridge.env.currentDir(), "node_modules", ".bin", preset.command);
  try {
    if (isWindows) {
      // On Windows prefer the .cmd batch file
      const cmdPath = localBinBase + ".cmd";
      if (bridge.fs.existsSync(cmdPath)) {
        return cmdPath;
      }
    } else {
      if (bridge.fs.existsSync(localBinBase)) {
        return localBinBase;
      }
    }
  } catch {
    // Ignore errors, fall through to default
  }

  // 3. Fall back to default command (assumes it's in PATH)
  return preset.command;
}
