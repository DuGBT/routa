// ─── Re-export barrel ───────────────────────────────────────────────────────────
// This module was decomposed into:
//   @/client/types/settings-types   – types, constants, utility functions
//   @/client/store/settings-storage  – localStorage CRUD (pure data layer)
//
// Re-exports are kept for backward compatibility and will be removed later.

// Types & constants
export {
  AGENT_ROLES,
  type AgentRoleKey,
  ROLE_DESCRIPTIONS,
  SETTINGS_PANEL_HEIGHT,
  SETTINGS_PANEL_BODY_MAX_HEIGHT,
  BASE_URL_SUGGESTIONS,
  EMPTY_MODEL_FORM,
  TIER_LABELS,
  ROLE_CHIP,
  EMPTY_SPECIALIST_FORM,
  isCustomProvider,
  type MemoryStats,
  type MemoryResponse,
  type AgentModelConfig,
  type DefaultProviderSettings,
  type ProviderConnectionConfig,
  type ProviderConnectionsStorage,
  type ModelDefinition,
  type ProviderOption,
  type SettingsPanelProps,
  type SettingsTab,
  type SpecialistForm,
  type SpecialistsTabProps,
  type GroupedSpecialists,
} from "../types/settings-types";

// CSS class constants (kept here – they will migrate to shadcn components)
/** @deprecated Use shadcn Input from @/components/ui/input instead */
export const inputCls =
  "w-full text-xs px-2 py-1.5 rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-ring focus:outline-none";
/** @deprecated Use shadcn Label from @/components/ui/label instead */
export const labelCls = "text-[10px] font-medium text-muted-foreground uppercase tracking-wider";
export const sectionHeadCls = "text-xs font-semibold text-muted-foreground uppercase tracking-wider";
export const settingsCardCls = "rounded-xl border border-border bg-card p-4 text-card-foreground";

// localStorage persistence
export {
  loadDefaultProviders,
  saveDefaultProviders,
  loadProviderConnections,
  loadProviderConnectionConfig,
  saveProviderConnections,
  loadModelDefinitions,
  saveModelDefinitions,
  getModelDefinitionByAlias,
} from "../store/settings-storage";
