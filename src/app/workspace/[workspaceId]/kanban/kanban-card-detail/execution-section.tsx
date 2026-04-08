"use client";

import { useMemo } from "react";
import type { AcpProviderInfo } from "@/client/acp-client";
import { Select } from "@/client/components/select";
import {
  type EffectiveTaskAutomation,
  resolveEffectiveTaskAutomation,
  resolveKanbanAutomationStep,
} from "@/core/kanban/effective-task-automation";
import { formatArtifactSummary, resolveKanbanTransitionArtifacts } from "@/core/kanban/transition-artifacts";
import { getKanbanAutomationSteps, type KanbanAutomationStep } from "@/core/models/kanban";
import type { KanbanColumnInfo, SessionInfo, TaskInfo } from "../../types";
import { createKanbanSpecialistResolver, getOrderedSessionIds, getSpecialistName, type KanbanSpecialistOption } from "../kanban-card-session-utils";
import { getKanbanSessionCopy } from "../i18n/kanban-session-copy";
import {
  findSpecialistById,
  getSpecialistDisplayName,
  getLanguageSpecificSpecialistId,
  KANBAN_SPECIALIST_LANGUAGE_LABELS,
  type KanbanSpecialistLanguage,
} from "../kanban-specialist-language";
import { useTranslation } from "@/i18n";
import { DetailSection, InlineSummary } from "./shared";

const ROLE_OPTIONS = ["CRAFTER", "ROUTA", "GATE", "DEVELOPER"];

function getProviderName(providerId: string | undefined, availableProviders: AcpProviderInfo[]): string {
  if (!providerId) return "Workspace default";
  return availableProviders.find((provider) => provider.id === providerId)?.name ?? providerId;
}

function formatAgentCardTarget(agentCardUrl?: string): string | undefined {
  const trimmed = agentCardUrl?.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    return `${parsed.hostname}${parsed.pathname !== "/" ? parsed.pathname : ""}`;
  } catch {
    return trimmed.replace(/^https?:\/\//, "");
  }
}

function formatEffectiveAutomationTarget(
  automation: EffectiveTaskAutomation,
  availableProviders: AcpProviderInfo[],
  specialists: KanbanSpecialistOption[],
): string {
  if (automation.transport === "a2a") {
    const specialist = getSpecialistName(
      automation.specialistId,
      automation.specialistName,
      specialists,
    );
    return [
      "A2A",
      automation.role ?? "DEVELOPER",
      specialist,
      formatAgentCardTarget(automation.agentCardUrl),
      automation.skillId ? `skill:${automation.skillId}` : undefined,
    ].filter(Boolean).join(" · ");
  }
  return [
    getProviderName(automation.providerId, availableProviders),
    automation.role ?? "DEVELOPER",
    getSpecialistName(automation.specialistId, automation.specialistName, specialists),
  ].join(" · ");
}

function getPromptFailureMessage(task: TaskInfo, sessionInfo: SessionInfo | null | undefined): string | null {
  if (sessionInfo?.acpStatus === "error" && sessionInfo.acpError) {
    return sessionInfo.acpError;
  }
  return task.lastSyncError ?? null;
}

function isExpiredEmbeddedSessionFailure(message: string | null | undefined): boolean {
  if (!message) return false;
  return message.includes("embedded ACP processes cannot be resumed on a different instance");
}

function formatAutomationStepSummary(
  step: KanbanAutomationStep,
  availableProviders: AcpProviderInfo[],
  specialists: KanbanSpecialistOption[],
  autoProviderId?: string | null,
): string {
  const resolvedStep = resolveKanbanAutomationStep(
    step,
    createKanbanSpecialistResolver(specialists),
    { autoProviderId: autoProviderId ?? undefined },
  ) ?? step;
  if ((resolvedStep.transport ?? "acp") === "a2a") {
    return [
      "A2A",
      resolvedStep.role ?? "DEVELOPER",
      getSpecialistName(resolvedStep.specialistId, resolvedStep.specialistName, specialists),
      formatAgentCardTarget(resolvedStep.agentCardUrl),
      resolvedStep.skillId ? `skill:${resolvedStep.skillId}` : undefined,
    ].filter(Boolean).join(" · ");
  }
  return [
    getProviderName(resolvedStep.providerId, availableProviders),
    resolvedStep.role ?? "DEVELOPER",
    getSpecialistName(resolvedStep.specialistId, resolvedStep.specialistName, specialists),
  ].join(" · ");
}

