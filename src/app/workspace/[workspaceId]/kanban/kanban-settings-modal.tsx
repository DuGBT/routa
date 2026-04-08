"use client";

import { useEffect, useMemo, useState } from "react";
import type { AcpProviderInfo } from "@/client/acp-client";
import { desktopAwareFetch } from "@/client/utils/diagnostics";
import { resolveKanbanAutomationStep } from "@/core/kanban/effective-task-automation";
import {
  resolveSpecialistSelection,
  type KanbanSpecialistLanguage,
} from "./kanban-specialist-language";
import {
  getSpecialistCategory,
  type SpecialistCategory,
} from "@/client/utils/specialist-categories";
import type { KanbanBoardInfo, KanbanDevSessionSupervisionInfo } from "../types";
import { useTranslation } from "@/i18n";
import {
  type ColumnAutomationConfig,
  ColumnAutomationWorkspace,
  SelectControl,
  isManualOnlyColumn,
  updateAutomationSteps,
  getDefaultAutomationForStage,
  syncAutomationPrimaryStep,
  getEditableAutomationSteps,
} from "./kanban-settings-modal/column-automation-editor";
import { BoardGeneralSettings } from "./kanban-settings-modal/board-general-settings";
import {
  loadKanbanExportWorkspaceId,
  StatPill,
  SectionCard,
  BoardGitHubSettings,
} from "./kanban-settings-modal/board-github-settings";
import type { KanbanAutomationStep } from "@/core/models/kanban";

// Re-export ColumnAutomationConfig for consumers
export type { ColumnAutomationConfig } from "./kanban-settings-modal/column-automation-editor";

interface SpecialistOption {
  id: string;
  name: string;
  role: string;
  displayName?: string;
  defaultProvider?: string;
}

export interface KanbanSettingsModalProps {
  board: KanbanBoardInfo;
  columnAutomation: Record<string, ColumnAutomationConfig>;
  availableProviders: AcpProviderInfo[];
  specialists: SpecialistOption[];
  specialistLanguage: KanbanSpecialistLanguage;
  onClose: () => void;
  onClearAll: () => Promise<void>;
  onSave: (
    columns: KanbanBoardInfo["columns"],
    columnAutomation: Record<string, ColumnAutomationConfig>,
    sessionConcurrencyLimit: number,
    devSessionSupervision: KanbanDevSessionSupervisionInfo,
  ) => Promise<void>;
}

const DEFAULT_DEV_SESSION_SUPERVISION: KanbanDevSessionSupervisionInfo = {
  mode: "watchdog_retry",
  inactivityTimeoutMinutes: 10,
  maxRecoveryAttempts: 1,
  completionRequirement: "turn_complete",
};

const STAGE_TYPE_OPTIONS = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "Todo" },
  { value: "dev", label: "Dev" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
  { value: "blocked", label: "Blocked" },
] as const;

// --- Helper functions for sidebar column list ---

function getColumnWorkflowMode(
  column: KanbanBoardInfo["columns"][0],
  automation: ColumnAutomationConfig | undefined,
): "manual" | "automated" {
  if (isManualOnlyColumn(column)) return "manual";
  return automation?.enabled ? "automated" : "manual";
}

function getAutomationTransportLabel(
  column: KanbanBoardInfo["columns"][0],
  automation: ColumnAutomationConfig | undefined,
): string {
  if (getColumnWorkflowMode(column, automation) === "manual") return "Manual";
  return "ACP";
}

function formatTriggerLabel(trigger: ColumnAutomationConfig["transitionType"]): string {
  if (trigger === "exit") return "On exit";
  if (trigger === "both") return "Entry and exit";
  return "On entry";
}

function resolveProviderName(providerId: string | undefined, providers: AcpProviderInfo[]): string | undefined {
  if (!providerId) return undefined;
  return providers.find((provider) => provider.id === providerId)?.name ?? providerId;
}

function formatAutoProviderLabel(providerId: string | undefined, providers: AcpProviderInfo[], autoLabel: string): string {
  const providerName = resolveProviderName(providerId, providers);
  return providerName ? `${autoLabel} (${providerName})` : autoLabel;
}

