"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AcpProviderInfo } from "@/client/acp-client";
import type { CodebaseData } from "@/client/hooks/use-workspaces";
import type { UseAcpState, UseAcpActions } from "@/client/hooks/use-acp";
import {
  resolveEffectiveTaskAutomation,
} from "@/core/kanban/effective-task-automation";
import type {
  KanbanBoardInfo,
  SessionInfo,
  TaskInfo,
  WorktreeInfo,
} from "../types";
import { EMPTY_DRAFT, type TaskDraft } from "../kanban-create-modal";
import type { ColumnAutomationConfig } from "./kanban-settings-modal";
import type { RepoSelection } from "@/client/components/repo-picker";
import type { RepoSyncState } from "./kanban-repo-sync-status";
import type { KanbanRepoChanges } from "./kanban-file-changes-types";
import type { KanbanSpecialistLanguage } from "./kanban-specialist-language";
import { getKanbanTaskAgentCopy } from "./i18n/kanban-task-agent";
import { createKanbanSpecialistResolver } from "./kanban-card-session-utils";
import {
  getPreferredTaskSessionId,
  resolveKanbanBoardAutoProviderId,
  taskOwnsSession,
} from "./kanban-tab-helpers";
import type { KanbanAgentPromptHandler } from "../types";

export interface SpecialistOption {
  id: string;
  name: string;
  role: string;
  displayName?: string;
  defaultProvider?: string;
}

export interface KanbanTabProps {
  workspaceId: string;
  refreshSignal?: number;
  boards: KanbanBoardInfo[];
  tasks: TaskInfo[];
  sessions: SessionInfo[];
  providers: AcpProviderInfo[];
  specialists: SpecialistOption[];
  specialistLanguage?: KanbanSpecialistLanguage;
  onSpecialistLanguageChange?: (language: KanbanSpecialistLanguage) => void;
  codebases: CodebaseData[];
  onRefresh: () => void;
  repoSync?: RepoSyncState;
  repoChanges?: KanbanRepoChanges[];
  repoChangesLoading?: boolean;
  acp?: UseAcpState & UseAcpActions;
  onAgentPrompt?: KanbanAgentPromptHandler;
}

const KANBAN_DETAIL_SPLIT_RATIO_KEY = "routa:kanban-detail-split-ratio";
export const MIN_DETAIL_SPLIT_RATIO = 0.32;
export const MAX_DETAIL_SPLIT_RATIO = 0.72;
export const LIVE_SESSION_TAIL_POLL_MS = 2500;

