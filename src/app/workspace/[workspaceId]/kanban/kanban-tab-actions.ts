"use client";

import { useCallback, useEffect } from "react";
import type { CodebaseData } from "@/client/hooks/use-workspaces";
import type { UseAcpState, UseAcpActions } from "@/client/hooks/use-acp";
import { resolveEffectiveTaskAutomation } from "@/core/kanban/effective-task-automation";
import type { GitHubIssueListItemInfo, GitHubPRListItemInfo, SessionInfo, TaskInfo, WorktreeInfo } from "../types";
import { EMPTY_DRAFT } from "../kanban-create-modal";
import type { ColumnAutomationConfig } from "./kanban-settings-modal";
import type { RepoSelection } from "@/client/components/repo-picker";
import type { KanbanSpecialistLanguage } from "./kanban-specialist-language";
import { buildKanbanTaskAgentPrompt } from "./i18n/kanban-task-agent";
import { scheduleKanbanRefreshBurst } from "./kanban-agent-input";
import { LIVE_SESSION_TAIL_POLL_MS } from "./kanban-tab-state";
import {
  canSelectTaskSessionInAcp,
  extractSessionLiveTail,
  getPreferredTaskSessionId,
  isA2ATaskSession,
  taskOwnsSession,
} from "./kanban-tab-helpers";
import { normalizeKanbanAutomation } from "@/core/models/kanban";

export interface KanbanTabActionsDeps {
  workspaceId: string;
  specialistLanguage: KanbanSpecialistLanguage;
  defaultBoardId: string | null;
  defaultCodebase: CodebaseData | null;
  allCodebaseIds: string[];
  codebases: CodebaseData[];
  acp?: UseAcpState & UseAcpActions;
  onAgentPrompt?: ((prompt: string, options: Record<string, unknown>) => Promise<string | undefined>) | undefined;
  onRefresh: () => void;
  resolveSpecialist: ReturnType<typeof import("./kanban-card-session-utils").createKanbanSpecialistResolver>;
  board: import("../types").KanbanBoardInfo | null;
  boardAutoProviderId: string | undefined;
  localTasks: TaskInfo[];
  sessionMap: Map<string, SessionInfo>;
  activeTask: TaskInfo | null;
  activeTaskId: string | null;
  activeSessionId: string | null;
  selectedBoardId: string | null;
  selectedCodebase: CodebaseData | null;
  editRepoSelection: RepoSelection | null;
  deletingBranchNames: string[];
  liveBranchInfo: { current: string; branches: string[] } | null;
  autoPatchedTasksRef: React.MutableRefObject<Set<string>>;
  sessionBackfillInFlightRef: React.MutableRefObject<Set<string>>;
  emptySessionRecoveryRef: React.MutableRefObject<string | null>;
  liveSessionTails: Record<string, string>;
  activeLiveSessionIds: string[];
  worktreeCache: Record<string, WorktreeInfo>;
  missingWorktreeIds: Record<string, true>;
  // State values needed by actions
  agentInput: string;
  agentLoading: boolean;
  agentSessionId: string | null;
  draft: import("../kanban-create-modal").TaskDraft;
  deleteConfirmTask: TaskInfo | null;
  // Setters
  setAgentInput: (input: string) => void;
  setAgentLoading: (loading: boolean) => void;
  setAgentSessionId: (id: string | null) => void;
  setAgentPanelOpen: (open: boolean) => void;
  setActiveSessionId: (id: string | null) => void;
  setActiveTaskId: (id: string | null) => void;
  setLocalTasks: React.Dispatch<React.SetStateAction<TaskInfo[]>>;
  setIsTaskDetailFullscreen: (fullscreen: boolean) => void;
  setLiveSessionTails: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setBackfilledSessions: React.Dispatch<React.SetStateAction<Record<string, SessionInfo>>>;
  setShowSettings: (show: boolean) => void;
  setSelectedCodebase: (codebase: CodebaseData | null) => void;
  setCodebaseWorktrees: React.Dispatch<React.SetStateAction<WorktreeInfo[]>>;
  setEditingCodebase: (editing: boolean) => void;
  setEditRepoSelection: (selection: RepoSelection | null) => void;
  setEditSaving: (saving: boolean) => void;
  setEditError: (error: string | null) => void;
  setRecloning: (recloning: boolean) => void;
  setRecloneError: (error: string | null) => void;
  setRecloneSuccess: (success: string | null) => void;
  setShowReplaceAllConfirm: (show: boolean) => void;
  setReplacingAll: (replacing: boolean) => void;
  setShowDeleteCodebaseConfirm: (show: boolean) => void;
  setDeletingCodebase: (deleting: boolean) => void;
  setDeletingWorktreeIds: React.Dispatch<React.SetStateAction<string[]>>;
  setDeletingBranchNames: React.Dispatch<React.SetStateAction<string[]>>;
  setBranchActionError: (error: string | null) => void;
  setWorktreeActionError: (error: string | null) => void;
  setLiveBranchInfo: (info: { current: string; branches: string[] } | null) => void;
  setWorktreeCache: React.Dispatch<React.SetStateAction<Record<string, WorktreeInfo>>>;
  setMissingWorktreeIds: React.Dispatch<React.SetStateAction<Record<string, true>>>;
  setColumnAutomation: React.Dispatch<React.SetStateAction<Record<string, ColumnAutomationConfig>>>;
  setVisibleColumns: React.Dispatch<React.SetStateAction<string[]>>;
  setDeleteConfirmTask: (task: TaskInfo | null) => void;
  setIsDeleting: (deleting: boolean) => void;
  setMoveError: (error: string | null) => void;
  setMoveBlockedMessage: (message: string | null) => void;
  setShowCreateModal: (show: boolean) => void;
  setShowGitHubImportModal: (show: boolean) => void;
  setDraft: React.Dispatch<React.SetStateAction<import("../kanban-create-modal").TaskDraft>>;
}

