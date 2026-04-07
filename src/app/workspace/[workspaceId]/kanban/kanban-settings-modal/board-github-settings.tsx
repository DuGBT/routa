"use client";

import { type ReactNode, useRef } from "react";
import { desktopAwareFetch } from "@/client/utils/diagnostics";
import { useTranslation } from "@/i18n";

const KANBAN_EXPORT_WORKSPACE_KEY = "routa.kanbanExportWorkspaceId";

export function loadKanbanExportWorkspaceId(defaultWorkspaceId: string): string {
  if (typeof window === "undefined") return defaultWorkspaceId;
  try {
    return localStorage.getItem(KANBAN_EXPORT_WORKSPACE_KEY)?.trim() || defaultWorkspaceId;
  } catch {
    return defaultWorkspaceId;
  }
}

export function saveKanbanExportWorkspaceId(workspaceId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KANBAN_EXPORT_WORKSPACE_KEY, workspaceId);
}

export interface BoardGitHubSettingsProps {
  boardWorkspaceId: string;
  kanbanExportWorkspaceId: string;
  onKanbanExportWorkspaceIdChange: (value: string) => void;
  isExportingKanbanYaml: boolean;
  isImportingKanbanYaml: boolean;
  kanbanYamlError: string;
  kanbanYamlResult: string;
  onSetIsExportingKanbanYaml: (v: boolean) => void;
  onSetIsImportingKanbanYaml: (v: boolean) => void;
  onSetKanbanYamlError: (v: string) => void;
  onSetKanbanYamlResult: (v: string) => void;
}

export function BoardGitHubSettings({
  boardWorkspaceId,
  kanbanExportWorkspaceId,
  onKanbanExportWorkspaceIdChange,
  isExportingKanbanYaml,
  isImportingKanbanYaml,
  kanbanYamlError,
  kanbanYamlResult,
  onSetIsExportingKanbanYaml,
  onSetIsImportingKanbanYaml,
  onSetKanbanYamlError,
  onSetKanbanYamlResult,
}: BoardGitHubSettingsProps) {
  const { t } = useTranslation();
  const kanbanImportInputRef = useRef<HTMLInputElement>(null);

  const handleKanbanExportWorkspaceChange = (value: string) => {
    onKanbanExportWorkspaceIdChange(value);
    saveKanbanExportWorkspaceId(value.trim() || boardWorkspaceId || "default");
  };

  const handleExportKanbanYaml = async () => {
    const workspaceId = kanbanExportWorkspaceId.trim() || boardWorkspaceId || "default";
    onSetKanbanYamlError("");
    onSetKanbanYamlResult("");
    onSetIsExportingKanbanYaml(true);
    try {
      saveKanbanExportWorkspaceId(workspaceId);
      const response = await desktopAwareFetch(`/api/kanban/export?workspaceId=${encodeURIComponent(workspaceId)}`, { method: "GET" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || t.kanban.exportFailed);
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `kanban-${workspaceId.replace(/[^a-zA-Z0-9_-]+/g, "-") || "default"}.yaml`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(downloadUrl);
      onSetKanbanYamlResult(`Exported Kanban YAML for workspace ${workspaceId}.`);
    } catch (error) {
      onSetKanbanYamlError(error instanceof Error ? error.message : t.kanban.exportFailed);
    } finally {
      onSetIsExportingKanbanYaml(false);
    }
  };

  const handleImportKanbanYaml = async (file: File) => {
    const workspaceId = kanbanExportWorkspaceId.trim() || boardWorkspaceId || "default";
    onSetKanbanYamlError("");
    onSetKanbanYamlResult("");
    onSetIsImportingKanbanYaml(true);
    try {
      const yamlContent = await file.text();
      const response = await desktopAwareFetch("/api/kanban/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yamlContent, workspaceId }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || t.kanban.importFailed);
      onSetKanbanYamlResult(`Imported ${payload?.importedBoards ?? 0} board(s) into workspace ${payload?.workspaceId ?? workspaceId}.`);
    } catch (error) {
      onSetKanbanYamlError(error instanceof Error ? error.message : t.kanban.importFailed);
    } finally {
      if (kanbanImportInputRef.current) kanbanImportInputRef.current.value = "";
      onSetIsImportingKanbanYaml(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
        <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap lg:shrink-0">
          <input
            type="text"
            value={kanbanExportWorkspaceId}
            onChange={(event) => handleKanbanExportWorkspaceChange(event.target.value)}
            placeholder={boardWorkspaceId || "default"}
            className="h-8 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 dark:border-slate-700 dark:bg-[#0b1119] dark:text-slate-100 sm:w-32"
            aria-label="Kanban YAML workspace ID"
          />
          <button type="button" onClick={() => void handleExportKanbanYaml()} disabled={isExportingKanbanYaml} className="rounded-md border border-slate-300 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700 transition hover:bg-white disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-[#111722]">
            {isExportingKanbanYaml ? t.kanban.exportingYaml : t.kanban.exportYaml}
          </button>
          <input
            ref={kanbanImportInputRef}
            type="file"
            accept=".yaml,.yml,text/yaml,application/yaml"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImportKanbanYaml(file);
            }}
          />
          <button type="button" onClick={() => kanbanImportInputRef.current?.click()} disabled={isImportingKanbanYaml} className="rounded-md border border-slate-300 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700 transition hover:bg-white disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-[#111722]">
            {isImportingKanbanYaml ? t.kanban.importingYaml : t.kanban.importYaml}
          </button>
        </div>
        <div className="hidden h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-700 lg:block" aria-hidden="true" />
        <p className="min-w-0 text-xs leading-5 text-slate-500 dark:text-slate-400 lg:flex-1 lg:truncate">
          {t.kanban.changesApplyHint}
        </p>
      </div>
      {kanbanYamlError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
          {kanbanYamlError}
        </div>
      ) : null}
      {kanbanYamlResult ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300">
          {kanbanYamlResult}
        </div>
      ) : null}
    </>
  );
}

// Shared UI components for the settings modal

export function StatPill({ label, value, tone }: { label: string; value: string; tone: "amber" | "slate" | "emerald" }) {
  const toneClass = {
    amber: "border-amber-300/80 bg-amber-50/80 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
    slate: "border-slate-200 bg-slate-50/90 text-slate-700 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200",
    emerald: "border-emerald-300/80 bg-emerald-50/80 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
  }[tone];
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${toneClass}`}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-80">{label}</span>
      <span className="text-[13px] font-semibold tracking-tight">{value}</span>
    </div>
  );
}

export function SectionCard({ eyebrow, title, description, children }: { eyebrow: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section className="border-b border-slate-200/80 pb-2.5 last:border-b-0 dark:border-slate-800">
      <div className="mb-1.5 space-y-0.5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">{eyebrow}</div>
        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h4>
        {description ? <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