function formatAutomationStepSummary(
  step: KanbanAutomationStep,
  index: number,
  providers: AcpProviderInfo[],
  specialists: SpecialistOption[],
  autoProviderId: string | undefined,
  autoLabel: string,
): string {
  const resolveSpecialist = (specialistId: string) => {
    const specialist = specialists.find((s) => s.id === specialistId);
    if (!specialist) return undefined;
    return { name: specialist.name, role: specialist.role, defaultProvider: specialist.defaultProvider };
  };
  const resolvedStep = resolveKanbanAutomationStep(step, resolveSpecialist, { autoProviderId });
  if (!resolvedStep) return `Step ${index + 1}`;
  if (step.transport === "a2a") {
    return [`A2A`, resolvedStep.role ?? `Step ${index + 1}`].filter(Boolean).join(" \u2022 ");
  }
  const provider = step.providerId
    ? resolveProviderName(resolvedStep.providerId, providers) ?? autoLabel
    : resolvedStep.providerSource === "auto"
      ? formatAutoProviderLabel(resolvedStep.providerId, providers, autoLabel)
      : resolveProviderName(resolvedStep.providerId, providers) ?? autoLabel;
  return [provider, resolvedStep.role ?? `Step ${index + 1}`].filter(Boolean).join(" \u2022 ");
}

function getAutomationSummary(
  automation: ColumnAutomationConfig,
  providers: AcpProviderInfo[],
  specialists: SpecialistOption[],
  autoProviderId: string | undefined,
  autoLabel: string,
): string {
  const steps = getEditableAutomationSteps(automation);
  return [
    steps.map((step: KanbanAutomationStep, index: number) => formatAutomationStepSummary(step, index, providers, specialists, autoProviderId, autoLabel)).join(" -> "),
    formatTriggerLabel(automation.transitionType),
  ].join(" \u2022 ");
}

function getColumnWorkflowSummary(
  column: KanbanBoardInfo["columns"][0],
  automation: ColumnAutomationConfig | undefined,
  providers: AcpProviderInfo[],
  specialists: SpecialistOption[],
  autoProviderId: string | undefined,
  autoLabel: string,
): string {
  const mode = getColumnWorkflowMode(column, automation);
  if (mode === "manual") {
    return isManualOnlyColumn(column) ? "Manual lane only" : "Manual lane";
  }
  return getAutomationSummary(
    automation ?? { enabled: false },
    providers,
    specialists,
    autoProviderId,
    autoLabel,
  );
}

