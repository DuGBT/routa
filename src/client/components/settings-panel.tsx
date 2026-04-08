"use client";

import { useState, useEffect, useCallback, useId } from "react";
import { desktopAwareFetch } from "../utils/diagnostics";
import { GitHubWebhookPanel } from "./github-webhook-panel";
import { AgentInstallPanel } from "./agent-install-panel";
import { SettingsCenterNav } from "./settings-center-nav";
import { ModelsTab } from "./settings-panel-models-tab";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeSwitcher } from "./theme-switcher";
import {
  clearOnboardingState,
  ONBOARDING_COMPLETED_KEY,
} from "../utils/onboarding";
import { useTranslation } from "@/i18n";
import { Select } from "./select";
import {
  AGENT_ROLES,
  ROLE_DESCRIPTIONS,
  SETTINGS_PANEL_HEIGHT,
  inputCls,
  labelCls,
  loadDefaultProviders,
  loadModelDefinitions,
  saveDefaultProviders,
  sectionHeadCls,
  settingsCardCls,
  type AgentModelConfig,
  type AgentRoleKey,
  type DefaultProviderSettings,
  type MemoryResponse,
  type ModelDefinition,
  type ProviderOption,
  type SettingsPanelProps,
  type SettingsTab,
} from "./settings-panel-shared";
import { ArrowLeft, RefreshCw, Settings, X } from "lucide-react";

