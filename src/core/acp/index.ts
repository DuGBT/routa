export { createRoutaAcpAgent } from "./routa-acp-agent";
export {
  AcpSessionManager,
  type AcpAgentConfig,
  type AcpSessionInfo,
} from "./acp-session-manager";
export {
  Processer,
  getAcpProcessManager,
  buildConfigFromPreset,
  buildDefaultConfig,
  type AcpProcessConfig,
  type JsonRpcMessage,
  type NotificationHandler,
} from "./processer";
export {
  type AcpAgentPreset,
  ACP_AGENT_PRESETS,
  getPresetById,
  getDefaultPreset,
  resolveCommand,
} from "./acp-presets";

// Provider Registry exports
export {
  ProviderRegistry,
  parseCompoundModelId,
  createCompoundModelId,
  isModelValidForProvider,
  getModelForProvider,
  getDefaultProviderId,
  resolveModelForSpecialist,
  extractProviderIdFromModel,
  PROVIDER_MODEL_TIERS,
  type ParsedModelId,
  type ProviderFactory,
  type ProviderCreateConfig,
} from "./provider-registry";

export { which, needsShell } from "./utils";

// AgentEventBridge exports
export {
  AgentEventBridge,
  makePlanUpdatedEvent,
  makeStartedEvent,
  classifyToolKind,
  extractFilePaths,
  extractFileChanges,
  type WorkspaceAgentEvent,
  type AgentStartedEvent,
  type AgentCompletedEvent,
  type AgentFailedEvent,
  type PlanUpdatedEvent,
  type PlanItem,
  type PlanItemStatus,
  type ToolCallBlockEvent,
  type ReadBlockEvent,
  type FileChangesBlockEvent,
  type TerminalBlockEvent,
  type McpBlockEvent,
  type MessageBlockEvent,
  type ThoughtBlockEvent,
  type UsageReportedEvent,
  type FileChange,
  type BlockStatus,
  type ToolKind,
  type AgentUsage,
} from "./agent-event-bridge";
export {
  ClaudeCodeProcess,
  buildClaudeCodeConfig,
  type ClaudeCodeProcessConfig,
} from "@/core/acp/claude-code-process";

// MCP Configuration exports
export {
  generateRoutaMcpConfig,
  generateRoutaMcpConfigJson,
  generateMultipleRoutaMcpConfigs,
  getDefaultRoutaMcpConfig,
  validateRoutaMcpConfig,
  type RoutaMcpConfig,
  type McpServerConfig,
} from "./mcp-config-generator";

export {
  ensureMcpForProvider,
  setupMcpForProvider,
  setupMcpForClaudeCode,
  providerSupportsMcp,
  isMcpConfigured,
  getMcpStatus,
  type McpSupportedProvider,
  type McpSetupResult,
} from "./mcp-setup";
