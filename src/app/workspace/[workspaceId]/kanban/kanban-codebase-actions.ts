"use client";

import { useCallback } from "react";
import type { CodebaseData } from "@/client/hooks/use-workspaces";
import type { TaskInfo, WorktreeInfo } from "../types";
import type { RepoSelection } from "@/client/components/repo-picker";

export interface KanbanCodebaseActionsDeps {
  workspaceId: string;
  codebases: CodebaseData[];
  selectedCodebase: CodebaseData | null;
  editRepoSelection: RepoSelection | null;
  liveBranchInfo: { current: string; branches: string[] } | null;
  deletingBranchNames: string[];
  localTasks: TaskInfo[];
  onRefresh: () => void;
  patchTask: (taskId: string, payload: Record<string, unknown>) => Promise<TaskInfo>;
  setLocalTasks: React.Dispatch<React.SetStateAction<TaskInfo[]>>;
  setEditRepoSelection: (selection: RepoSelection | null) => void;
  setEditSaving: (saving: boolean) => void;
  setEditError: (error: string | null) => void;
  setEditingCodebase: (editing: boolean) => void;
  setSelectedCodebase: (codebase: CodebaseData | null) => void;
  setCodebaseWorktrees: React.Dispatch<React.SetStateAction<WorktreeInfo[]>>;
  setRecloning: (recloning: boolean) => void;
  setRecloneError: (error: string | null) => void;
  setRecloneSuccess: (success: string | null) => void;
  setReplacingAll: (replacing: boolean) => void;
  setShowReplaceAllConfirm: (show: boolean) => void;
  setShowDeleteCodebaseConfirm: (show: boolean) => void;
  setDeletingCodebase: (deleting: boolean) => void;
  setDeletingWorktreeIds: React.Dispatch<React.SetStateAction<string[]>>;
  setDeletingBranchNames: React.Dispatch<React.SetStateAction<string[]>>;
  setBranchActionError: (error: string | null) => void;
  setWorktreeActionError: (error: string | null) => void;
  setLiveBranchInfo: (info: { current: string; branches: string[] } | null) => void;
  setWorktreeCache: React.Dispatch<React.SetStateAction<Record<string, WorktreeInfo>>>;
}

export function useKanbanCodebaseActions(deps: KanbanCodebaseActionsDeps) {
  const {
    workspaceId,
    codebases,
    selectedCodebase,
    editRepoSelection,
    liveBranchInfo,
    deletingBranchNames,
    localTasks,
    onRefresh,
    patchTask,
    setLocalTasks,
    setEditRepoSelection,
    setEditSaving,
    setEditError,
    setEditingCodebase,
    setSelectedCodebase,
    setCodebaseWorktrees,
    setRecloning,
    setRecloneError,
    setRecloneSuccess,
    setReplacingAll,
    setShowReplaceAllConfirm,
    setShowDeleteCodebaseConfirm,
    setDeletingCodebase,
    setDeletingWorktreeIds,
    setDeletingBranchNames,
    setBranchActionError,
    setWorktreeActionError,
    setLiveBranchInfo,
    setWorktreeCache,
  } = deps;

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