export function KanbanSettingsModal({
  board,
  columnAutomation: initialColumnAutomation,
  availableProviders,
  specialists,
  specialistLanguage,
  onClose,
  onClearAll,
  onSave,
}: KanbanSettingsModalProps) {
  const { t } = useTranslation();
  const initialEditableColumns = useMemo(
    () => board.columns.slice().sort((a, b) => a.position - b.position).map((column) => ({ ...column, visible: column.visible !== false })),
    [board.columns],
  );
  const [editableColumns, setEditableColumns] = useState<KanbanBoardInfo["columns"]>(initialEditableColumns);
  const [columnAutomation, setColumnAutomation] = useState<Record<string, ColumnAutomationConfig>>(initialColumnAutomation);
  const [sessionConcurrencyLimit, setSessionConcurrencyLimit] = useState<number>(board.sessionConcurrencyLimit ?? 1);
  const [devSessionSupervision, setDevSessionSupervision] = useState<KanbanDevSessionSupervisionInfo>(
    board.devSessionSupervision ?? DEFAULT_DEV_SESSION_SUPERVISION,
  );
  const [selectedColumnId, setSelectedColumnId] = useState<string>(board.columns[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [showRuntimeSettings, setShowRuntimeSettings] = useState(true);
  const [specialistCategory, setSpecialistCategory] = useState<SpecialistCategory>("kanban");
  const [kanbanExportWorkspaceId, setKanbanExportWorkspaceId] = useState<string>(() =>
    loadKanbanExportWorkspaceId(board.workspaceId || "default"),
  );
  const [isExportingKanbanYaml, setIsExportingKanbanYaml] = useState(false);
  const [isImportingKanbanYaml, setIsImportingKanbanYaml] = useState(false);
  const [kanbanYamlError, setKanbanYamlError] = useState("");
  const [kanbanYamlResult, setKanbanYamlResult] = useState("");

  const sortedColumns = useMemo(() => editableColumns.slice().sort((a, b) => a.position - b.position), [editableColumns]);

  useEffect(() => {
    if (sortedColumns.length === 0) return;
    if (!sortedColumns.some((column) => column.id === selectedColumnId)) {
      setSelectedColumnId(sortedColumns[0].id);
    }
  }, [selectedColumnId, sortedColumns]);

  useEffect(() => { setEditableColumns(initialEditableColumns); }, [initialEditableColumns]);

  useEffect(() => { setKanbanExportWorkspaceId((current) => current || board.workspaceId || "default"); }, [board.workspaceId]);

  useEffect(() => {
    setColumnAutomation((current) => Object.fromEntries(
      Object.entries(current).map(([columnId, automation]) => [
        columnId,
        updateAutomationSteps(automation, (steps) => steps.map((step) => {
          const resolved = resolveSpecialistSelection(step.specialistId, step.specialistName, specialists, specialistLanguage);
          return { ...step, specialistId: resolved.specialistId, specialistName: resolved.specialistName, specialistLocale: resolved.specialistId ? specialistLanguage : undefined };
        })),
      ]),
    ));
  }, [specialistLanguage, specialists]);

  const selectedColumn = sortedColumns.find((column) => column.id === selectedColumnId) ?? sortedColumns[0] ?? null;
  const automationEnabledCount = sortedColumns.filter((column) => columnAutomation[column.id]?.enabled).length;
  const visibleColumnCount = sortedColumns.filter((column) => column.visible !== false).length;

  useEffect(() => {
    const selectedSpecialistId = selectedColumn
      ? getEditableAutomationSteps(columnAutomation[selectedColumn.id] ?? { enabled: false })[0]?.specialistId
      : undefined;
    if (!selectedSpecialistId) return;
    setSpecialistCategory(getSpecialistCategory(selectedSpecialistId));
  }, [columnAutomation, selectedColumn]);

  const toggleColumnAutomation = (column: KanbanBoardInfo["columns"][0], enabled: boolean) => {
    if (enabled && isManualOnlyColumn(column)) return;
    setColumnAutomation((current) => {
      if (!enabled) return { ...current, [column.id]: { ...(current[column.id] ?? { enabled: false }), enabled: false } };
      const defaultAutomation = getDefaultAutomationForStage(column.stage);
      const existing = current[column.id];
      return { ...current, [column.id]: syncAutomationPrimaryStep({ ...defaultAutomation, ...existing, enabled: true, steps: existing?.steps?.length ? existing.steps : defaultAutomation.steps, requiredArtifacts: existing?.requiredArtifacts ?? defaultAutomation.requiredArtifacts, requiredTaskFields: existing?.requiredTaskFields ?? defaultAutomation.requiredTaskFields, autoAdvanceOnSuccess: existing?.autoAdvanceOnSuccess ?? defaultAutomation.autoAdvanceOnSuccess, transitionType: existing?.transitionType ?? defaultAutomation.transitionType }) };
    });
  };

  const updateColumnVisibility = (column: KanbanBoardInfo["columns"][0], visible: boolean) => {
    setEditableColumns((current) => {
      if (!visible) {
        const currentlyVisible = current.filter((item) => item.visible !== false);
        if (currentlyVisible.length <= 1 && currentlyVisible.some((item) => item.id === column.id)) return current;
      }
      return current.map((item) => item.id === column.id ? { ...item, visible } : item);
    });
  };

  const moveColumn = (columnId: string, direction: "up" | "down") => {
    setEditableColumns((current) => {
      const ordered = current.slice().sort((a, b) => a.position - b.position);
      const index = ordered.findIndex((column) => column.id === columnId);
      if (index === -1) return current;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= ordered.length) return current;
      const next = [...ordered];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next.map((column, position) => ({ ...column, position }));
    });
  };

  const updateColumn = (columnId: string, updater: (column: KanbanBoardInfo["columns"][0]) => KanbanBoardInfo["columns"][0]) => {
    setEditableColumns((current) => current.map((column) => column.id === columnId ? updater(column) : column));
  };

  const updateColumnAutomation = (columnId: string, automation: ColumnAutomationConfig) => {
    setColumnAutomation((current) => ({ ...current, [columnId]: automation }));
  };

  const handleDeleteStage = (columnId: string) => {
    setEditableColumns((current) => {
      if (current.length <= 1) return current;
      const remaining = current.filter((column) => column.id !== columnId).sort((a, b) => a.position - b.position).map((column, position) => ({ ...column, position }));
      const nextSelected = remaining[0]?.id ?? "";
      if (selectedColumnId === columnId) setSelectedColumnId(nextSelected);
      return remaining;
    });
    setColumnAutomation((current) => { const next = { ...current }; delete next[columnId]; return next; });
  };

  const handleAddStage = () => {
    let nextId = "";
    setEditableColumns((current) => {
      const nextIndex = current.length + 1;
      let id = `stage-${nextIndex}`;
      let suffix = nextIndex;
      const existingIds = new Set(current.map((column) => column.id));
      while (existingIds.has(id)) { suffix += 1; id = `stage-${suffix}`; }
      nextId = id;
      return [...current, { id, name: `Stage ${suffix}`, stage: "todo", position: current.length, visible: true }];
    });
    if (nextId) setSelectedColumnId(nextId);
  };

  const handleStageTypeChange = (columnId: string, stage: string) => {
    updateColumn(columnId, (column) => ({ ...column, stage }));
    if (stage === "blocked") {
      setColumnAutomation((current) => ({ ...current, [columnId]: { ...(current[columnId] ?? { enabled: false }), enabled: false } }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const sanitizedColumnAutomation = Object.fromEntries(
        sortedColumns.map((column) => {
          const current = columnAutomation[column.id] ?? { enabled: false };
          return [column.id, isManualOnlyColumn(column) ? { ...current, enabled: false } : current];
        }),
      );
      const sanitizedColumns = sortedColumns.map((column) => ({ ...column, visible: column.visible !== false }));
      await onSave(sanitizedColumns, sanitizedColumnAutomation, Math.max(1, Math.floor(sessionConcurrencyLimit)), {
        ...devSessionSupervision,
        inactivityTimeoutMinutes: Math.max(1, Math.floor(devSessionSupervision.inactivityTimeoutMinutes)),
        maxRecoveryAttempts: Math.max(0, Math.floor(devSessionSupervision.maxRecoveryAttempts)),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm(t.kanban.clearAllConfirm)) return;
    setClearingAll(true);
    try { await onClearAll(); } finally { setClearingAll(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative flex h-full w-full items-center justify-center p-2 sm:p-4">
        <div className="relative flex h-[96vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-[22px] border border-white/10 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.32)] dark:bg-[#0d1118]">
          <div className="relative overflow-hidden border-b border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.12),_transparent_28%),linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.96))] px-3.5 py-2.5 dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.1),_transparent_24%),linear-gradient(135deg,_rgba(15,23,42,0.96),_rgba(13,17,24,0.98))] sm:px-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center rounded-full border border-amber-300/70 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">Kanban</div>
                  <h2 className="truncate text-base font-semibold tracking-tight text-slate-900 dark:text-white sm:text-lg">{board.name}</h2>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatPill label={t.kanban.visible} value={`${visibleColumnCount}/${sortedColumns.length}`} tone="amber" />
                <StatPill label={t.kanban.automation} value={String(automationEnabledCount)} tone="emerald" />
                <StatPill label={t.kanban.queue} value={`Max ${sessionConcurrencyLimit}`} tone="slate" />
                <button type="button" onClick={() => setShowRuntimeSettings((current) => !current)} className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 transition hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-[#111722]">
                  {showRuntimeSettings ? t.kanban.hideRuntime : t.kanban.runtime}
                </button>
              </div>
            </div>
            {showRuntimeSettings ? (
              <div className="mt-2 rounded-lg border border-slate-200/80 bg-white/90 p-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/40">
                <BoardGeneralSettings
                  sessionConcurrencyLimit={sessionConcurrencyLimit}
                  devSessionSupervision={devSessionSupervision}
                  onSessionConcurrencyLimitChange={setSessionConcurrencyLimit}
                  onDevSessionSupervisionChange={setDevSessionSupervision}
                />
              </div>
            ) : null}
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[304px_minmax(0,1fr)]">
            <aside className="min-h-0 overflow-y-auto overflow-x-hidden border-b border-slate-200/80 bg-slate-50/40 p-2 dark:border-slate-800 dark:bg-[#0a0f16] lg:border-b-0 lg:border-r lg:p-2.5">
              <div className="space-y-2.5">
                <SectionCard eyebrow={t.kanban.stageMap} title={t.kanban.stages} description="">
                  <div className="mb-2 flex items-center justify-end">
                    <button type="button" onClick={handleAddStage} className="rounded-md border border-slate-300 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700 transition hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-[#111722]">{t.kanban.addStage}</button>
                  </div>
                  <div className="space-y-1">
                    {sortedColumns.map((column) => {
                      const automation = columnAutomation[column.id] ?? { enabled: false };
                      const active = selectedColumnId === column.id;
                      const visible = column.visible !== false;
                      return (
                        <div key={column.id} className={`min-w-0 rounded-[10px] border px-2 py-1 transition ${active ? "border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/10 dark:border-amber-400/40 dark:bg-slate-900" : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-[#111722] dark:hover:border-slate-700"}`}>
                          <button type="button" onClick={() => setSelectedColumnId(column.id)} className="block w-full min-w-0 text-left">
                            <div className="flex min-w-0 items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className={`text-[12px] font-semibold ${active ? "text-white" : "text-slate-900 dark:text-slate-100"}`}>{column.name}</div>
                                <div className={`mt-0.5 truncate text-[10px] leading-4 ${active ? "text-slate-300" : "text-slate-500 dark:text-slate-400"}`}>
                                  {column.id} · {getColumnWorkflowSummary(column, automation, availableProviders, specialists, board.autoProviderId, t.common.auto)}
                                </div>
                              </div>
                              <div className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] ${active ? "bg-white/10 text-slate-200" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>
                                {getAutomationTransportLabel(column, automation)}
                              </div>
                            </div>
                          </button>
                          <div className={`mt-1 flex items-center justify-between rounded-md border px-2 py-0.5 ${active ? "border-white/15 bg-white/5" : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-[#0b1119]"}`}>
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-1.5">
                                <span className={`text-[9px] font-semibold uppercase tracking-[0.16em] ${active ? "text-slate-300" : "text-slate-500 dark:text-slate-400"}`}>{t.kanban.visible}</span>
                                <input type="checkbox" aria-label={`Toggle visibility for ${column.name}`} checked={visible} onChange={(event) => updateColumnVisibility(column, event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500" />
                              </label>
                              <label className="flex items-center gap-1.5">
                                <span className={`text-[9px] font-semibold uppercase tracking-[0.16em] ${active ? "text-slate-300" : "text-slate-500 dark:text-slate-400"}`}>{t.kanban.automation}</span>
                                <input type="checkbox" aria-label={`Toggle automation for ${column.name}`} checked={getColumnWorkflowMode(column, automation) === "automated"} disabled={isManualOnlyColumn(column)} onChange={(event) => toggleColumnAutomation(column, event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500" />
                              </label>
                            </div>
                            <div className="flex items-center gap-1">
                              <button type="button" aria-label={`Move ${column.name} up`} disabled={sortedColumns[0]?.id === column.id} onClick={() => moveColumn(column.id, "up")} className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400">Up</button>
                              <button type="button" aria-label={`Move ${column.name} down`} disabled={sortedColumns[sortedColumns.length - 1]?.id === column.id} onClick={() => moveColumn(column.id, "down")} className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400">Down</button>
                              <button type="button" aria-label={`Delete ${column.name}`} disabled={sortedColumns.length <= 1} onClick={() => handleDeleteStage(column.id)} className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-500 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-rose-300 dark:hover:bg-rose-500/10">{t.kanban.del}</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>
              </div>
            </aside>

            <main className="min-h-0 overflow-y-auto bg-white p-2 dark:bg-[#0d1118] sm:p-2.5 xl:p-3">
              {selectedColumn ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 pb-3 dark:border-slate-800 xl:flex-nowrap">
                    <div className="shrink-0 pb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400 xl:w-24">Structure</div>
                    <label className="w-[14rem] shrink-0 space-y-1 text-sm font-medium">
                      <span className="text-slate-700 dark:text-slate-300">{t.kanban.name}</span>
                      <input aria-label="Stage name" type="text" value={selectedColumn.name} onChange={(event) => updateColumn(selectedColumn.id, (current) => ({ ...current, name: event.target.value }))} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 dark:border-slate-700 dark:bg-[#0b1119] dark:text-slate-100" />
                    </label>
                    <label className="w-40 shrink-0 space-y-1 text-sm font-medium">
                      <span className="text-slate-700 dark:text-slate-300">{t.kanban.stageType}</span>
                      <SelectControl aria-label="Stage type" value={selectedColumn.stage} onChange={(event) => handleStageTypeChange(selectedColumn.id, event.target.value)} className="h-10">
                        {STAGE_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </SelectControl>
                    </label>
                    <label className="w-40 shrink-0 space-y-1 text-sm font-medium">
                      <span className="text-slate-700 dark:text-slate-300">{t.kanban.columnWidth}</span>
                      <SelectControl aria-label="Column width" value={selectedColumn.width || "standard"} onChange={(event) => updateColumn(selectedColumn.id, (current) => ({ ...current, width: event.target.value as "compact" | "standard" | "wide" }))} className="h-10">
                        <option value="compact">{t.kanban.compact}</option>
                        <option value="standard">{t.kanban.standard}</option>
                        <option value="wide">{t.kanban.wide}</option>
                      </SelectControl>
                    </label>
                    <label className="flex h-10 items-center gap-2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-[#0b1119] dark:text-slate-300">
                      <input type="checkbox" checked={selectedColumn.visible !== false} onChange={(event) => updateColumnVisibility(selectedColumn, event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500" />
                      <span>{t.kanban.visibleOnBoard}</span>
                    </label>
                    {selectedColumn.stage === "blocked" ? (
                      <div className="flex h-10 items-center rounded-md border border-amber-200 bg-amber-50 px-3 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400 xl:ml-auto">{t.kanban.manualLaneOnly}</div>
                    ) : null}
                  </div>
                  <div className="space-y-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{t.kanban.automation}</div>
                    <ColumnAutomationWorkspace
                      column={selectedColumn}
                      automation={columnAutomation[selectedColumn.id] ?? { enabled: false }}
                      availableProviders={availableProviders}
                      specialists={specialists}
                      specialistCategory={specialistCategory}
                      specialistLanguage={specialistLanguage}
                      onSpecialistCategoryChange={setSpecialistCategory}
                      onUpdate={(updated) => updateColumnAutomation(selectedColumn.id, updated)}
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">{t.kanban.noColumnsAvailable}</div>
              )}
            </main>
          </div>

          <div className="border-t border-slate-200/80 bg-slate-50/80 px-4 py-2.5 dark:border-slate-800 dark:bg-[#0a0f16] sm:px-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 flex-1 space-y-1">
                <BoardGitHubSettings
                  boardWorkspaceId={board.workspaceId}
                  kanbanExportWorkspaceId={kanbanExportWorkspaceId}
                  onKanbanExportWorkspaceIdChange={setKanbanExportWorkspaceId}
                  isExportingKanbanYaml={isExportingKanbanYaml}
                  isImportingKanbanYaml={isImportingKanbanYaml}
                  kanbanYamlError={kanbanYamlError}
                  kanbanYamlResult={kanbanYamlResult}
                  onSetIsExportingKanbanYaml={setIsExportingKanbanYaml}
                  onSetIsImportingKanbanYaml={setIsImportingKanbanYaml}
                  onSetKanbanYamlError={setKanbanYamlError}
                  onSetKanbanYamlResult={setKanbanYamlResult}
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => void handleClearAll()} disabled={saving || clearingAll} className="mr-auto rounded-xl border border-rose-200 px-4 py-1.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10">{clearingAll ? t.kanban.clearingAll : t.kanban.clearAllCards}</button>
                <button onClick={onClose} disabled={saving || clearingAll} className="rounded-xl border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-white disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-[#111722]">{t.kanban.cancel}</button>
                <button onClick={() => void handleSave()} disabled={saving || clearingAll} className="rounded-xl bg-slate-900 px-5 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400">{saving ? t.workspace.saving : t.kanban.saveBoardSettings}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
