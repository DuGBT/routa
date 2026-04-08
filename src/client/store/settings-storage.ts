import {
  AGENT_ROLES,
  type DefaultProviderSettings,
  type AgentModelConfig,
  type ProviderConnectionsStorage,
  type ProviderConnectionConfig,
  type ModelDefinition,
} from "../types/settings-types";

// ─── Storage Keys ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "routa.defaultProviders";
const CONNECTIONS_STORAGE_KEY = "routa.providerConnections";
const MODEL_DEFINITIONS_KEY = "routa.modelDefinitions";
const DOCKER_OPENCODE_AUTH_JSON_KEY = "docker-opencode-auth-json";

// ─── Default Provider Settings ──────────────────────────────────────────────────

export function loadDefaultProviders(): DefaultProviderSettings {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: Record<string, unknown> = JSON.parse(raw);
    const normalized: DefaultProviderSettings = {};
    for (const role of AGENT_ROLES) {
      const value = parsed[role];
      if (!value) continue;
      normalized[role] = typeof value === "string" ? { provider: value } : (value as AgentModelConfig);
    }
    return normalized;
  } catch {
    return {};
  }
}

export function saveDefaultProviders(settings: DefaultProviderSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

// ─── Provider Connections ───────────────────────────────────────────────────────

export function loadProviderConnections(): ProviderConnectionsStorage {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CONNECTIONS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ProviderConnectionsStorage) : {};
  } catch {
    return {};
  }
}

export function loadProviderConnectionConfig(providerId: string): ProviderConnectionConfig {
  return loadProviderConnections()[providerId] ?? {};
}

export function saveProviderConnections(storage: ProviderConnectionsStorage): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CONNECTIONS_STORAGE_KEY, JSON.stringify(storage));
}

// ─── Model Definitions ──────────────────────────────────────────────────────────

export function loadModelDefinitions(): ModelDefinition[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MODEL_DEFINITIONS_KEY);
    return raw ? (JSON.parse(raw) as ModelDefinition[]) : [];
  } catch {
    return [];
  }
}

export function saveModelDefinitions(defs: ModelDefinition[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MODEL_DEFINITIONS_KEY, JSON.stringify(defs));
}

export function getModelDefinitionByAlias(alias: string): ModelDefinition | undefined {
  if (!alias || typeof window === "undefined") return undefined;
  return loadModelDefinitions().find((definition) => definition.alias === alias);
}

// ─── Docker OpenCode Auth ───────────────────────────────────────────────────────

export function loadDockerOpencodeAuthJson(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(DOCKER_OPENCODE_AUTH_JSON_KEY) ?? "";
}

export function saveDockerOpencodeAuthJson(json: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DOCKER_OPENCODE_AUTH_JSON_KEY, json);
}