export function useKanbanTabState(props: KanbanTabProps) {
  const {
    boards,
    tasks,
    sessions,
    providers,
    specialists,
    specialistLanguage = "en",
    codebases,
    acp,
  } = props;

  const kanbanTaskAgentCopy = getKanbanTaskAgentCopy(specialistLanguage);
  const resolveSpecialist = useMemo(
    () => createKanbanSpecialistResolver(specialists),
    [specialists],
  );
  const defaultBoardId = useMemo(
    () => boards.find((board) => board.isDefault)?.id ?? boards[0]?.id ?? null,
    [boards],
  );
  const allCodebaseIds = useMemo(
    () => codebases.map((codebase) => codebase.id),
    [codebases],
  );
  const defaultCodebase = useMemo(
    () => codebases.find((codebase) => codebase.isDefault) ?? codebases[0] ?? null,
    [codebases],
  );
  const githubImportEnabled = codebases.length > 0;
  const githubAvailable = Boolean(defaultCodebase?.sourceUrl?.includes("github.com"));

  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(defaultBoardId);
  const [localTasks, setLocalTasks] = useState<TaskInfo[]>(tasks);
  const autoPatchedTasksRef = useRef(new Set<string>());
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGitHubImportModal, setShowGitHubImportModal] = useState(false);
  const [draft, setDraft] = useState<TaskDraft>({
    ...EMPTY_DRAFT,
    createGitHubIssue: false,
  });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  // Agent input state
  const [agentInput, setAgentInput] = useState("");
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentSessionId, setAgentSessionId] = useState<string | null>(null);
  const [agentPanelOpen, setAgentPanelOpen] = useState(false);
  const [detailSplitRatio, setDetailSplitRatio] = useState(0.48);
  const [isDraggingDetailSplit, setIsDraggingDetailSplit] = useState(false);

  // Codebase detail popup state
  const [selectedCodebase, setSelectedCodebase] = useState<CodebaseData | null>(null);
  const [codebaseWorktrees, setCodebaseWorktrees] = useState<WorktreeInfo[]>([]);
  const [editingCodebase, setEditingCodebase] = useState(false);
  const [editRepoSelection, setEditRepoSelection] = useState<RepoSelection | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [recloning, setRecloning] = useState(false);
  const [recloneError, setRecloneError] = useState<string | null>(null);
  const [recloneSuccess, setRecloneSuccess] = useState<string | null>(null);
  const [showReplaceAllConfirm, setShowReplaceAllConfirm] = useState(false);
  const [replacingAll, setReplacingAll] = useState(false);
  const [showDeleteCodebaseConfirm, setShowDeleteCodebaseConfirm] = useState(false);
  const [deletingCodebase, setDeletingCodebase] = useState(false);
  const [deletingWorktreeIds, setDeletingWorktreeIds] = useState<string[]>([]);
  const [deletingBranchNames, setDeletingBranchNames] = useState<string[]>([]);
  const [branchActionError, setBranchActionError] = useState<string | null>(null);
  const [worktreeActionError, setWorktreeActionError] = useState<string | null>(null);
  const [liveBranchInfo, setLiveBranchInfo] = useState<{ current: string; branches: string[] } | null>(null);

  // Worktree cache
  const [worktreeCache, setWorktreeCache] = useState<Record<string, WorktreeInfo>>({});
  const [missingWorktreeIds, setMissingWorktreeIds] = useState<Record<string, true>>({});
  const [liveSessionTails, setLiveSessionTails] = useState<Record<string, string>>({});
  const [backfilledSessions, setBackfilledSessions] = useState<Record<string, SessionInfo>>({});

  // Settings state
  const [columnAutomation, setColumnAutomation] = useState<Record<string, ColumnAutomationConfig>>({});

  // Delete confirmation modal state
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<TaskInfo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [moveBlockedMessage, setMoveBlockedMessage] = useState<string | null>(null);
  const detailSplitContainerRef = useRef<HTMLDivElement | null>(null);
  const [isTaskDetailFullscreen, setIsTaskDetailFullscreen] = useState(false);
  const sessionBackfillInFlightRef = useRef(new Set<string>());
  const emptySessionRecoveryRef = useRef<string | null>(null);
  const previousPreferredTaskSessionIdRef = useRef<string | null>(null);

  // Derived state
  const sessionMap = useMemo(() => {
    const map = new Map<string, SessionInfo>();
    for (const session of sessions) {
      map.set(session.sessionId, session);
    }
    for (const [sessionId, session] of Object.entries(backfilledSessions)) {
      if (!map.has(sessionId)) {
        map.set(sessionId, session);
      }
    }
    return map;
  }, [backfilledSessions, sessions]);
  const combinedSessions = useMemo(
    () => Array.from(sessionMap.values()),
    [sessionMap],
  );
  const activeTask = useMemo(
    () => activeTaskId ? localTasks.find((task) => task.id === activeTaskId) ?? null : null,
    [activeTaskId, localTasks],
  );
  const preferredActiveTaskSessionId = useMemo(
    () => getPreferredTaskSessionId(activeTask),
    [activeTask],
  );
  const board = useMemo(
    () => boards.find((item) => item.id === selectedBoardId) ?? null,
    [boards, selectedBoardId],
  );
  const boardQueue = board?.queue;
  const boardAutoProviderId = useMemo(
    () => resolveKanbanBoardAutoProviderId(board, acp?.selectedProvider),
    [acp?.selectedProvider, board],
  );
  const activeTaskEffectiveAutomation = useMemo(
    () => activeTask
      ? resolveEffectiveTaskAutomation(activeTask, board?.columns ?? [], resolveSpecialist, {
        autoProviderId: boardAutoProviderId,
      })
      : null,
    [activeTask, board?.columns, boardAutoProviderId, resolveSpecialist],
  );
  const queuedPositions = boardQueue?.queuedPositions ?? {};

  // Effects
  useEffect(() => {
    if (typeof window === "undefined") return;
    const localStorageApi = window.localStorage;
    if (!localStorageApi || typeof localStorageApi.getItem !== "function") return;
    const stored = Number(localStorageApi.getItem(KANBAN_DETAIL_SPLIT_RATIO_KEY));
    if (!Number.isFinite(stored)) return;
    setDetailSplitRatio(Math.min(MAX_DETAIL_SPLIT_RATIO, Math.max(MIN_DETAIL_SPLIT_RATIO, stored)));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const localStorageApi = window.localStorage;
    if (!localStorageApi || typeof localStorageApi.setItem !== "function") return;
    localStorageApi.setItem(KANBAN_DETAIL_SPLIT_RATIO_KEY, String(detailSplitRatio));
  }, [detailSplitRatio]);

  useEffect(() => {
    if (!isDraggingDetailSplit) return;

    const handleMouseMove = (event: MouseEvent) => {
      const container = detailSplitContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) return;
      const nextRatio = (event.clientX - rect.left) / rect.width;
      setDetailSplitRatio(Math.min(MAX_DETAIL_SPLIT_RATIO, Math.max(MIN_DETAIL_SPLIT_RATIO, nextRatio)));
    };

    const handleMouseUp = () => setIsDraggingDetailSplit(false);

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingDetailSplit]);

  useEffect(() => {
    setSelectedBoardId(defaultBoardId);
  }, [defaultBoardId]);

  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    setBackfilledSessions((current) => {
      const next = { ...current };
      let changed = false;
      for (const session of sessions) {
        if (next[session.sessionId]) {
          delete next[session.sessionId];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [sessions]);

  useEffect(() => {
    if (!activeTaskId) return;
    const task = localTasks.find((t) => t.id === activeTaskId);
    const effectiveAutomation = task
      ? resolveEffectiveTaskAutomation(task, board?.columns ?? [], resolveSpecialist, {
        autoProviderId: boardAutoProviderId,
      })
      : null;
    if (task?.assignedProvider && effectiveAutomation?.source === "card" && acp?.setProvider) {
      acp.setProvider(task.assignedProvider);
    }
    // Only trigger when activeTaskId changes, not when acp changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTaskId]);

  useEffect(() => {
    if (!board?.id || !acp?.setProvider) return;
    if (activeTaskEffectiveAutomation?.source === "card") return;
    if (board.autoProviderId && acp.selectedProvider !== board.autoProviderId) {
      acp.setProvider(board.autoProviderId);
    }
  }, [acp, activeTaskEffectiveAutomation?.source, board?.autoProviderId, board?.id]);

  useEffect(() => {
    if (!activeTask) {
      previousPreferredTaskSessionIdRef.current = null;
      return;
    }
    if (!preferredActiveTaskSessionId) {
      previousPreferredTaskSessionIdRef.current = null;
      return;
    }
    const previousPreferredTaskSessionId = previousPreferredTaskSessionIdRef.current;
    setActiveSessionId((current) => {
      if (!current) return preferredActiveTaskSessionId;
      if (!taskOwnsSession(activeTask, current)) return preferredActiveTaskSessionId;
      if (current === preferredActiveTaskSessionId) return current;
      if (previousPreferredTaskSessionId && current === previousPreferredTaskSessionId) {
        return preferredActiveTaskSessionId;
      }
      return current;
    });
    previousPreferredTaskSessionIdRef.current = preferredActiveTaskSessionId;
  }, [activeTask, preferredActiveTaskSessionId]);

  useEffect(() => {
    if (board) {
      const columnsWithVisibility = board.columns.filter((col) =>
        col.visible !== undefined ? col.visible : true
      );
      setVisibleColumns(columnsWithVisibility.map((col) => col.id));
    }
  }, [board]);

  useEffect(() => {
    if (board) {
      const automation: Record<string, ColumnAutomationConfig> = {};
      for (const col of board.columns) {
        if (col.automation) {
          automation[col.id] = { ...col.automation };
        }
      }
      setColumnAutomation(automation);
    }
  }, [board]);

  const boardTasks = useMemo(() => {
    const effectiveBoardId = selectedBoardId ?? defaultBoardId;
    return localTasks
      .filter((task) => (task.boardId ?? defaultBoardId) === effectiveBoardId)
      .sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
  }, [defaultBoardId, localTasks, selectedBoardId]);

  const availableProviders = useMemo(() => {
    const uniqueProviders = new Map<string, AcpProviderInfo>();
    for (const provider of providers) {
      if (provider.status !== "available") continue;
      if (!uniqueProviders.has(provider.id)) {
        uniqueProviders.set(provider.id, provider);
      }
    }
    return Array.from(uniqueProviders.values());
  }, [providers]);

  const activeLiveSessionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const task of boardTasks) {
      if (!task.triggerSessionId) continue;
      const laneSession = task.laneSessions?.find((entry) => entry.sessionId === task.triggerSessionId);
      if (laneSession?.status !== "running") continue;
      const session = sessionMap.get(task.triggerSessionId);
      if (!session) continue;
      ids.add(task.triggerSessionId);
    }
    return Array.from(ids);
  }, [boardTasks, sessionMap]);

  const agentSession = agentSessionId ? sessionMap.get(agentSessionId) : undefined;
  const kanbanRepoSelection = useMemo<RepoSelection | null>(() => {
    if (!defaultCodebase) return null;
    return {
      path: defaultCodebase.repoPath,
      branch: defaultCodebase.branch ?? "",
      name: defaultCodebase.label ?? defaultCodebase.repoPath.split("/").pop() ?? "",
    };
  }, [defaultCodebase]);

  return {
    // Props-derived
    kanbanTaskAgentCopy,
    resolveSpecialist,
    defaultBoardId,
    allCodebaseIds,
    defaultCodebase,
    githubImportEnabled,
    githubAvailable,

    // Board state
    selectedBoardId,
    setSelectedBoardId,
    localTasks,
    setLocalTasks,
    autoPatchedTasksRef,
    dragTaskId,
    setDragTaskId,
    showCreateModal,
    setShowCreateModal,
    showGitHubImportModal,
    setShowGitHubImportModal,
    draft,
    setDraft,
    activeSessionId,
    setActiveSessionId,
    activeTaskId,
    setActiveTaskId,
    visibleColumns,
    setVisibleColumns,
    showSettings,
    setShowSettings,

    // Agent input state
    agentInput,
    setAgentInput,
    agentLoading,
    setAgentLoading,
    agentSessionId,
    setAgentSessionId,
    agentPanelOpen,
    setAgentPanelOpen,
    detailSplitRatio,
    setDetailSplitRatio,
    isDraggingDetailSplit,
    setIsDraggingDetailSplit,

    // Codebase detail popup state
    selectedCodebase,
    setSelectedCodebase,
    codebaseWorktrees,
    setCodebaseWorktrees,
    editingCodebase,
    setEditingCodebase,
    editRepoSelection,
    setEditRepoSelection,
    editSaving,
    setEditSaving,
    editError,
    setEditError,
    recloning,
    setRecloning,
    recloneError,
    setRecloneError,
    recloneSuccess,
    setRecloneSuccess,
    showReplaceAllConfirm,
    setShowReplaceAllConfirm,
    replacingAll,
    setReplacingAll,
    showDeleteCodebaseConfirm,
    setShowDeleteCodebaseConfirm,
    deletingCodebase,
    setDeletingCodebase,
    deletingWorktreeIds,
    setDeletingWorktreeIds,
    deletingBranchNames,
    setDeletingBranchNames,
    branchActionError,
    setBranchActionError,
    worktreeActionError,
    setWorktreeActionError,
    liveBranchInfo,
    setLiveBranchInfo,

    // Worktree cache
    worktreeCache,
    setWorktreeCache,
    missingWorktreeIds,
    setMissingWorktreeIds,
    liveSessionTails,
    setLiveSessionTails,
    backfilledSessions,
    setBackfilledSessions,

    // Settings state
    columnAutomation,
    setColumnAutomation,

    // Delete confirmation modal state
    deleteConfirmTask,
    setDeleteConfirmTask,
    isDeleting,
    setIsDeleting,
    moveError,
    setMoveError,
    moveBlockedMessage,
    setMoveBlockedMessage,

    // Refs
    detailSplitContainerRef,
    isTaskDetailFullscreen,
    setIsTaskDetailFullscreen,
    sessionBackfillInFlightRef,
    emptySessionRecoveryRef,
    previousPreferredTaskSessionIdRef,

    // Derived state
    sessionMap,
    combinedSessions,
    activeTask,
    preferredActiveTaskSessionId,
    board,
    boardQueue,
    boardAutoProviderId,
    activeTaskEffectiveAutomation,
    queuedPositions,
    boardTasks,
    availableProviders,
    activeLiveSessionIds,
    agentSession,
    kanbanRepoSelection,
  };
}
