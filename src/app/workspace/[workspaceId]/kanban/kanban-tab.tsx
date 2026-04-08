"use client";

import { useEffect } from "react";
import type { CodebaseData } from "@/client/hooks/use-workspaces";
import { resolveEffectiveTaskAutomation } from "@/core/kanban/effective-task-automation";
import type { SessionInfo, TaskInfo, WorktreeInfo } from "../types";
import { KanbanGitHubImportModal } from "./kanban-github-import-modal";
import { KanbanSettingsModal } from "./kanban-settings-modal";
import { scheduleKanbanRefreshBurst } from "./kanban-agent-input";
import { normalizeKanbanAutomation } from "@/core/models/kanban";
import {
  canSelectTaskSessionInAcp,
  extractSessionLiveTail,
  isA2ATaskSession,
} from "./kanban-tab-helpers";
import { KanbanTabHeader } from "./kanban-tab-header";
import {
  KanbanCodebaseModal,
  KanbanDeleteCodebaseModal,
  KanbanDeleteTaskModal,
  KanbanMoveBlockedModal,
  KanbanReplaceAllReposModal,
} from "./kanban-tab-modals";
import {
  KanbanBoardSurface,
  KanbanCreateTaskModal,
  KanbanTaskDetailOverlay,
} from "./kanban-tab-panels";
import {
  useKanbanTabState,
  LIVE_SESSION_TAIL_POLL_MS,
  type KanbanTabProps,
} from "./kanban-tab-state";
import { useKanbanTabActions } from "./kanban-tab-actions";
import { useTranslation } from "@/i18n";

