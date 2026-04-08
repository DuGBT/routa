"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AcpProviderInfo } from "@/client/acp-client";
import type { CodebaseData } from "@/client/hooks/use-workspaces";
import { desktopAwareFetch } from "@/client/utils/diagnostics";
import { resolveKanbanTransitionArtifacts } from "@/core/kanban/transition-artifacts";
import type { KanbanColumnInfo, SessionInfo, TaskInfo, WorktreeInfo } from "../types";
import { KanbanCardActivityPanel } from "./kanban-card-activity";
import type { KanbanTaskChanges } from "./kanban-file-changes-types";
import { getOrderedSessionIds, type KanbanSpecialistOption as SpecialistOption } from "./kanban-card-session-utils";
import type { KanbanSpecialistLanguage } from "./kanban-specialist-language";
export { KanbanCardActivityBar } from "./kanban-card-activity";
import { KanbanCardArtifacts } from "./kanban-card-artifacts";
import { useTranslation } from "@/i18n";
import { CardDetailHeader } from "./kanban-card-detail/header";
import { DescriptionSection } from "./kanban-card-detail/description";
import { ExecutionSection } from "./kanban-card-detail/execution-section";
import { RepositoriesWorktreeRow } from "./kanban-card-detail/repositories-worktree";
import { StoryReadinessPanel, EvidenceBundlePanel, TaskChangesPanel } from "./kanban-card-detail/readiness-panels";
import { DetailSection } from "./kanban-card-detail/shared";

export interface KanbanCardDetailProps {
  task: TaskInfo;
  refreshSignal?: number;
  boardColumns?: KanbanColumnInfo[];
  availableProviders: AcpProviderInfo[];
  specialists: SpecialistOption[];
  specialistLanguage: KanbanSpecialistLanguage;
  codebases: CodebaseData[];
  allCodebaseIds: string[];
  worktreeCache: Record<string, WorktreeInfo>;
  sessionInfo?: SessionInfo | null;
  sessions?: SessionInfo[];
  fullWidth?: boolean;
  selectedProvider?: string | null;
  onPatchTask: (taskId: string, payload: Record<string, unknown>) => Promise<TaskInfo>;
  onRetryTrigger: (taskId: string) => Promise<void>;
  onDelete: () => void;
  onRefresh: () => void;
  onProviderChange?: (providerId: string | null) => void;
  onRepositoryChange?: (codebaseIds: string[]) => void;
  onSelectSession?: (sessionId: string) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: (next: boolean) => void;
}

type KanbanDetailTabId = "description" | "readiness" | "execution" | "changes" | "evidence" | "runs";