export function ExecutionSection({
  task,
  lane,
  boardColumns,
  availableProviders,
  sessionInfo,
  specialists,
  specialistLanguage,
  selectedProvider,
  onPatchTask,
  onRetryTrigger,
  onProviderChange,
  compact = false,
}: {
  task: TaskInfo;
  lane?: KanbanColumnInfo;
  boardColumns: KanbanColumnInfo[];
  availableProviders: AcpProviderInfo[];
  sessionInfo?: SessionInfo | null;
  specialists: KanbanSpecialistOption[];
  specialistLanguage: KanbanSpecialistLanguage;
  selectedProvider?: string | null;
  onPatchTask: (taskId: string, payload: Record<string, unknown>) => Promise<TaskInfo>;
  onRetryTrigger: (taskId: string) => Promise<void>;
  onProviderChange?: (providerId: string | null) => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const sessionCopy = getKanbanSessionCopy(specialistLanguage);
  const resolveSpecialist = useMemo(
    () => createKanbanSpecialistResolver(specialists),
    [specialists],
  );
  const effectiveAutomation = resolveEffectiveTaskAutomation(task, boardColumns, resolveSpecialist, {
    autoProviderId: selectedProvider ?? undefined,
  });
  const canRunTask = effectiveAutomation.canRun && task.columnId !== "done";
  const hasCardOverride = effectiveAutomation.source === "card";
  const overrideProviderValue = hasCardOverride ? task.assignedProvider ?? "" : "";
  const overrideRoleValue = hasCardOverride ? task.assignedRole ?? "DEVELOPER" : "DEVELOPER";
  const overrideSpecialistValue = hasCardOverride
    ? getLanguageSpecificSpecialistId(task.assignedSpecialistId, specialistLanguage) ?? ""
    : "";
  const usesSelectedProvider = Boolean(
    !hasCardOverride
    && selectedProvider
    && effectiveAutomation.transport !== "a2a"
    && effectiveAutomation.providerSource === "auto",
  );
  const manualRunTarget = usesSelectedProvider
    ? formatEffectiveAutomationTarget(
        { ...effectiveAutomation, providerId: selectedProvider ?? undefined },
        availableProviders,
        specialists,
      )
    : formatEffectiveAutomationTarget(effectiveAutomation, availableProviders, specialists);
  const manualRunSourceLabel = hasCardOverride
    ? usesSelectedProvider
      ? "the current ACP provider with this card override"
      : "this card override"
    : usesSelectedProvider
      ? "the current ACP provider with this lane's role and specialist"
      : "the current lane default";
  const laneName = lane?.name ?? task.columnId ?? "backlog";
  const laneSteps = lane?.automation ? getKanbanAutomationSteps(lane.automation) : [];
  const cardSpecialist = getSpecialistName(task.assignedSpecialistId, task.assignedSpecialistName, specialists);
  const failureMessage = getPromptFailureMessage(task, sessionInfo);
  const activeRunSessionId = task.triggerSessionId
    ?? (task.laneSessions && task.laneSessions.length > 0 ? task.laneSessions[task.laneSessions.length - 1]?.sessionId : undefined);
  const activeLaneSession = activeRunSessionId
    ? task.laneSessions?.find((entry) => entry.sessionId === activeRunSessionId)
    : undefined;
  const failedRunProviderId = task.triggerSessionId
    ? sessionInfo?.sessionId === task.triggerSessionId
      ? sessionInfo.provider
      : activeLaneSession?.provider ?? (hasCardOverride ? task.assignedProvider : undefined) ?? (usesSelectedProvider ? selectedProvider ?? undefined : effectiveAutomation.providerId)
    : (hasCardOverride ? task.assignedProvider : undefined) ?? (usesSelectedProvider ? selectedProvider ?? undefined : effectiveAutomation.providerId);
  const failedRunLabel = activeLaneSession?.transport === "a2a" || effectiveAutomation.transport === "a2a"
    ? "current A2A run"
    : getProviderName(failedRunProviderId, availableProviders);
  const effectiveRunTarget = activeLaneSession
    ? formatEffectiveAutomationTarget(
        {
          ...effectiveAutomation,
          transport: activeLaneSession.transport === "a2a" ? "a2a" : "acp",
          providerId: activeLaneSession.provider ?? effectiveAutomation.providerId,
          role: activeLaneSession.role ?? effectiveAutomation.role,
          specialistId: activeLaneSession.specialistId ?? effectiveAutomation.specialistId,
          specialistName: activeLaneSession.specialistName ?? effectiveAutomation.specialistName,
        },
        availableProviders,
        specialists,
      )
    : manualRunTarget;
  const lanePipeline = laneSteps.length > 0
    ? laneSteps.map((step) => formatAutomationStepSummary(step, availableProviders, specialists, selectedProvider)).join(" -> ")
    : t.kanbanDetail.noLaneAutomation;
  const hasRecordedRuns = getOrderedSessionIds(task).length > 0;
  const transitionArtifacts = resolveKanbanTransitionArtifacts(boardColumns, task.columnId);
  const overrideKey = `${task.id}:${task.assignedProvider ?? ""}:${task.assignedRole ?? ""}:${task.assignedSpecialistId ?? ""}:${task.assignedSpecialistName ?? ""}`;
  const needsLiveRunRecovery = isExpiredEmbeddedSessionFailure(failureMessage);
  const runActionLabel = needsLiveRunRecovery
    ? t.kanbanDetail.recoverLiveRun
    : hasRecordedRuns ? t.kanban.rerun : t.kanban.run;

  return (
    <DetailSection
      title={t.kanbanDetail.execution}
      description={compact ? undefined : t.kanbanDetail.executionHint}
      compact={compact}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{laneName}</div>
          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {lane ? t.kanbanDetail.inheritedFromLane : t.kanbanDetail.laneMetadataUnavailable}
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${lane?.automation?.enabled ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"}`}>
          {lane?.automation?.enabled ? t.kanbanDetail.automationOn : t.kanbanDetail.manual}
        </span>
      </div>
      <div className="mt-2.5 space-y-1.5">
        <InlineSummary label={t.kanbanDetail.lanePipeline} value={lanePipeline} compact={compact} />
        <InlineSummary label={t.kanbanDetail.currentRun} value={effectiveRunTarget} compact={compact} />
      </div>
      {canRunTask && !hasRecordedRuns && (
        <div className={`mt-2 border-l-2 border-sky-300/70 px-3 py-2 text-xs text-sky-800 dark:border-sky-700/70 dark:text-sky-200 ${compact ? "leading-[1.125rem]" : "leading-5"}`}>
          {sessionCopy.emptyPaneDescription}
          {" "}
          {sessionCopy.emptyPaneHint}
          {" "}
          {sessionCopy.expectedTarget(effectiveRunTarget)}
        </div>
      )}
      {transitionArtifacts.currentRequiredArtifacts.length > 0 && (
        <div className="mt-1.5">
          <InlineSummary label={`Enter ${laneName}`} value={formatArtifactSummary(transitionArtifacts.currentRequiredArtifacts)} compact={compact} />
        </div>
      )}
      {transitionArtifacts.nextRequiredArtifacts.length > 0 && (
        <div className="mt-1.5">
          <InlineSummary label={transitionArtifacts.nextColumn?.name ? `Before ${transitionArtifacts.nextColumn.name}` : "Next move"} value={formatArtifactSummary(transitionArtifacts.nextRequiredArtifacts)} compact={compact} />
        </div>
      )}
      <details
        key={overrideKey}
        open={hasCardOverride || undefined}
        className={`mt-2.5 border border-slate-200/70 dark:border-slate-700/70 ${compact ? "px-2.5 py-2.5" : "px-3 py-2.5"}`}
      >
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              {t.kanbanDetail.cardSessionOverride}
            </div>
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {t.kanbanDetail.keepCardSessionOverride}
            </div>
          </div>
          <span className="rounded border border-slate-300 px-3 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:border-amber-300 hover:text-amber-700 dark:border-slate-600 dark:text-slate-300 dark:hover:border-amber-600 dark:hover:text-amber-200">
            {hasCardOverride ? t.kanbanDetail.editOverride : t.kanbanDetail.overrideCard}
          </span>
        </summary>
        {hasCardOverride && (
          <div className={`mt-2 border-l-2 border-amber-300/80 px-2.5 py-2 text-xs text-amber-800 dark:border-amber-700/70 dark:text-amber-300 ${compact ? "leading-[1.125rem]" : "leading-5"}`}>
            {overrideProviderValue
              ? `${t.kanbanDetail.cardHasExplicitOverride} ${getProviderName(task.assignedProvider, availableProviders)} · ${task.assignedRole ?? "DEVELOPER"} · ${cardSpecialist}`
              : t.kanbanDetail.noCardOverride}
          </div>
        )}
        <div className="mt-3 space-y-2.5">
          <Select
            value={overrideProviderValue}
            onChange={async (event) => {
              const newProvider = event.target.value || null;
              if (newProvider) {
                await onPatchTask(task.id, {
                  assignedProvider: newProvider,
                  assignedRole: hasCardOverride ? task.assignedRole ?? "DEVELOPER" : "DEVELOPER",
                });
                onProviderChange?.(newProvider);
              } else {
                await onPatchTask(task.id, {
                  assignedProvider: undefined,
                  assignedRole: undefined,
                  assignedSpecialistId: undefined,
                  assignedSpecialistName: undefined,
                });
                onProviderChange?.(null);
              }
            }}
            className={`w-full border border-slate-200/80 bg-transparent text-sm text-slate-700 outline-none focus:border-amber-400 dark:border-slate-700 dark:bg-transparent dark:text-slate-300 ${compact ? "px-2.5 py-2" : "px-3 py-2"}`}
          >
            <option value="">{t.kanban.useLaneDefault}</option>
            {availableProviders.map((provider) => (
              <option key={`${provider.id}-${provider.name}`} value={provider.id}>{provider.name}</option>
            ))}
          </Select>
          {hasCardOverride && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Select
                value={overrideRoleValue}
                onChange={async (event) => {
                  await onPatchTask(task.id, { assignedRole: event.target.value });
                }}
                className={`w-full border border-slate-200/80 bg-transparent text-sm text-slate-700 outline-none focus:border-amber-400 dark:border-slate-700 dark:bg-transparent dark:text-slate-300 ${compact ? "px-2.5 py-2" : "px-3 py-2"}`}
              >
                {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
              </Select>
              <Select
                value={overrideSpecialistValue}
                onChange={async (event) => {
                  const specialist = findSpecialistById(specialists, event.target.value);
                  await onPatchTask(task.id, {
                    assignedSpecialistId: event.target.value || undefined,
                    assignedSpecialistName: specialist?.name,
                    assignedRole: specialist?.role ?? (hasCardOverride ? task.assignedRole : undefined),
                  });
                }}
                className={`w-full border border-slate-200/80 bg-transparent text-sm text-slate-700 outline-none focus:border-amber-400 dark:border-slate-700 dark:bg-transparent dark:text-slate-300 ${compact ? "px-2.5 py-2" : "px-3 py-2"}`}
              >
                <option value="">{KANBAN_SPECIALIST_LANGUAGE_LABELS[specialistLanguage].noSpecialist}</option>
                {specialists.map((specialist) => <option key={specialist.id} value={specialist.id}>{getSpecialistDisplayName(specialist)}</option>)}
              </Select>
            </div>
          )}
        </div>
      </details>
      {canRunTask && (
        <div className={`mt-2 border-l-2 border-sky-300/80 px-3 py-2 text-xs text-sky-800 dark:border-sky-700/70 dark:text-sky-200 ${compact ? "leading-[1.125rem]" : "leading-[1.2rem]"}`}>
          Manual {hasRecordedRuns ? "reruns" : "runs"} use {manualRunSourceLabel}:
          {" "}
          {manualRunTarget}
        </div>
      )}
      {failureMessage && (
        <div className={`mt-2 border-l-2 border-rose-300/80 px-3 py-2 text-xs text-rose-800 dark:border-rose-700/70 dark:text-rose-200 ${compact ? "leading-[1.125rem]" : "leading-[1.2rem]"}`}>
          Current run failed on {failedRunLabel}: {failureMessage}
          {" "}
          {effectiveAutomation.transport === "a2a"
            ? "Check the remote agent card URL, auth config, or A2A task status before rerunning."
            : needsLiveRunRecovery
              ? t.kanbanDetail.recoverLiveRunHint
              : "Reset the override or switch providers before rerunning if this looks like a provider authorization or runtime issue."}
        </div>
      )}
      {transitionArtifacts.nextRequiredArtifacts.length > 0 && (
        <div className={`mt-2 border-l-2 border-amber-300/80 px-3 py-2 text-xs text-amber-800 dark:border-amber-700/70 dark:text-amber-300 ${compact ? "leading-[1.125rem]" : "leading-5"}`}>
          Moving this card to {transitionArtifacts.nextColumn?.name ?? "the next stage"} requires {formatArtifactSummary(transitionArtifacts.nextRequiredArtifacts)}.
          {" "}This gate is injected into the ACP prompt, but the agent still needs to create those artifacts before calling <code>move_card</code>.
        </div>
      )}
      <div className={`flex flex-wrap items-center gap-2 ${compact ? "mt-2.5" : "mt-3"}`}>
        {hasCardOverride && (
          <button
            type="button"
            onClick={async () => {
              await onPatchTask(task.id, {
                assignedProvider: undefined,
                assignedRole: undefined,
                assignedSpecialistId: undefined,
                assignedSpecialistName: undefined,
              });
              onProviderChange?.(null);
            }}
            className="rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-amber-300 hover:text-amber-700 dark:border-slate-600 dark:text-slate-300 dark:hover:border-amber-600 dark:hover:text-amber-200"
          >
            {t.kanbanDetail.resetOverride}
          </button>
        )}
        {canRunTask && (
          <button
            onClick={async () => {
              await onRetryTrigger(task.id);
            }}
            data-testid="kanban-detail-run"
            className={`rounded border border-emerald-500 bg-emerald-500/10 px-4 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-500/20 ${hasCardOverride ? "ml-auto" : ""} ${compact ? "py-2" : "py-2.5"}`}
          >
            {runActionLabel}
          </button>
        )}
      </div>
    </DetailSection>
  );
}