export function KanbanTab(props: KanbanTabProps) {
  const {
    workspaceId,
    refreshSignal,
    boards,
    tasks,
    sessions,
    specialists,
    specialistLanguage = "en",
    onSpecialistLanguageChange: _onSpecialistLanguageChange,
    codebases,
    onRefresh,
    repoSync,
    repoChanges = [],
    repoChangesLoading = false,
    acp,
    onAgentPrompt,
  } = props;

  const { t } = useTranslation();
  const state = useKanbanTabState(props);

  const actions = useKanbanTabActions({
    workspaceId,
    specialistLanguage,
    defaultBoardId: state.defaultBoardId,
    defaultCodebase: state.defaultCodebase,
    allCodebaseIds: state.allCodebaseIds,
    codebases,
    acp,
    onAgentPrompt: onAgentPrompt as ((prompt: string, options: Record<string, unknown>) => Promise<string | undefined>) | undefined,
    onRefresh,
    resolveSpecialist: state.resolveSpecialist,
    board: state.board,
    boardAutoProviderId: state.boardAutoProviderId,
    localTasks: state.localTasks,
    sessionMap: state.sessionMap,
    activeTask: state.activeTask,
    activeTaskId: state.activeTaskId,
    activeSessionId: state.activeSessionId,
    selectedBoardId: state.selectedBoardId,
    selectedCodebase: state.selectedCodebase,
    editRepoSelection: state.editRepoSelection,
    deletingBranchNames: state.deletingBranchNames,
    liveBranchInfo: state.liveBranchInfo,
    autoPatchedTasksRef: state.autoPatchedTasksRef,
    sessionBackfillInFlightRef: state.sessionBackfillInFlightRef,
    emptySessionRecoveryRef: state.emptySessionRecoveryRef,
    liveSessionTails: state.liveSessionTails,
    activeLiveSessionIds: state.activeLiveSessionIds,
    worktreeCache: state.worktreeCache,
    missingWorktreeIds: state.missingWorktreeIds,
    agentInput: state.agentInput,
    agentLoading: state.agentLoading,
    agentSessionId: state.agentSessionId,
    draft: state.draft,
    deleteConfirmTask: state.deleteConfirmTask,
    setAgentInput: state.setAgentInput,
    setAgentLoading: state.setAgentLoading,
    setAgentSessionId: state.setAgentSessionId,
    setAgentPanelOpen: state.setAgentPanelOpen,
    setActiveSessionId: state.setActiveSessionId,
    setActiveTaskId: state.setActiveTaskId,
    setLocalTasks: state.setLocalTasks,
    setIsTaskDetailFullscreen: state.setIsTaskDetailFullscreen,
    setLiveSessionTails: state.setLiveSessionTails,
    setBackfilledSessions: state.setBackfilledSessions,
    setShowSettings: state.setShowSettings,
    setSelectedCodebase: state.setSelectedCodebase,
    setCodebaseWorktrees: state.setCodebaseWorktrees,
    setEditingCodebase: state.setEditingCodebase,
    setEditRepoSelection: state.setEditRepoSelection,
    setEditSaving: state.setEditSaving,
    setEditError: state.setEditError,
    setRecloning: state.setRecloning,
    setRecloneError: state.setRecloneError,
    setRecloneSuccess: state.setRecloneSuccess,
    setShowReplaceAllConfirm: state.setShowReplaceAllConfirm,
    setReplacingAll: state.setReplacingAll,
    setShowDeleteCodebaseConfirm: state.setShowDeleteCodebaseConfirm,
    setDeletingCodebase: state.setDeletingCodebase,
    setDeletingWorktreeIds: state.setDeletingWorktreeIds,
    setDeletingBranchNames: state.setDeletingBranchNames,
    setBranchActionError: state.setBranchActionError,
    setWorktreeActionError: state.setWorktreeActionError,
    setLiveBranchInfo: state.setLiveBranchInfo,
    setWorktreeCache: state.setWorktreeCache,
    setMissingWorktreeIds: state.setMissingWorktreeIds,
    setColumnAutomation: state.setColumnAutomation,
    setVisibleColumns: state.setVisibleColumns,
    setDeleteConfirmTask: state.setDeleteConfirmTask,
    setIsDeleting: state.setIsDeleting,
    setMoveError: state.setMoveError,
    setMoveBlockedMessage: state.setMoveBlockedMessage,
    setShowCreateModal: state.setShowCreateModal,
    setShowGitHubImportModal: state.setShowGitHubImportModal,
    setDraft: state.setDraft,
  });

  // --- Cross-cutting effects (remain here since they bridge state + actions) ---

  // Auto-patch codebase IDs on tasks that lack a valid codebase
  useEffect(() => {
    if (codebases.length === 0 || state.localTasks.length === 0) return;
    const codebaseById = new Map(codebases.map((codebase) => [codebase.id, codebase]));
    const pendingPatches: Array<{ taskId: string; codebaseId: string }> = [];
    for (const task of state.localTasks) {
      if (state.autoPatchedTasksRef.current.has(task.id)) continue;
      const taskCodebaseIds = task.codebaseIds ?? [];
      const hasValidCodebase = taskCodebaseIds.some((id) => codebaseById.has(id));
      if (hasValidCodebase) continue;
      let resolved: CodebaseData | null = null;
      const session = task.triggerSessionId ? state.sessionMap.get(task.triggerSessionId) : null;
      if (session?.cwd) {
        resolved = codebases.find((codebase) => codebase.repoPath === session.cwd) ?? null;
      }
      if (!resolved && state.defaultCodebase) {
        resolved = state.defaultCodebase;
      }
      if (resolved) {
        pendingPatches.push({ taskId: task.id, codebaseId: resolved.id });
      }
    }
    if (pendingPatches.length === 0) return;
    for (const patch of pendingPatches) {
      state.autoPatchedTasksRef.current.add(patch.taskId);
      void actions.patchTask(patch.taskId, { codebaseIds: [patch.codebaseId] });
    }
  }, [codebases, state.defaultCodebase, state.localTasks, state.sessionMap, actions.patchTask, state.autoPatchedTasksRef]);

  // Session backfill effect
  useEffect(() => {
    const targetSessionId = state.preferredActiveTaskSessionId ?? state.activeSessionId;
    const sessionsInFlight = state.sessionBackfillInFlightRef.current;
    if (!state.activeTask || !targetSessionId) return;
    if (isA2ATaskSession(state.activeTask, targetSessionId)) return;
    if (state.sessionMap.has(targetSessionId)) return;
    if (sessionsInFlight.has(targetSessionId)) return;

    const controller = new AbortController();
    sessionsInFlight.add(targetSessionId);

    void (async () => {
      try {
        const response = await fetch(`/api/sessions/${encodeURIComponent(targetSessionId)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = await response.json();
        if (controller.signal.aborted) return;
        const session = data?.session as SessionInfo | undefined;
        if (!session?.sessionId) return;
        state.setBackfilledSessions((current) => ({ ...current, [session.sessionId]: session }));
      } catch {
        // Ignore targeted backfill failures; the manual refresh control remains available.
      } finally {
        sessionsInFlight.delete(targetSessionId);
      }
    })();

    return () => {
      controller.abort();
      sessionsInFlight.delete(targetSessionId);
    };
  }, [state.activeSessionId, state.activeTask, state.preferredActiveTaskSessionId, state.sessionMap, state.setBackfilledSessions, state.sessionBackfillInFlightRef]);

  // ACP session sync effect
  useEffect(() => {
    if (!state.activeTask || !state.activeSessionId || !acp) return;
    if (!canSelectTaskSessionInAcp(state.activeTask, state.activeSessionId, state.sessionMap)) return;
    if (acp.sessionId === state.activeSessionId) return;
    acp.selectSession(state.activeSessionId);
  }, [acp, state.activeSessionId, state.activeTask, state.sessionMap]);

  // Empty session recovery effect
  useEffect(() => {
    if (!state.activeTask) {
      state.emptySessionRecoveryRef.current = null;
      return;
    }
    if (state.activeSessionId || state.preferredActiveTaskSessionId) {
      state.emptySessionRecoveryRef.current = null;
      return;
    }
    if (!resolveEffectiveTaskAutomation(
      state.activeTask,
      state.board?.columns ?? [],
      state.resolveSpecialist,
      { autoProviderId: state.boardAutoProviderId },
    ).canRun || state.activeTask.columnId === "done") {
      state.emptySessionRecoveryRef.current = null;
      return;
    }
    const recoveryKey = `${state.activeTask.id}:${state.activeTask.columnId ?? "backlog"}`;
    if (state.emptySessionRecoveryRef.current === recoveryKey) {
      return;
    }
    state.emptySessionRecoveryRef.current = recoveryKey;
    return scheduleKanbanRefreshBurst(onRefresh);
  }, [state.activeSessionId, state.activeTask, state.board?.columns, state.boardAutoProviderId, onRefresh, state.preferredActiveTaskSessionId, state.resolveSpecialist, state.emptySessionRecoveryRef]);

  // Agent panel refresh burst
  useEffect(() => {
    if (!state.agentSessionId || !state.agentPanelOpen) return;
    return scheduleKanbanRefreshBurst(onRefresh);
  }, [state.agentPanelOpen, state.agentSessionId, onRefresh]);

  // Live session tail polling
  useEffect(() => {
    if (state.activeLiveSessionIds.length === 0) {
      state.setLiveSessionTails((previous) => (Object.keys(previous).length > 0 ? {} : previous));
      return;
    }
    const activeIdSet = new Set(state.activeLiveSessionIds);
    let disposed = false;
    const pollLiveSessionTail = async () => {
      const updates = await Promise.all(state.activeLiveSessionIds.map(async (sessionId) => {
        try {
          const response = await fetch(
            `/api/sessions/${encodeURIComponent(sessionId)}/history?consolidated=true`,
            { cache: "no-store" },
          );
          if (!response.ok) return [sessionId, null] as const;
          const payload = await response.json();
          return [sessionId, extractSessionLiveTail(payload?.history)] as const;
        } catch {
          return [sessionId, null] as const;
        }
      }));
      if (disposed) return;
      state.setLiveSessionTails((previous) => {
        const next: Record<string, string> = {};
        let changed = false;
        for (const [sessionId, tail] of updates) {
          if (!activeIdSet.has(sessionId) || !tail) continue;
          next[sessionId] = tail;
          if (previous[sessionId] !== tail) changed = true;
        }
        for (const sessionId of Object.keys(previous)) {
          if (!activeIdSet.has(sessionId)) {
            changed = true;
            continue;
          }
          if (!next[sessionId] && previous[sessionId]) changed = true;
        }
        return changed ? next : previous;
      });
    };
    void pollLiveSessionTail();
    const timerId = window.setInterval(() => {
      void pollLiveSessionTail();
    }, LIVE_SESSION_TAIL_POLL_MS);
    return () => {
      disposed = true;
      window.clearInterval(timerId);
    };
  }, [state.activeLiveSessionIds, state.setLiveSessionTails]);

  // Fetch worktrees for tasks
  useEffect(() => {
    const worktreeIds = [...new Set(state.localTasks.map((t) => t.worktreeId).filter((id): id is string => Boolean(id)))];
    const missing = worktreeIds.filter((id) => !state.worktreeCache[id] && !state.missingWorktreeIds[id]);
    if (missing.length === 0) return;
    (async () => {
      const results: Record<string, WorktreeInfo> = {};
      const staleIds = new Set<string>();
      await Promise.allSettled(
        missing.map(async (id) => {
          try {
            const res = await fetch(`/api/worktrees/${encodeURIComponent(id)}`, { cache: "no-store" });
            if (res.ok) {
              const data = await res.json();
              if (data.worktree) results[id] = data.worktree as WorktreeInfo;
              return;
            }
            if (res.status === 404) {
              staleIds.add(id);
            }
          } catch { /* ignore */ }
        })
      );
      if (Object.keys(results).length > 0) {
        state.setWorktreeCache((prev) => ({ ...prev, ...results }));
      }
      if (staleIds.size > 0) {
        const staleIdList = [...staleIds];
        state.setMissingWorktreeIds((prev) => ({
          ...prev,
          ...Object.fromEntries(staleIdList.map((id) => [id, true] as const)),
        }));
        state.setLocalTasks((current) => current.map((task) => (
          task.worktreeId && staleIds.has(task.worktreeId)
            ? { ...task, worktreeId: undefined }
            : task
        )));
        const linkedTasks = state.localTasks
          .filter((task) => task.worktreeId && staleIds.has(task.worktreeId))
          .map((task) => task.id);
        await Promise.allSettled(linkedTasks.map(async (taskId) => {
          try {
            await actions.patchTask(taskId, { worktreeId: null });
          } catch {
            // Ignore patch failures
          }
        }));
      }
    })();
  }, [state.localTasks, state.missingWorktreeIds, actions.patchTask, state.worktreeCache, state.setWorktreeCache, state.setMissingWorktreeIds, state.setLocalTasks]);

  // Escape key handler
  useEffect(() => {
    if (!state.activeTaskId && !state.activeSessionId && !state.showSettings && !state.selectedCodebase) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (state.activeTaskId || state.activeSessionId) {
          actions.closeTaskDetail();
        } else if (state.showSettings) {
          state.setShowSettings(false);
        } else if (state.selectedCodebase) {
          state.setSelectedCodebase(null);
          state.setCodebaseWorktrees([]);
        }
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [state.activeTaskId, state.activeSessionId, state.showSettings, state.selectedCodebase, actions.closeTaskDetail, state.setShowSettings, state.setSelectedCodebase, state.setCodebaseWorktrees]);

  // _createBoard
  async function _createBoard() {
    const name = window.prompt(t.kanban.boardName);
    if (!name?.trim()) return;
    const response = await fetch("/api/kanban/boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, name: name.trim() }),
    });
    if (response.ok) {
      onRefresh();
    }
  }

  if (!state.board) {
    return (
      <div className="flex h-full flex-col space-y-2">
        <KanbanTabHeader
          tasksCount={tasks.length}
          board={state.board}
          boardQueue={state.boardQueue}
          repoHealth={{ missingRepoTasks: 0, cwdMismatchTasks: 0 }}
          boards={boards}
          selectedBoardId={state.selectedBoardId}
          onSelectBoard={state.setSelectedBoardId}
          githubImportEnabled={state.githubImportEnabled}
          onOpenGitHubImport={() => state.setShowGitHubImportModal(true)}
          onOpenSettings={() => state.setShowSettings(true)}
          onRefresh={onRefresh}
        />
        <div className="rounded-2xl border border-gray-200/60 bg-white p-6 text-sm text-gray-500 dark:border-[#1c1f2e] dark:bg-[#12141c] dark:text-gray-400">
          No board available yet.
        </div>
      </div>
    );
  }

  // Compute repoHealth here (it's a pure computation)
  const repoHealth = (() => {
    if (codebases.length === 0) return { missingRepoTasks: 0, cwdMismatchTasks: 0 };
    const codebaseById = new Map(codebases.map((cb) => [cb.id, cb]));
    let missingRepoTasks = 0;
    let cwdMismatchTasks = 0;
    for (const task of state.localTasks) {
      const taskCodebaseIds = task.codebaseIds && task.codebaseIds.length > 0 ? task.codebaseIds : [];
      const hasMissingRepo = taskCodebaseIds.length > 0 && taskCodebaseIds.every((cbId) => !codebaseById.has(cbId));
      if (hasMissingRepo) missingRepoTasks += 1;
      if (task.triggerSessionId) {
        const session = state.sessionMap.get(task.triggerSessionId);
        if (session?.cwd) {
          const primaryCodebase = taskCodebaseIds.length > 0 ? codebaseById.get(taskCodebaseIds[0]) ?? state.defaultCodebase : state.defaultCodebase;
          if (primaryCodebase?.repoPath && session.cwd !== primaryCodebase.repoPath) {
            cwdMismatchTasks += 1;
          }
        }
      }
    }
    return { missingRepoTasks, cwdMismatchTasks };
  })();

  return (
    <div className="flex flex-col h-full space-y-2">
      <KanbanTabHeader
        tasksCount={tasks.length}
        board={state.board}
        boardQueue={state.boardQueue}
        repoHealth={repoHealth}
        boards={boards}
        selectedBoardId={state.selectedBoardId}
        onSelectBoard={state.setSelectedBoardId}
        githubImportEnabled={state.githubImportEnabled}
        onOpenGitHubImport={() => state.setShowGitHubImportModal(true)}
        onOpenSettings={() => state.setShowSettings(true)}
        onRefresh={onRefresh}
      />
      <KanbanBoardSurface
        moveError={state.moveError}
        onDismissMoveError={() => state.setMoveError(null)}
        codebases={codebases}
        workspaceId={workspaceId}
        defaultCodebase={state.defaultCodebase}
        repoSync={repoSync}
        setSelectedCodebase={state.setSelectedCodebase}
        fetchCodebaseWorktrees={actions.fetchCodebaseWorktrees}
        onRefresh={onRefresh}
        onAgentPrompt={onAgentPrompt}
        repoChanges={repoChanges}
        repoChangesLoading={repoChangesLoading}
        availableProviders={state.availableProviders}
        acp={acp}
        boardAutoProviderId={state.boardAutoProviderId}
        onBoardProviderChange={actions.setKanbanBoardProvider}
        kanbanTaskAgentCopy={state.kanbanTaskAgentCopy}
        agentInput={state.agentInput}
        setAgentInput={state.setAgentInput}
        agentLoading={state.agentLoading}
        handleAgentSubmit={actions.handleAgentSubmit}
        setShowCreateModal={state.setShowCreateModal}
        agentSessionId={state.agentSessionId}
        openAgentPanel={actions.openAgentPanel}
        agentPanelOpen={state.agentPanelOpen}
        board={state.board}
        visibleColumns={state.visibleColumns}
        boardTasks={state.boardTasks}
        columnAutomation={state.columnAutomation}
        providers={props.providers}
        specialists={specialists}
        specialistLanguage={specialistLanguage}
        sessionMap={state.sessionMap}
        liveSessionTails={state.liveSessionTails}
        allCodebaseIds={state.allCodebaseIds}
        worktreeCache={state.worktreeCache}
        queuedPositions={state.queuedPositions}
        dragTaskId={state.dragTaskId}
        setDragTaskId={state.setDragTaskId}
        moveTask={actions.moveTask}
        confirmDeleteTask={actions.confirmDeleteTask}
        patchTask={actions.patchTask}
        retryTaskTrigger={actions.retryTaskTrigger}
        openTaskDetail={actions.openTaskDetail}
        agentSession={state.agentSession}
        onCloseAgentPanel={() => state.setAgentPanelOpen(false)}
        ensureKanbanAgentSession={actions.ensureKanbanAgentSession}
        kanbanRepoSelection={state.kanbanRepoSelection}
      />

      <KanbanCreateTaskModal
        showCreateModal={state.showCreateModal}
        draft={state.draft}
        setDraft={state.setDraft}
        onClose={() => state.setShowCreateModal(false)}
        onCreate={() => void actions.createTaskCard()}
        githubAvailable={state.githubAvailable}
        codebases={codebases}
        allCodebaseIds={state.allCodebaseIds}
      />

      <KanbanGitHubImportModal
        show={state.showGitHubImportModal}
        workspaceId={workspaceId}
        codebases={codebases}
        tasks={state.localTasks}
        onClose={() => state.setShowGitHubImportModal(false)}
        onImport={actions.importGitHubIssues}
        onImportPulls={actions.importGitHubPulls}
      />

      <KanbanTaskDetailOverlay
        activeSessionId={state.activeSessionId}
        activeTaskId={state.activeTaskId}
        activeTask={state.activeTask}
        board={state.board}
        resolveSpecialist={state.resolveSpecialist}
        acp={acp}
        boardAutoProviderId={state.boardAutoProviderId}
        onBoardProviderChange={actions.setKanbanBoardProvider}
        detailSplitContainerRef={state.detailSplitContainerRef}
        detailSplitRatio={state.detailSplitRatio}
        setIsDraggingDetailSplit={state.setIsDraggingDetailSplit}
        refreshSignal={refreshSignal}
        availableProviders={state.availableProviders}
        specialists={specialists}
        specialistLanguage={specialistLanguage}
        codebases={codebases}
        allCodebaseIds={state.allCodebaseIds}
        worktreeCache={state.worktreeCache}
        combinedSessions={state.combinedSessions}
        patchTask={actions.patchTask}
        retryTaskTrigger={actions.retryTaskTrigger}
        confirmDeleteTask={actions.confirmDeleteTask}
        onRefresh={onRefresh}
        setActiveSessionId={state.setActiveSessionId}
        closeTaskDetail={actions.closeTaskDetail}
        sessionMap={state.sessionMap}
        workspaceId={workspaceId}
        isTaskDetailFullscreen={state.isTaskDetailFullscreen}
        onToggleTaskDetailFullscreen={state.setIsTaskDetailFullscreen}
      />

      {/* Settings Modal */}
      {state.showSettings && state.board && (
        <KanbanSettingsModal
          board={state.board}
          columnAutomation={state.columnAutomation}
          availableProviders={state.availableProviders}
          specialists={specialists}
          specialistLanguage={specialistLanguage}
          onClose={() => state.setShowSettings(false)}
          onClearAll={async () => {
            const response = await fetch(`/api/tasks?workspaceId=${encodeURIComponent(workspaceId)}`, {
              method: "DELETE",
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
              throw new Error(data.error ?? "Failed to clear tasks");
            }
            state.setLocalTasks([]);
            actions.closeTaskDetail();
            state.setShowSettings(false);
            onRefresh();
          }}
          onSave={async (newColumns, newColumnAutomation, sessionConcurrencyLimit, devSessionSupervision) => {
            const updatedColumns = newColumns.map((col) => ({
              ...col,
              automation: newColumnAutomation[col.id]?.enabled
                ? normalizeKanbanAutomation(newColumnAutomation[col.id])
                : undefined,
            }));
            const response = await fetch(`/api/kanban/boards/${encodeURIComponent(state.board!.id)}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ columns: updatedColumns, sessionConcurrencyLimit, devSessionSupervision }),
            });
            if (!response.ok) {
              const data = await response.json();
              throw new Error(data.error ?? "Failed to save settings");
            }
            state.setVisibleColumns(updatedColumns.filter((col) => col.visible !== false).map((col) => col.id));
            state.setColumnAutomation(newColumnAutomation);
            state.setShowSettings(false);
            onRefresh();
          }}
        />
      )}

      {/* Codebase detail popup */}
      <KanbanCodebaseModal
        key={state.selectedCodebase?.id ?? "no-codebase-selected"}
        selectedCodebase={state.selectedCodebase}
        editingCodebase={state.editingCodebase}
        codebases={codebases}
        editRepoSelection={state.editRepoSelection}
        onRepoSelectionChange={actions.handleRepoSelectionChange}
        editError={state.editError}
        recloneError={state.recloneError}
        editSaving={state.editSaving}
        replacingAll={state.replacingAll}
        setShowReplaceAllConfirm={state.setShowReplaceAllConfirm}
        handleCancelEditCodebase={actions.handleCancelEditCodebase}
        codebaseWorktrees={state.codebaseWorktrees}
        worktreeActionError={state.worktreeActionError}
        localTasks={state.localTasks}
        handleDeleteCodebaseWorktrees={actions.handleDeleteCodebaseWorktrees}
        deletingWorktreeIds={state.deletingWorktreeIds}
        liveBranchInfo={state.liveBranchInfo}
        branchActionError={state.branchActionError}
        handleDeleteIssueBranch={actions.handleDeleteIssueBranch}
        handleDeleteIssueBranches={actions.handleDeleteIssueBranches}
        deletingBranchNames={state.deletingBranchNames}
        handleReclone={actions.handleReclone}
        recloning={state.recloning}
        recloneSuccess={state.recloneSuccess}
        onStartEditCodebase={actions.handleStartEditCodebase}
        onRequestRemoveCodebase={() => state.setShowDeleteCodebaseConfirm(true)}
        onClose={() => {
          state.setSelectedCodebase(null);
          state.setCodebaseWorktrees([]);
          state.setEditingCodebase(false);
          state.setLiveBranchInfo(null);
          state.setBranchActionError(null);
          state.setDeletingBranchNames([]);
          state.setRecloneError(null);
          state.setRecloneSuccess(null);
        }}
      />

      {state.showDeleteCodebaseConfirm && (
        <KanbanDeleteCodebaseModal
          selectedCodebase={state.selectedCodebase}
          editError={state.editError}
          deletingCodebase={state.deletingCodebase}
          onCancel={() => state.setShowDeleteCodebaseConfirm(false)}
          onConfirm={actions.handleRemoveCodebase}
        />
      )}

      {state.showReplaceAllConfirm && (
        <KanbanReplaceAllReposModal
          editRepoSelection={state.editRepoSelection}
          codebasesCount={codebases.length}
          recloneError={state.recloneError}
          replacingAll={state.replacingAll}
          onCancel={() => state.setShowReplaceAllConfirm(false)}
          onConfirm={actions.handleReplaceAllRepos}
        />
      )}

      <KanbanDeleteTaskModal
        deleteConfirmTask={state.deleteConfirmTask}
        isDeleting={state.isDeleting}
        onCancel={actions.cancelDeleteTask}
        onConfirm={actions.executeDeleteTask}
      />
      <KanbanMoveBlockedModal
        message={state.moveBlockedMessage}
        onClose={() => state.setMoveBlockedMessage(null)}
      />
    </div>
  );
}