export function useKanbanTabActions(deps: KanbanTabActionsDeps) {
  const {
    workspaceId,
    specialistLanguage,
    defaultBoardId,
    defaultCodebase,
    allCodebaseIds,
    codebases,
    acp,
    onAgentPrompt,
    onRefresh,
    resolveSpecialist,
    board,
    boardAutoProviderId,
    localTasks,
    sessionMap,
    activeTask,
    activeTaskId,
    activeSessionId,
    selectedBoardId,
    selectedCodebase,
    editRepoSelection,
    deletingBranchNames,
    liveBranchInfo,
    autoPatchedTasksRef,
    sessionBackfillInFlightRef,
    emptySessionRecoveryRef,
    liveSessionTails,
    activeLiveSessionIds,
    worktreeCache,
    missingWorktreeIds,
    agentInput,
    agentLoading,
    agentSessionId,
    draft,
    deleteConfirmTask,
    setAgentInput,
    setAgentLoading,
    setAgentSessionId,
    setAgentPanelOpen,
    setActiveSessionId,
    setActiveTaskId,
    setLocalTasks,
    setIsTaskDetailFullscreen,
    setLiveSessionTails,
    setBackfilledSessions,
    setShowSettings,
    setSelectedCodebase,
    setCodebaseWorktrees,
    setEditingCodebase,
    setEditRepoSelection,
    setEditSaving,
    setEditError,
    setRecloning,
    setRecloneError,
    setRecloneSuccess,
    setShowReplaceAllConfirm,
    setReplacingAll,
    setShowDeleteCodebaseConfirm,
    setDeletingCodebase,
    setDeletingWorktreeIds,
    setDeletingBranchNames,
    setBranchActionError,
    setWorktreeActionError,
    setLiveBranchInfo,
    setWorktreeCache,
    setMissingWorktreeIds,
    setColumnAutomation,
    setVisibleColumns,
    setDeleteConfirmTask,
    setIsDeleting,
    setMoveError,
    setMoveBlockedMessage,
    setShowCreateModal,
    setShowGitHubImportModal,
    setDraft,
  } = deps;

  const patchTask = useCallback(async (taskId: string, payload: Record<string, unknown>) => {
    const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? "Failed to update task");
    }
    const updated = data.task as TaskInfo;
    setLocalTasks((current) => current.map((task) => (task.id === taskId ? updated : task)));
    return updated;
  }, [setLocalTasks]);

  const openAgentPanel = useCallback((sessionId: string) => {
    setAgentSessionId(sessionId);
    setAgentPanelOpen(true);
    acp?.selectSession(sessionId);
  }, [acp, setAgentPanelOpen, setAgentSessionId]);

  const persistBoardAutoProvider = useCallback(async (providerId: string | null | undefined) => {
    if (!board?.id) return;
    await fetch(`/api/kanban/boards/${encodeURIComponent(board.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoProviderId: providerId ?? "" }),
    });
  }, [board?.id]);

  const setKanbanBoardProvider = useCallback((providerId: string) => {
    if (!providerId) return;
    acp?.setProvider(providerId);
    if (board?.autoProviderId !== providerId) {
      void persistBoardAutoProvider(providerId).catch((error) => {
        console.error("[kanban] Failed to persist board auto provider:", error);
      });
    }
  }, [acp, board?.autoProviderId, persistBoardAutoProvider]);

  const handleAgentSubmit = useCallback(async () => {
    if (!deps.agentInput?.trim() || !onAgentPrompt || deps.agentLoading) return;
    setAgentLoading(true);
    try {
      const planningPrompt = buildKanbanTaskAgentPrompt({
        workspaceId,
        boardId: selectedBoardId ?? defaultBoardId ?? "default",
        repoPath: defaultCodebase?.repoPath,
        agentInput: deps.agentInput,
        language: specialistLanguage,
      });
      const sessionId = await onAgentPrompt(deps.agentInput, {
        provider: boardAutoProviderId,
        role: "CRAFTER",
        toolMode: "full",
        allowedNativeTools: [],
        mcpProfile: "kanban-planning",
        systemPrompt: planningPrompt,
      });
      if (!sessionId) return;
      openAgentPanel(sessionId);
      scheduleKanbanRefreshBurst(onRefresh);
      setAgentInput("");
    } catch (error) {
      console.error("[kanban] Failed to submit Kanban agent prompt:", error);
    } finally {
      setAgentLoading(false);
    }
  }, [deps.agentInput, deps.agentLoading, onAgentPrompt, boardAutoProviderId, defaultBoardId, defaultCodebase?.repoPath, onRefresh, openAgentPanel, selectedBoardId, specialistLanguage, workspaceId, setAgentInput, setAgentLoading]);

  const ensureBoardAutoProviderPersisted = useCallback(async () => {
    if (!board?.id || !boardAutoProviderId || board.autoProviderId === boardAutoProviderId) {
      return;
    }
    await persistBoardAutoProvider(boardAutoProviderId);
  }, [board?.autoProviderId, board?.id, boardAutoProviderId, persistBoardAutoProvider]);

  const ensureKanbanAgentSession = useCallback(async (
    cwd?: string,
    provider?: string,
    _modeId?: string,
    model?: string,
  ) => {
    if (!acp) return null;
    if (deps.agentSessionId) {
      return deps.agentSessionId;
    }
    const result = await acp.createSession(
      cwd ?? defaultCodebase?.repoPath,
      provider ?? boardAutoProviderId,
      undefined,
      "DEVELOPER",
      workspaceId,
      model,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "full",
      [],
    );
    if (!result?.sessionId) {
      return null;
    }
    openAgentPanel(result.sessionId);
    return result.sessionId;
  }, [acp, deps.agentSessionId, boardAutoProviderId, defaultCodebase?.repoPath, openAgentPanel, workspaceId]);

  const openTaskDetail = useCallback(async (task: TaskInfo) => {
    setActiveTaskId(task.id);
    const latestSession = getPreferredTaskSessionId(task);
    setActiveSessionId(latestSession ?? null);
    setIsTaskDetailFullscreen(false);
    if (task.codebaseIds?.length === 0 && defaultCodebase) {
      try {
        await patchTask(task.id, { codebaseIds: [defaultCodebase.id] });
      } catch (error) {
        console.error("Failed to auto-assign default repo to task", error);
      }
    }
    if (latestSession && acp && canSelectTaskSessionInAcp(task, latestSession, sessionMap)) {
      acp.selectSession(latestSession);
    }
  }, [acp, defaultCodebase, patchTask, sessionMap, setActiveSessionId, setActiveTaskId, setIsTaskDetailFullscreen]);

  const openSession = useCallback((sessionId: string | null, task?: TaskInfo | null) => {
    setActiveTaskId(null);
    setActiveSessionId(sessionId);
    setIsTaskDetailFullscreen(false);
    if (sessionId && acp && (
      task ? canSelectTaskSessionInAcp(task, sessionId, sessionMap) : sessionMap.has(sessionId)
    )) {
      acp.selectSession(sessionId);
    }
  }, [acp, sessionMap, setActiveSessionId, setActiveTaskId, setIsTaskDetailFullscreen]);

  const closeTaskDetail = useCallback(() => {
    setActiveTaskId(null);
    setActiveSessionId(null);
    setIsTaskDetailFullscreen(false);
  }, [setActiveSessionId, setActiveTaskId, setIsTaskDetailFullscreen]);

  const createTaskCard = useCallback(async () => {
    await ensureBoardAutoProviderPersisted();
    const effectiveCodebaseIds = deps.draft.codebaseIds.length > 0 ? deps.draft.codebaseIds : allCodebaseIds;
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        boardId: selectedBoardId ?? defaultBoardId,
        title: deps.draft.title,
        objective: deps.draft.objectiveHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
        testCases: deps.draft.testCases.split("\n").map((item) => item.trim()).filter(Boolean),
        priority: deps.draft.priority,
        labels: deps.draft.labels.split(",").map((label) => label.trim()).filter(Boolean),
        createGitHubIssue: deps.draft.createGitHubIssue,
        creationSource: "manual",
        repoPath: effectiveCodebaseIds.length > 0
          ? codebases.find((codebase) => codebase.id === effectiveCodebaseIds[0])?.repoPath
          : defaultCodebase?.repoPath,
        codebaseIds: effectiveCodebaseIds,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? "Failed to create task");
    }
    setLocalTasks((current) => [...current, data.task as TaskInfo]);
    setDraft({ ...EMPTY_DRAFT, objectiveHtml: "", createGitHubIssue: false });
    setShowCreateModal(false);
    onRefresh();
  }, [deps.draft, ensureBoardAutoProviderPersisted, allCodebaseIds, codebases, defaultBoardId, defaultCodebase?.repoPath, onRefresh, selectedBoardId, setDraft, setLocalTasks, setShowCreateModal, workspaceId]);

  const importGitHubIssues = useCallback(async (
    codebaseId: string,
    issues: GitHubIssueListItemInfo[],
    repo: string,
  ) => {
    await ensureBoardAutoProviderPersisted();
    const importedTasks: TaskInfo[] = [];
    for (const issue of issues) {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          boardId: selectedBoardId ?? defaultBoardId,
          columnId: "backlog",
          title: issue.title,
          objective: issue.body?.trim() || issue.title,
          labels: issue.labels,
          codebaseIds: [codebaseId],
          githubId: issue.id,
          githubNumber: issue.number,
          githubUrl: issue.url,
          githubRepo: repo,
          githubState: issue.state,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : `Failed to import GitHub issue #${issue.number}`,
        );
      }
      importedTasks.push(data.task as TaskInfo);
    }
    if (importedTasks.length > 0) {
      setLocalTasks((current) => {
        const next = [...current];
        const existingIds = new Set(current.map((task) => task.id));
        for (const task of importedTasks) {
          if (!existingIds.has(task.id)) {
            next.push(task);
          }
        }
        return next;
      });
      onRefresh();
    }
  }, [defaultBoardId, ensureBoardAutoProviderPersisted, onRefresh, selectedBoardId, setLocalTasks, workspaceId]);

  const importGitHubPulls = useCallback(async (
    codebaseId: string,
    pulls: GitHubPRListItemInfo[],
    repo: string,
  ) => {
    await ensureBoardAutoProviderPersisted();
    const importedTasks: TaskInfo[] = [];
    for (const pull of pulls) {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          boardId: selectedBoardId ?? defaultBoardId,
          columnId: "backlog",
          title: pull.title,
          objective: pull.body?.trim() || pull.title,
          labels: pull.labels,
          codebaseIds: [codebaseId],
          githubId: pull.id,
          githubNumber: pull.number,
          githubUrl: pull.url,
          githubRepo: repo,
          githubState: pull.state,
          isPullRequest: true,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : `Failed to import GitHub pull request #${pull.number}`,
        );
      }
      importedTasks.push(data.task as TaskInfo);
    }
    if (importedTasks.length > 0) {
      setLocalTasks((current) => {
        const next = [...current];
        const existingIds = new Set(current.map((task) => task.id));
        for (const task of importedTasks) {
          if (!existingIds.has(task.id)) {
            next.push(task);
          }
        }
        return next;
      });
      onRefresh();
    }
  }, [defaultBoardId, ensureBoardAutoProviderPersisted, onRefresh, selectedBoardId, setLocalTasks, workspaceId]);

  const retryTaskTrigger = useCallback(async (taskId: string) => {
    await ensureBoardAutoProviderPersisted();
    const task = localTasks.find((item) => item.id === taskId);
    const effectiveAutomation = task
      ? resolveEffectiveTaskAutomation(task, board?.columns ?? [], resolveSpecialist, {
        autoProviderId: boardAutoProviderId,
      })
      : undefined;
    const retryProviderId = task
      && effectiveAutomation?.source !== "card"
      && effectiveAutomation?.transport !== "a2a"
      && effectiveAutomation?.providerSource === "auto"
      && boardAutoProviderId
      ? boardAutoProviderId
      : undefined;
    const updated = await patchTask(taskId, {
      retryTrigger: true,
      ...(retryProviderId ? { retryProviderId } : {}),
    });
    if (updated.triggerSessionId) {
      setActiveSessionId(updated.triggerSessionId);
      if (acp) {
        acp.selectSession(updated.triggerSessionId);
      }
    }
    onRefresh();
  }, [acp, board?.columns, boardAutoProviderId, ensureBoardAutoProviderPersisted, localTasks, onRefresh, patchTask, resolveSpecialist, setActiveSessionId]);

  const confirmDeleteTask = useCallback((task: TaskInfo) => {
    setIsDeleting(false);
    setDeleteConfirmTask(task);
  }, [setDeleteConfirmTask, setIsDeleting]);

  const executeDeleteTask = useCallback(async () => {
    if (!deps.deleteConfirmTask) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(deps.deleteConfirmTask.id)}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete task");
      }
      setLocalTasks((current) => current.filter((task) => task.id !== deps.deleteConfirmTask!.id));
      setDeleteConfirmTask(null);
      closeTaskDetail();
      onRefresh();
    } catch (error) {
      console.error("Failed to delete task:", error);
    } finally {
      setIsDeleting(false);
    }
  }, [closeTaskDetail, deps.deleteConfirmTask, onRefresh, setDeleteConfirmTask, setIsDeleting, setLocalTasks]);

  const cancelDeleteTask = useCallback(() => {
    setDeleteConfirmTask(null);
    setIsDeleting(false);
  }, [setDeleteConfirmTask, setIsDeleting]);

  const moveTask = useCallback(async (taskId: string, targetColumnId: string) => {
    const movingTask = localTasks.find((task) => task.id === taskId);
    if (!movingTask) return;
    await ensureBoardAutoProviderPersisted();
    setMoveError(null);
    setMoveBlockedMessage(null);

    let shouldCleanupWorktree = false;
    if (targetColumnId === "done" && movingTask.worktreeId) {
      shouldCleanupWorktree = window.confirm(
        "This issue has an attached worktree. Clean it up now?"
      );
    }

    const boardTasksFiltered = localTasks.filter((task) => (task.boardId ?? defaultBoardId) === (selectedBoardId ?? defaultBoardId));
    const nextPosition = boardTasksFiltered.filter((task) => task.columnId === targetColumnId).length;
    const optimistic = localTasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            columnId: targetColumnId,
            position: nextPosition,
            status: targetColumnId === "dev" ? "IN_PROGRESS"
              : targetColumnId === "review" ? "REVIEW_REQUIRED"
              : targetColumnId === "blocked" ? "BLOCKED"
              : targetColumnId === "done" ? "COMPLETED"
              : "PENDING",
          }
        : task,
    );
    setLocalTasks(optimistic);

    try {
      let updated = await patchTask(taskId, { columnId: targetColumnId, position: nextPosition });
      if (shouldCleanupWorktree && movingTask.worktreeId) {
        const response = await fetch(`/api/worktrees/${encodeURIComponent(movingTask.worktreeId)}`, {
          method: "DELETE",
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error ?? "Failed to remove worktree");
        }
        updated = await patchTask(taskId, { worktreeId: null });
        setWorktreeCache((current) => {
          const next = { ...current };
          delete next[movingTask.worktreeId!];
          return next;
        });
      }
      if (updated.triggerSessionId && updated.triggerSessionId !== movingTask.triggerSessionId) {
        openSession(updated.triggerSessionId, updated);
      }
      setMoveError(null);
      onRefresh();
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Failed to move task";
      if (message.startsWith("Cannot move ")) {
        setMoveBlockedMessage(message);
        setMoveError(null);
      } else {
        setMoveError(message);
      }
      setLocalTasks(localTasks);
    }
  }, [defaultBoardId, ensureBoardAutoProviderPersisted, localTasks, onRefresh, openSession, patchTask, selectedBoardId, setLocalTasks, setMoveBlockedMessage, setMoveError, setWorktreeCache]);

  // Codebase edit handlers
  const handleStartEditCodebase = useCallback(() => {
    if (!selectedCodebase) return;
    setEditRepoSelection({
      path: selectedCodebase.repoPath,
      branch: selectedCodebase.branch ?? "",
      name: selectedCodebase.label ?? selectedCodebase.repoPath.split("/").pop() ?? "",
    });
    setEditError(null);
    setEditingCodebase(true);
  }, [selectedCodebase, setEditError, setEditRepoSelection, setEditingCodebase]);

  const handleRepoSelectionChange = useCallback(async (selection: RepoSelection | null) => {
    if (!selection || !selectedCodebase) return;
    setEditRepoSelection(selection);
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/codebases/${encodeURIComponent(selectedCodebase.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: selection.name, repoPath: selection.path, branch: selection.branch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update repository");
      setEditingCodebase(false);
      setSelectedCodebase(null);
      setCodebaseWorktrees([]);
      onRefresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update repository");
    } finally {
      setEditSaving(false);
    }
  }, [onRefresh, selectedCodebase, setCodebaseWorktrees, setEditError, setEditRepoSelection, setEditSaving, setEditingCodebase, setSelectedCodebase]);

  const handleCancelEditCodebase = useCallback(() => {
    setEditingCodebase(false);
    setEditRepoSelection(null);
    setEditError(null);
  }, [setEditError, setEditRepoSelection, setEditingCodebase]);

  const handleReclone = useCallback(async () => {
    if (!selectedCodebase?.sourceUrl) return;
    setRecloning(true);
    setRecloneError(null);
    setRecloneSuccess(null);
    try {
      const res = await fetch("/api/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: selectedCodebase.sourceUrl, force: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to re-clone repository");
      if (data.path && data.path !== selectedCodebase.repoPath) {
        await fetch(`/api/codebases/${encodeURIComponent(selectedCodebase.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repoPath: data.path, branch: data.branch }),
        });
      }
      setRecloneSuccess(`Repository re-cloned successfully${data.existed ? " (pulled latest)" : ""}`);
      onRefresh();
    } catch (err) {
      setRecloneError(err instanceof Error ? err.message : "Failed to re-clone repository");
    } finally {
      setRecloning(false);
    }
  }, [onRefresh, selectedCodebase, setRecloneError, setRecloneSuccess, setRecloning]);

  const handleReplaceAllRepos = useCallback(async () => {
    if (!selectedCodebase?.sourceUrl || !editRepoSelection) return;
    setReplacingAll(true);
    setRecloneError(null);
    try {
      const updatePromises = codebases.map(async (cb) => {
        const res = await fetch(`/api/codebases/${encodeURIComponent(cb.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repoPath: editRepoSelection.path,
            branch: editRepoSelection.branch,
            label: editRepoSelection.name,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? `Failed to update codebase ${cb.id}`);
        }
      });
      await Promise.all(updatePromises);
      setShowReplaceAllConfirm(false);
      setEditingCodebase(false);
      setSelectedCodebase(null);
      setCodebaseWorktrees([]);
      onRefresh();
    } catch (err) {
      setRecloneError(err instanceof Error ? err.message : "Failed to replace repositories");
    } finally {
      setReplacingAll(false);
    }
  }, [codebases, editRepoSelection, onRefresh, selectedCodebase, setCodebaseWorktrees, setEditingCodebase, setRecloneError, setReplacingAll, setSelectedCodebase, setShowReplaceAllConfirm]);

  const handleRemoveCodebase = useCallback(async () => {
    if (!selectedCodebase) return;
    setDeletingCodebase(true);
    setEditError(null);
    try {
      const res = await fetch(
        `/api/workspaces/${encodeURIComponent(workspaceId)}/codebases/${encodeURIComponent(selectedCodebase.id)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to remove repository");
      }
      setShowDeleteCodebaseConfirm(false);
      setSelectedCodebase(null);
      setCodebaseWorktrees([]);
      onRefresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to remove repository");
    } finally {
      setDeletingCodebase(false);
    }
  }, [onRefresh, selectedCodebase, setCodebaseWorktrees, setShowDeleteCodebaseConfirm, setDeletingCodebase, setEditError, setSelectedCodebase, workspaceId]);

  const fetchCodebaseWorktrees = useCallback(async (codebase: CodebaseData) => {
    setLiveBranchInfo(null);
    setBranchActionError(null);
    try {
      const res = await fetch(
        `/api/workspaces/${encodeURIComponent(workspaceId)}/codebases/${encodeURIComponent(codebase.id)}/worktrees`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        setCodebaseWorktrees(Array.isArray(data.worktrees) ? data.worktrees as WorktreeInfo[] : []);
      }
    } catch { /* ignore */ }
    try {
      const branchRes = await fetch(`/api/clone/branches?repoPath=${encodeURIComponent(codebase.repoPath)}`, { cache: "no-store" });
      if (branchRes.ok) {
        const branchData = await branchRes.json();
        setLiveBranchInfo({ current: branchData.current, branches: branchData.local || [] });
      }
    } catch { /* ignore */ }
  }, [setBranchActionError, setCodebaseWorktrees, setLiveBranchInfo, workspaceId]);

  const deleteIssueBranches = useCallback(async (branches: string[]) => {
    if (!selectedCodebase || branches.length === 0) return;
    const uniqueBranches = [...new Set(branches)];
    setBranchActionError(null);
    setDeletingBranchNames((current) => [...new Set([...current, ...uniqueBranches])]);
    let latestBranchInfo: { current: string; branches: string[] } | null = null;
    const failures: string[] = [];
    try {
      for (const branch of uniqueBranches) {
        const response = await fetch("/api/clone/branches", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repoPath: selectedCodebase.repoPath, branch }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !(data as { success?: boolean }).success) {
          failures.push((data as { error?: string }).error ?? `Failed to delete branch '${branch}'`);
          continue;
        }
        const nextCurrentBranch: string = latestBranchInfo?.current ?? liveBranchInfo?.current ?? selectedCodebase.branch ?? "";
        const nextBranches: string[] = latestBranchInfo?.branches ?? liveBranchInfo?.branches ?? [];
        latestBranchInfo = {
          current: typeof (data as { current?: string }).current === "string"
            ? (data as { current: string }).current
            : nextCurrentBranch,
          branches: Array.isArray((data as { branches?: unknown[] }).branches)
            ? (data as { branches: string[] }).branches
            : nextBranches,
        };
      }
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "Failed to delete branches");
    } finally {
      setDeletingBranchNames((current) => current.filter((name) => !uniqueBranches.includes(name)));
    }
    if (latestBranchInfo) {
      setLiveBranchInfo(latestBranchInfo);
    }
    if (failures.length > 0) {
      setBranchActionError(
        `Failed to delete ${failures.length} branch(es): ${failures.join("; ")}`,
      );
    }
  }, [liveBranchInfo, selectedCodebase, setBranchActionError, setDeletingBranchNames, setLiveBranchInfo]);

  const handleDeleteIssueBranch = useCallback(async (branch: string) => {
    const confirmed = window.confirm(`Remove branch "${branch}"?`);
    if (!confirmed) return;
    await deleteIssueBranches([branch]);
  }, [deleteIssueBranches]);

  const handleDeleteIssueBranches = useCallback(async (branches: string[]) => {
    if (branches.length === 0) return;
    const confirmed = window.confirm(`Remove ${branches.length} branch(es)?`);
    if (!confirmed) return;
    await deleteIssueBranches(branches);
  }, [deleteIssueBranches]);

  const handleDeleteCodebaseWorktrees = useCallback(async (worktrees: WorktreeInfo[]) => {
    if (worktrees.length === 0) return;
    const ids = [...new Set(worktrees.map((worktree) => worktree.id))];
    const worktreeIdSet = new Set(ids);
    setWorktreeActionError(null);
    setDeletingWorktreeIds(ids);
    try {
      for (const worktree of worktrees) {
        const linkedTasks = localTasks.filter((task) => task.worktreeId === worktree.id);
        await Promise.all(linkedTasks.map((task) => patchTask(task.id, { worktreeId: null })));
        const response = await fetch(`/api/worktrees/${encodeURIComponent(worktree.id)}`, {
          method: "DELETE",
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error((data as { error?: string }).error ?? "Failed to delete worktree");
        }
      }
      setLocalTasks((current) => current.map((task) => (
        task.worktreeId && worktreeIdSet.has(task.worktreeId)
          ? { ...task, worktreeId: undefined }
          : task
      )));
      setCodebaseWorktrees((current) => current.filter((item) => !worktreeIdSet.has(item.id)));
      setWorktreeCache((current) => {
        const next = { ...current };
        for (const id of ids) {
          delete next[id];
        }
        return next;
      });
    } catch (error) {
      setWorktreeActionError(error instanceof Error ? error.message : "Failed to delete worktree");
    } finally {
      setDeletingWorktreeIds([]);
    }
  }, [localTasks, patchTask, setCodebaseWorktrees, setDeletingWorktreeIds, setLocalTasks, setWorktreeActionError, setWorktreeCache]);

  return {
    patchTask,
    openAgentPanel,
    persistBoardAutoProvider,
    setKanbanBoardProvider,
    handleAgentSubmit,
    ensureBoardAutoProviderPersisted,
    ensureKanbanAgentSession,
    openTaskDetail,
    openSession,
    closeTaskDetail,
    createTaskCard,
    importGitHubIssues,
    importGitHubPulls,
    retryTaskTrigger,
    confirmDeleteTask,
    executeDeleteTask,
    cancelDeleteTask,
    moveTask,
    handleStartEditCodebase,
    handleRepoSelectionChange,
    handleCancelEditCodebase,
    handleReclone,
    handleReplaceAllRepos,
    handleRemoveCodebase,
    fetchCodebaseWorktrees,
    deleteIssueBranches,
    handleDeleteIssueBranch,
    handleDeleteIssueBranches,
    handleDeleteCodebaseWorktrees,
  };
}
