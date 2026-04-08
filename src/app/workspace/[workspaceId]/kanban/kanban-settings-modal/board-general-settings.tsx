"use client";

import type { KanbanDevSessionSupervisionInfo } from "../../types";
import { useTranslation } from "@/i18n";
import { SelectControl } from "./column-automation-editor";

export interface BoardGeneralSettingsProps {
  sessionConcurrencyLimit: number;
  devSessionSupervision: KanbanDevSessionSupervisionInfo;
  onSessionConcurrencyLimitChange: (limit: number) => void;
  onDevSessionSupervisionChange: (supervision: KanbanDevSessionSupervisionInfo) => void;
}

export function BoardGeneralSettings({
  sessionConcurrencyLimit,
  devSessionSupervision,
  onSessionConcurrencyLimitChange,
  onDevSessionSupervisionChange,
}: BoardGeneralSettingsProps) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-2.5 dark:border-slate-800 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
          Session queue
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">{t.kanban.maxLabel}</span>
            <input
              type="number"
              min={1}
              max={20}
              value={sessionConcurrencyLimit}
              onChange={(event) => onSessionConcurrencyLimitChange(Math.max(1, Number.parseInt(event.target.value || "1", 10) || 1))}
              className="h-9 w-18 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-400 dark:border-slate-700 dark:bg-[#0b1119] dark:text-slate-100"
            />
          </label>
        </div>
        <p className="mt-1.5 max-w-[240px] text-xs leading-5 text-slate-500 dark:text-slate-400">
          {t.kanban.extraCardsWait}
        </p>
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
          Dev supervision
        </div>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span>{t.kanban.mode}</span>
            <SelectControl
              aria-label="Dev supervision mode"
              value={devSessionSupervision.mode}
              onChange={(event) => onDevSessionSupervisionChange({
                ...devSessionSupervision,
                mode: event.target.value as KanbanDevSessionSupervisionInfo["mode"],
              })}
            >
              <option value="disabled">{t.kanban.off}</option>
              <option value="watchdog_retry">{t.kanban.watchdogRetry}</option>
              <option value="ralph_loop">{t.kanban.ralphLoop}</option>
            </SelectControl>
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span>{t.kanban.idleMin}</span>
            <input
              aria-label="Dev supervision idle timeout"
              type="number"
              min={1}
              max={120}
              value={devSessionSupervision.inactivityTimeoutMinutes}
              onChange={(event) => onDevSessionSupervisionChange({
                ...devSessionSupervision,
                inactivityTimeoutMinutes: Math.max(1, Number.parseInt(event.target.value || "10", 10) || 10),
              })}
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 dark:border-slate-700 dark:bg-[#0b1119] dark:text-slate-100"
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span>{t.kanban.retries}</span>
            <input
              aria-label="Dev supervision max recovery attempts"
              type="number"
              min={0}
              max={10}
              value={devSessionSupervision.maxRecoveryAttempts}
              onChange={(event) => onDevSessionSupervisionChange({
                ...devSessionSupervision,
                maxRecoveryAttempts: Math.max(0, Number.parseInt(event.target.value || "0", 10) || 0),
              })}
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 dark:border-slate-700 dark:bg-[#0b1119] dark:text-slate-100"
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span>{t.kanban.completion}</span>
            <SelectControl
              aria-label="Dev supervision completion requirement"
              value={devSessionSupervision.completionRequirement}
              onChange={(event) => onDevSessionSupervisionChange({
                ...devSessionSupervision,
                completionRequirement: event.target.value as KanbanDevSessionSupervisionInfo["completionRequirement"],
              })}
              disabled={devSessionSupervision.mode !== "ralph_loop"}
              className="disabled:cursor-not-allowed"
            >
              <option value="turn_complete">{t.kanban.turnComplete}</option>
              <option value="completion_summary">{t.kanban.completionSummary}</option>
              <option value="verification_report">{t.kanban.verificationReport}</option>
            </SelectControl>
          </label>
        </div>
      </div>
    </div>
  );
}