export function KanbanCardDetail({
  task,
  refreshSignal,
  boardColumns,
  availableProviders,
  specialists,
  specialistLanguage,
  codebases,
  allCodebaseIds,
  worktreeCache,
  sessionInfo,
  sessions,
  fullWidth,
  selectedProvider,
  onPatchTask,
  onRetryTrigger,
  onDelete,
  onRefresh,
  onProviderChange,
  onRepositoryChange,
  onSelectSession,
  isFullscreen = false,
  onToggleFullscreen,
}: KanbanCardDetailProps) {
  const { t } = useTranslation();
  const [editTitle, setEditTitle] = useState(task.title);
  const [editObjective, setEditObjective] = useState(task.objective ?? "");
  const [editTestCases, setEditTestCases] = useState((task.testCases ?? []).join("\n"));
  const [editPriority, setEditPriority] = useState(task.priority ?? "medium");
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [isDescriptionEditing, setIsDescriptionEditing] = useState(false);
  const [isTestCasesEditing, setIsTestCasesEditing] = useState(false);
  const [tabSelections, setTabSelections] = useState<Partial<Record<string, KanbanDetailTabId>>>({});
  const [taskChanges, setTaskChanges] = useState<KanbanTaskChanges | null>(null);
  const [taskChangesLoading, setTaskChangesLoading] = useState(false);
  const titleInputRef = useRef<HTMLTextAreaElement | null>(null);
  const testCasesInputRef = useRef<HTMLTextAreaElement | null>(null);
  const displayedTitle = isTitleEditing ? editTitle : task.title;
  const displayedObjective = isDescriptionEditing ? editObjective : (task.objective ?? "");
  const displayedTestCases = isTestCasesEditing ? editTestCases : (task.testCases ?? []).join("\n");
  const displayedPriority = task.priority ?? editPriority;

  const getTaskRepositoryPath = (): string | null => {
    const worktreePath = task.worktreeId ? worktreeCache[task.worktreeId]?.worktreePath : null;
    if (worktreePath) return worktreePath;
    const taskCodebaseIds = task.codebaseIds && task.codebaseIds.length > 0 ? task.codebaseIds : allCodebaseIds;
    if (taskCodebaseIds.length === 0) return null;
    const primaryCodebase = codebases.find((codebase) => codebase.id === taskCodebaseIds[0]);
    return primaryCodebase?.repoPath ?? null;
  };

  const currentLane = useMemo(
    () => boardColumns?.find((column) => column.id === (task.columnId ?? "backlog")),
    [boardColumns, task.columnId],
  );
  const nextTransitionArtifacts = useMemo(
    () => resolveKanbanTransitionArtifacts(boardColumns ?? [], task.columnId),
    [boardColumns, task.columnId],
  );
  const orderedSessionIds = useMemo(() => getOrderedSessionIds(task), [task]);
  const activeRunSessionId = task.triggerSessionId
    ?? (orderedSessionIds.length > 0 ? orderedSessionIds[orderedSessionIds.length - 1] : undefined);
  const sessionCwdMismatch = sessionInfo && activeRunSessionId ? (() => {
    const taskRepoPath = getTaskRepositoryPath();
    if (!taskRepoPath) return false;
    return sessionInfo.cwd !== taskRepoPath;
  })() : undefined;
  const splitMode = !fullWidth;
  const compactMode = splitMode;
  const tabStateKey = `${task.id}:${splitMode ? "split" : "full"}`;
  const storedTab = tabSelections[tabStateKey];
  const activeTab = storedTab === "execution" ? "description" : (storedTab ?? "description");
  const detailTabs = [
    { id: "description" as const, label: t.kanbanDetail.description },
    { id: "readiness" as const, label: t.kanbanDetail.storyReadiness },
    { id: "changes" as const, label: t.kanbanDetail.changes },
    { id: "evidence" as const, label: t.kanbanDetail.evidenceBundle },
    ...(!splitMode ? [{ id: "runs" as const, label: t.kanbanDetail.runs }] : []),
  ];

  useEffect(() => {
    setTaskChanges(null);
    setTaskChangesLoading(false);
  }, [task.id]);

  useEffect(() => {
    if (activeTab !== "changes" || taskChanges) {
      return;
    }
    let cancelled = false;
    setTaskChangesLoading(true);
    void (async () => {
      try {
        const response = await desktopAwareFetch(`/api/tasks/${encodeURIComponent(task.id)}/changes`, {
          cache: "no-store",
        });
        const payload = await response.json() as { changes?: KanbanTaskChanges; error?: string };
        if (cancelled) return;
        if (!response.ok) {
          throw new Error(payload.error ?? t.common.unavailable);
        }
        setTaskChanges(payload.changes ?? null);
      } catch (error) {
        if (!cancelled) {
          setTaskChanges({
            codebaseId: "",
            repoPath: "",
            label: t.kanbanDetail.repo,
            branch: "unknown",
            status: { clean: true, ahead: 0, behind: 0, modified: 0, untracked: 0 },
            files: [],
            source: "repo",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } finally {
        if (!cancelled) {
          setTaskChangesLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, task.id, taskChanges, t.common.unavailable, t.kanbanDetail.repo]);

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className={`mx-auto flex min-h-full max-w-6xl flex-col ${compactMode ? "gap-3 p-3" : "gap-4 p-5"}`}>
        <CardDetailHeader
          task={task}
          compact={compactMode}
          editTitle={editTitle}
          isTitleEditing={isTitleEditing}
          editPriority={displayedPriority}
          orderedSessionIds={orderedSessionIds}
          onTitleFocus={() => {
            setEditTitle(task.title);
            setIsTitleEditing(true);
          }}
          onTitleChange={(value) => setEditTitle(value)}
          onTitleBlur={async () => {
            setIsTitleEditing(false);
            if (editTitle !== task.title) {
              await onPatchTask(task.id, { title: editTitle });
              onRefresh();
            }
          }}
          onPriorityChange={async (value) => {
            setEditPriority(value);
            await onPatchTask(task.id, { priority: value });
            onRefresh();
          }}
          onRefresh={onRefresh}
          onToggleFullscreen={onToggleFullscreen}
          isFullscreen={isFullscreen}
          titleInputRef={titleInputRef}
        />

        <div className="border-b border-slate-200/80 dark:border-[#232736]">
          <div className="flex min-w-0 gap-1 overflow-x-auto pb-1">
            {detailTabs.map((tab) => {
              const active = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setTabSelections((current) => ({ ...current, [tabStateKey]: tab.id }));
                  }}
                  className={`shrink-0 border-b-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors ${
 active
 ? "border-b-amber-600 text-slate-900 dark:border-b-amber-400 dark:text-slate-100"
 : "border-b-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
 }`}
                  aria-pressed={active}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className={compactMode ? "space-y-3" : "space-y-4"}>
          {activeTab === "description" && (
            <>
              <DescriptionSection
                task={task}
                compact={compactMode}
                displayedObjective={displayedObjective}
                displayedTestCases={displayedTestCases}
                editTestCases={editTestCases}
                isTestCasesEditing={isTestCasesEditing}
                onDescriptionEditingChange={setIsDescriptionEditing}
                onEditObjectiveInit={() => setEditObjective(task.objective ?? "")}
                onDescriptionSave={async (nextObjective) => {
                  if (nextObjective !== (task.objective ?? "")) {
                    setEditObjective(nextObjective);
                    await onPatchTask(task.id, { objective: nextObjective });
                    onRefresh();
                  }
                }}
                onTestCasesFocus={() => {
                  setEditTestCases((task.testCases ?? []).join("\n"));
                  setIsTestCasesEditing(true);
                }}
                onTestCasesChange={(value) => setEditTestCases(value)}
                onTestCasesBlur={async () => {
                  setIsTestCasesEditing(false);
                  const normalizedCurrent = (task.testCases ?? []).join("\n");
                  if (editTestCases !== normalizedCurrent) {
                    await onPatchTask(task.id, {
                      testCases: editTestCases.split("\n").map((item) => item.trim()).filter(Boolean),
                    });
                    onRefresh();
                  }
                }}
                testCasesInputRef={testCasesInputRef}
              />

              <ExecutionSection
                task={task}
                lane={currentLane}
                boardColumns={boardColumns ?? []}
                availableProviders={availableProviders}
                sessionInfo={sessionInfo}
                specialists={specialists}
                specialistLanguage={specialistLanguage}
                selectedProvider={selectedProvider}
                onPatchTask={onPatchTask}
                onRetryTrigger={onRetryTrigger}
                onProviderChange={onProviderChange}
                compact={compactMode}
              />

              <RepositoriesWorktreeRow
                task={task}
                codebases={codebases}
                allCodebaseIds={allCodebaseIds}
                worktreeCache={worktreeCache}
                sessionInfo={sessionInfo}
                sessionCwdMismatch={sessionCwdMismatch}
                updateError={updateError}
                setUpdateError={setUpdateError}
                onPatchTask={onPatchTask}
                onRefresh={onRefresh}
                onRepositoryChange={onRepositoryChange}
                onSelectSession={onSelectSession}
                compact={compactMode}
              />
            </>
          )}

          {activeTab === "readiness" && (
            <DetailSection
              title={t.kanbanDetail.storyReadiness}
              description={compactMode ? undefined : t.kanbanDetail.storyReadinessHint}
              compact={compactMode}
            >
              <StoryReadinessPanel task={task} compact={compactMode} />
            </DetailSection>
          )}

          {activeTab === "changes" && (
            <DetailSection
              title={t.kanbanDetail.changes}
              description={compactMode ? undefined : t.kanbanDetail.changesHint}
              compact={compactMode}
            >
              <TaskChangesPanel
                changes={taskChanges}
                loading={taskChangesLoading}
                compact={compactMode}
              />
            </DetailSection>
          )}

          {activeTab === "evidence" && (
            <>
              <DetailSection
                title={t.kanbanDetail.evidenceBundle}
                description={compactMode ? undefined : t.kanbanDetail.evidenceBundleHint}
                compact={compactMode}
              >
                <EvidenceBundlePanel task={task} compact={compactMode} />
              </DetailSection>

              <KanbanCardArtifacts
                taskId={task.id}
                compact={compactMode}
                requiredArtifacts={nextTransitionArtifacts.nextRequiredArtifacts}
                refreshSignal={refreshSignal}
              />
            </>
          )}

          {activeTab === "runs" && !splitMode && (
            <KanbanCardActivityPanel
              task={task}
              refreshSignal={refreshSignal}
              sessions={sessions ?? []}
              specialists={specialists}
              specialistLanguage={specialistLanguage}
              autoProviderId={selectedProvider ?? undefined}
              currentSessionId={activeRunSessionId}
              onSelectSession={onSelectSession}
              compact={compactMode}
            />
          )}
        </div>

        <div className={`mt-auto border-t border-slate-200 dark:border-slate-700 ${compactMode ? "pt-3" : "pt-4"}`}>
          <button
            onClick={onDelete}
            className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:border-red-300 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-900/10 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            {t.kanbanModals.deleteTaskTitle}
          </button>
        </div>
      </div>
    </div>
  );
}