export {
  getModelDefinitionByAlias,
  loadDefaultProviders,
  loadModelDefinitions,
  loadProviderConnectionConfig,
  loadProviderConnections,
  saveDefaultProviders,
  saveModelDefinitions,
  saveProviderConnections,
} from "./settings-panel-shared";
export type {
  AgentModelConfig,
  DefaultProviderSettings,
  ModelDefinition,
  ProviderConnectionConfig,
  ProviderConnectionsStorage,
  SettingsPanelProps,
} from "./settings-panel-shared";
function OnboardingSettingsSection({ onResetOnboarding }: { onResetOnboarding?: () => void }) {
  const { t } = useTranslation();
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem(ONBOARDING_COMPLETED_KEY) === "true";
  });

  const handleReset = useCallback(() => {
    if (typeof window !== "undefined") {
      clearOnboardingState(window.localStorage);
    }
    setHasCompletedOnboarding(false);
    onResetOnboarding?.();
  }, [onResetOnboarding]);

  return (
    <div className={settingsCardCls}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={sectionHeadCls}>{t.settings.onboardingSection.title}</p>
          <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
            {t.settings.onboardingSection.description}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
 hasCompletedOnboarding
 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-300"
 : "bg-amber-100 text-amber-700 dark:bg-amber-500/12 dark:text-amber-300"
 }`}>
          {hasCompletedOnboarding ? t.settings.onboardingSection.completed : t.settings.onboardingSection.available}
        </span>
      </div>
      <div className="mt-3 flex justify-start">
        <button
          type="button"
          onClick={handleReset}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
 >
          {t.settings.onboardingSection.showAgain}
        </button>
      </div>
    </div>
  );
}

// ─── System Info Footer ─────────────────────────────────────────────────────
function SystemInfoFooter() {
  const { t } = useTranslation();
  const [memoryStats, setMemoryStats] = useState<MemoryResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await desktopAwareFetch("/api/memory?history=true");
      if (res.ok) {
        const data = await res.json();
        if (data?.current && typeof data.current.level === "string") {
          setMemoryStats(data);
        }
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="border-t border-slate-200 dark:border-slate-700 shrink-0">
      <div className="flex items-center justify-between gap-3 px-4 py-2 text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex min-w-0 items-center gap-3 overflow-hidden">
          <span className="shrink-0 font-medium uppercase tracking-wider">{t.settings.systemInfo}</span>
          {memoryStats?.current ? (
            <>
              <span className="truncate">
                {t.settings.memory} {memoryStats.current.heapUsedMB}/{memoryStats.current.heapTotalMB} MB
              </span>
              <span className="truncate">
                {t.settings.sessions} {memoryStats.sessionStore.sessionCount}
              </span>
              <span className={`shrink-0 ${
 memoryStats.current.level === "critical"
 ? "text-red-500"
 : memoryStats.current.level === "warning"
 ? "text-amber-500"
 : "text-emerald-500"
 }`}>
                {memoryStats.current.level}
              </span>
            </>
          ) : (
            <span>{loading ? t.common.loading : t.common.unavailable}</span>
          )}
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-300"
 title={t.settings.refreshSystemInfo}
          type="button"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}/>
        </button>
      </div>
    </div>
  );
}

function RolesTab({
  settings,
  modelDefs,
  builtinProviders,
  onChange,
  onOpenModelsTab,
}: {
  settings: DefaultProviderSettings;
  modelDefs: ModelDefinition[];
  builtinProviders: ProviderOption[];
  onChange: (role: AgentRoleKey, field: "provider" | "model", value: string) => void;
  onOpenModelsTab: () => void;
}) {
  const { t } = useTranslation();
  const datalistId = useId();

  return (
    <div className="px-4 py-4 space-y-4 overflow-y-auto h-full">
      <div className={settingsCardCls}>
        <p className={sectionHeadCls}>Role Defaults</p>
        <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
          Configure default provider and model override per Routa role.
        </p>
        <div className="mt-4 flex items-center gap-3 mb-2">
          <div className="w-[90px]" />
          <div className="w-[180px] text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Provider</div>
          <div className="flex-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Model Override</div>
        </div>
        <div className="space-y-2.5">
          {AGENT_ROLES.map((role) => (
            <div key={role} className="flex items-center gap-3">
              <div className="w-[90px] shrink-0">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-300">{role}</div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">{ROLE_DESCRIPTIONS[role]}</div>
              </div>
              <Select
                value={settings[role]?.provider ?? ""}
                onChange={(event) => onChange(role, "provider", event.target.value)}
                className="w-[180px] shrink-0 text-xs px-2 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-[#1e2130] text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">Auto (Claude)</option>
                {builtinProviders.map((provider) => (
                  <option
                    key={provider.id}
                    value={provider.id}
                    disabled={provider.status !== "available"}
                  >
                    {provider.name}{provider.status === "available" ? "" : " (unavailable)"}
                  </option>
                ))}
              </Select>
              <input
                type="text"
                list={datalistId}
                value={settings[role]?.model ?? ""}
                onChange={(event) => onChange(role, "model", event.target.value)}
                placeholder={modelDefs.length > 0 ? "select alias or type model" : "e.g. claude-3-5-haiku"}
                className="flex-1 text-xs px-2 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-[#1e2130] text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono"
 />
            </div>
          ))}
        </div>
        <datalist id={datalistId}>
          {modelDefs.map((definition) => (
            <option key={definition.alias} value={definition.alias} label={`${definition.alias} → ${definition.modelName}`} />
          ))}
        </datalist>
        <p className="mt-4 text-[10px] text-slate-400 dark:text-slate-500">
          Leave model blank to use the provider default. Type a model alias from the{" "}
          <button onClick={onOpenModelsTab} className="text-blue-500 hover:underline">Models tab</button>
          {" "}to use custom connection details.
        </p>
      </div>
    </div>
  );
}

// ─── Provider Catalog Section ────────────────────────────────────────────────

interface ProviderCatalogSectionProps {
  allProviders: ProviderOption[];
}

function ProviderCatalogSection({ allProviders }: ProviderCatalogSectionProps) {
  const { t } = useTranslation();

  return (
    <div className={settingsCardCls}>
      <div>
        <p className={sectionHeadCls}>Provider Catalog</p>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-3">
          Built-in and registry providers are listed here.
        </p>
      </div>

      {allProviders.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500 italic">No providers available.</p>
      ) : (
        <div className="space-y-2">
          {allProviders.map((provider) => (
              <div
                key={provider.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e2130]"
 >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                        {provider.name}
                      </p>
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        {provider.source === "registry" ? t.settings.registry : t.settings.builtIn}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono truncate">
                      {provider.id}{provider.command ? ` · ${provider.command}` : ""}
                    </p>
                  </div>
                </div>
                <div className="ml-2 flex items-center gap-2 shrink-0">
                  {provider.status && (
                    <span
                      className={`px-2 py-0.5 text-[10px] rounded ${
 provider.status === "available"
 ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
 : provider.status === "checking"
 ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
 : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
 }`}
                    >
                      {provider.status}
                    </span>
                  )}
                </div>
              </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WebhooksTab() {
  const { t } = useTranslation();
  const [showFullPanel, setShowFullPanel] = useState(false);

  if (showFullPanel) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            GitHub Webhook Triggers
          </h3>
          <button
            onClick={() => setShowFullPanel(false)}
            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
 title={t.settings.backToOverview}
          >
            <ArrowLeft className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}/>
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <GitHubWebhookPanel />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
          GitHub Webhook Triggers
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          Automatically trigger agents (Claude Code, GLM-4, etc.) when GitHub events occur
          — issue created, PR opened, CI completed, and more.
        </p>
        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 px-3 py-2.5 mb-3">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            <span className="font-semibold">Webhook URL:</span>{" "}
            <code className="font-mono bg-blue-100 dark:bg-blue-900/30 px-1 rounded">
              {typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/github
            </code>
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            Point your GitHub repository webhook at this URL to start receiving events.
          </p>
        </div>
        <button
          onClick={() => setShowFullPanel(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium rounded-lg hover:bg-slate-700 dark:hover:bg-slate-300 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          Manage Webhook Triggers
        </button>
      </div>
    </div>
  );
}


// ─── Main Settings Panel ───────────────────────────────────────────────────
export function SettingsPanel({ open, onClose, providers, initialTab, onResetOnboarding, variant = "modal" }: SettingsPanelProps) {
  if (!open) return null;
  return <SettingsPanelContent onClose={onClose} providers={providers} initialTab={initialTab} onResetOnboarding={onResetOnboarding} variant={variant} />;
}

function SettingsPanelContent({ onClose, providers, initialTab, onResetOnboarding, variant = "modal" }: Omit<SettingsPanelProps, "open">) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<DefaultProviderSettings>(() => loadDefaultProviders());
  const [modelDefs, setModelDefs] = useState<ModelDefinition[]>(() => loadModelDefinitions());
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => initialTab ?? "providers");
  const isPageVariant = variant === "page";

  const handleChange = useCallback(
    (role: AgentRoleKey, field: "provider" | "model", value: string) => {
      const current: AgentModelConfig = settings[role] ?? {};
      const updated: AgentModelConfig = { ...current, [field]: value || undefined };
      const isEmpty = !updated.provider && !updated.model;
      const next: DefaultProviderSettings = { ...settings, [role]: isEmpty ? undefined : updated };
      setSettings(next);
      saveDefaultProviders(next);
    },
    [settings],
  );

  const builtinProviders = providers.filter((provider) => provider.source !== "registry");
  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    if (tab === "models") {
      setModelDefs(loadModelDefinitions());
    }
  };

  const TAB_DEFS: { key: SettingsTab; label: string }[] = [
    { key: "providers", label: t.settings.providers },
    { key: "registry", label: t.settings.registry },
    { key: "roles", label: t.settings.roles },
    { key: "models", label: t.settings.models },
    { key: "webhooks", label: t.settings.webhooks },
  ];

  const activeTabMeta = TAB_DEFS.find((tab) => tab.key === activeTab) ?? TAB_DEFS[0];

  const renderTabContent = () => (
    <div className="flex-1 min-h-0 overflow-hidden">
      {activeTab === "providers" && (
        <div className="px-4 py-4 space-y-4 overflow-y-auto h-full">
          <div className={settingsCardCls}>
            <p className={sectionHeadCls}>Providers</p>
            <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
              Manage detected ACP providers, install additional agents, hide noisy entries, and configure provider-specific credentials.
            </p>
          </div>

          <OnboardingSettingsSection onResetOnboarding={onResetOnboarding} />

          <ProviderCatalogSection allProviders={providers} />
        </div>
      )}
      {activeTab === "registry" && (
        <div className="px-4 py-4 overflow-y-auto h-full">
          <div className={settingsCardCls}>
            <div className="mb-3">
              <p className={sectionHeadCls}>{t.settings.registry}</p>
              <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                {t.settings.registryDesc}
              </p>
            </div>
            <AgentInstallPanel embedded={true} />
          </div>
        </div>
      )}
      {activeTab === "roles" && (
        <RolesTab
          settings={settings}
          modelDefs={modelDefs}
          builtinProviders={builtinProviders}
          onChange={handleChange}
          onOpenModelsTab={() => handleTabChange("models")}
        />
      )}
      {activeTab === "models" && <ModelsTab />}
      {activeTab === "webhooks" && <WebhooksTab />}
    </div>
  );

  if (isPageVariant) {
    return (
      <div className="flex h-full min-h-0 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-200">
        <SettingsCenterNav activeConfigTab={activeTab} />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-slate-300 dark:border-slate-700 px-8 py-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t.settings.preferences}</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-slate-200">{activeTabMeta.label}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-700 dark:text-slate-400">
              {activeTab === "providers" && t.settings.providersDesc}
              {activeTab === "registry" && t.settings.registryDesc}
              {activeTab === "roles" && t.settings.rolesDesc}
              {activeTab === "models" && t.settings.modelsDesc}
              {activeTab === "webhooks" && t.settings.webhooksDesc}
            </p>
          </header>

          {renderTabContent()}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative mx-4 flex h-full max-h-[92vh] w-[calc(100vw-2rem)] max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#1a1d2e]"
 style={{ height: SETTINGS_PANEL_HEIGHT }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}/>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t.settings.title}</h2>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeSwitcher showLabel />
            <button onClick={onClose}
              className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
              <X className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}/>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 shrink-0">
          {TAB_DEFS.map(({ key, label }) => (
            <button key={key} onClick={() => handleTabChange(key)}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
 activeTab === key
 ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
 : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
 }`}>
              {label}
            </button>
          ))}
        </div>

        {renderTabContent()}

        <SystemInfoFooter />

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex justify-end shrink-0">
          <button onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
