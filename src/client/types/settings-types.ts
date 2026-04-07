import type { AgentRole, ModelTier, SpecialistConfig } from "../components/specialist-manager";

// ─── Constants ──────────────────────────────────────────────────────────────────

export const AGENT_ROLES = ["ROUTA", "CRAFTER", "GATE", "DEVELOPER"] as const;
export type AgentRoleKey = (typeof AGENT_ROLES)[number];

export const ROLE_DESCRIPTIONS: Record<AgentRoleKey, string> = {
  ROUTA: "Coordinator – plans & delegates",
  CRAFTER: "Implementation – writes code",
  GATE: "Verification – reviews code",
  DEVELOPER: "Solo – plans, implements & verifies",
};

export const SETTINGS_PANEL_HEIGHT = "92vh";
export const SETTINGS_PANEL_BODY_MAX_HEIGHT = "calc(92vh - 148px)";

export const BASE_URL_SUGGESTIONS = [
  "https://open.bigmodel.cn/api/anthropic",
  "https://api.minimaxi.com/anthropic",
  "https://api.deepseek.com/anthropic",
  "https://api.moonshot.ai/anthropic",
  "https://api.openai.com/v1",
  "https://api.anthropic.com/v1",
  "https://generativelanguage.googleapis.com/v1beta/openai",
];

export const EMPTY_MODEL_FORM: ModelDefinition = { alias: "", modelName: "", baseUrl: "", apiKey: "" };

export const TIER_LABELS: Record<ModelTier, string> = { FAST: "Fast", BALANCED: "Balanced", SMART: "Smart" };
export const ROLE_CHIP: Record<AgentRole, string> = {
  ROUTA: "role-chip-routa",
  CRAFTER: "role-chip-crafter",
  GATE: "role-chip-gate",
  DEVELOPER: "role-chip-developer",
};

export const EMPTY_SPECIALIST_FORM: SpecialistForm = {
  id: "",
  name: "",
  description: "",
  role: "CRAFTER",
  defaultModelTier: "BALANCED",
  systemPrompt: "",
  roleReminder: "",
  model: "",
};

// ─── Types / Interfaces ─────────────────────────────────────────────────────────

export interface MemoryStats {
  heapUsedMB: number;
  heapTotalMB: number;
  externalMB: number;
  rssMB: number;
  arrayBuffersMB: number;
  usagePercentage: number;
  level: "normal" | "warning" | "critical";
  timestamp: string;
}

export interface MemoryResponse {
  current: MemoryStats;
  peaks: {
    heapUsedMB: number;
    rssMB: number;
  };
  growthRateMBPerMinute: number;
  sessionStore: {
    sessionCount: number;
    activeSseCount: number;
    streamingCount: number;
    totalHistoryMessages: number;
    totalPendingNotifications: number;
    staleSessionCount: number;
  };
  recommendations: string[];
}

export interface AgentModelConfig {
  provider?: string;
  model?: string;
  maxTurns?: number;
}

export interface DefaultProviderSettings {
  ROUTA?: AgentModelConfig;
  CRAFTER?: AgentModelConfig;
  GATE?: AgentModelConfig;
  DEVELOPER?: AgentModelConfig;
}

export interface ProviderConnectionConfig {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

export type ProviderConnectionsStorage = Record<string, ProviderConnectionConfig>;

export interface ModelDefinition {
  alias: string;
  modelName: string;
  baseUrl?: string;
  apiKey?: string;
}

export interface ProviderOption {
  id: string;
  name: string;
  status?: string;
  source?: "static" | "registry";
  command?: string;
}

export interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  providers: ProviderOption[];
  initialTab?: SettingsTab;
  onResetOnboarding?: () => void;
  variant?: "modal" | "page";
}

export type SettingsTab =
  | "providers"
  | "registry"
  | "roles"
  | "specialists"
  | "models"
  | "mcp"
  | "webhooks"
  | "schedules"
  | "workflows";

export interface SpecialistForm {
  id: string;
  name: string;
  description: string;
  role: AgentRole;
  defaultModelTier: ModelTier;
  systemPrompt: string;
  roleReminder: string;
  model: string;
}

export type SpecialistsTabProps = {
  modelDefs: ModelDefinition[];
};

export type GroupedSpecialists = {
  category: string;
  label: string;
  specialists: SpecialistConfig[];
};

// ─── Utility Functions ──────────────────────────────────────────────────────────

export function isCustomProvider(provider: ProviderOption): boolean {
  return provider.id.startsWith("custom-");
}
