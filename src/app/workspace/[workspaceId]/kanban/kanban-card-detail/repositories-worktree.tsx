"use client";

import type { CodebaseData } from "@/client/hooks/use-workspaces";
import type { SessionInfo, TaskInfo, WorktreeInfo } from "../../types";
import { useTranslation } from "@/i18n";
import { DetailSection } from "./shared";

export function RepositoriesWorktreeRow({
  task,
  codebases,
  allCodebaseIds,
  worktreeCache,
  sessionInfo,
  sessionCwdMismatch,
  updateError,
  setUpdateError,
  onPatchTask,
  onRefresh,
  onRepositoryChange,
  onSelectSession,
  compact = false,
}: {
  task: TaskInfo;
  codebases: CodebaseData[];
  allCodebaseIds: string[];
  worktreeCache: Record<string, WorktreeInfo>;
  sessionInfo?: SessionInfo | null;
  sessionCwdMismatch?: boolean;
  updateError: string | null;
  setUpdateError: (error: string | null) => void;
  onPatchTask: (taskId: string, payload: Record<string, unknown>) => Promise<TaskInfo>;
  onRefresh: () => void;
  onRepositoryChange?: (codebaseIds: string[]) => void;
  onSelectSession?: (sessionId: string) => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const currentCodebaseIds = task.codebaseIds && task.codebaseIds.length > 0 ? task.codebaseIds : allCodebaseIds;
  const primaryCodebase = codebases.find((codebase) => codebase.id === currentCodebaseIds[0]);
  const worktree = task.worktreeId ? worktreeCache[task.worktreeId] : null;
  const expectedPath = worktree?.worktreePath ?? primaryCodebase?.repoPath ?? null;
  const effectiveBranch = sessionInfo?.branch ?? worktree?.branch ?? primaryCodebase?.branch ?? null;
  const sessionRepoCodebase = sessionInfo ? codebases.find((codebase) => codebase.repoPath === sessionInfo.cwd) : undefined;
  const canAdoptSessionRepo = Boolean(
    sessionCwdMismatch
      && sessionRepoCodebase
      && currentCodebaseIds[0] !== sessionRepoCodebase.id,
  );
  const repoSummary = primaryCodebase
    ? `${primaryCodebase.label ?? primaryCodebase.repoPath.split("/").pop()}${currentCodebaseIds.length > 1 ? ` +${currentCodebaseIds.length - 1}` : ""}`
    : t.kanbanDetail.noRepoLinked;

  return (
    <DetailSection
      title={t.kanbanDetail.repositories}
      description={compact ? undefined : t.kanbanDetail.repositoriesHint}
      compact={compact}
    >
      <details className="group">
        <summary className={`flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden ${compact ? "text-[13px]" : "text-sm"}`}>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.kanbanDetail.repo}</div>
          {primaryCodebase ? (
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className={`h-2 w-2 shrink-0 rounded-full ${primaryCodebase.sourceType === "github" ? "bg-blue-500" : "bg-emerald-500"}`} />
              <span className="truncate text-slate-700 dark:text-slate-300">
                {repoSummary}
              </span>
            </div>
          ) : (
            <span className="min-w-0 flex-1 truncate text-xs text-slate-400 dark:text-slate-500">{repoSummary}</span>
          )}
          {worktree && (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
 worktree.status === "active"
 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
 : worktree.status === "creating"
 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
 : "bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300"
 }`}>
              {worktree.branch ?? worktree.status}
            </span>
          )}
          <span className="ml-auto text-xs text-slate-400 transition-colors group-hover:text-slate-600 dark:group-hover:text-slate-300">
            Edit
          </span>
        </summary>
        <div className={`space-y-3 border-l-2 border-slate-200 dark:border-slate-700 ${compact ? "mt-2.5 pl-2.5" : "mt-3 pl-3"}`}>
          {sessionInfo && (
            <div className={`border-l-2 px-3 py-2 ${sessionCwdMismatch
 ? "border-l-amber-400/80 dark:border-l-amber-600/70"
 : "border-l-emerald-400/80 dark:border-l-emerald-600/70"}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    Repo Health
                  </div>
                  <div className={`mt-1 text-xs ${sessionCwdMismatch ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                    {sessionCwdMismatch
                      ? "Active session is running in a different directory than this card."
                      : "Active session matches this card repo."}
                  </div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
 sessionCwdMismatch
 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
 : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
 }`}>
                  {sessionCwdMismatch ? "Session mismatch" : "Aligned"}
                </span>
              </div>
              <div className="mt-2 space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                {expectedPath && (
                  <div>
                    Expected: <span className="font-mono">{expectedPath}</span>
                  </div>
                )}
                <div>
                  Active session: <span className="font-mono">{sessionInfo.cwd}</span>
                </div>
                {effectiveBranch && (
                  <div>
                    Active branch: <span className="font-mono">{effectiveBranch}</span>
                    {worktree?.branch && sessionInfo?.branch && worktree.branch !== sessionInfo.branch && (
                      <span className="ml-2 text-amber-600 dark:text-amber-300">
                        worktree stored: {worktree.branch}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {sessionCwdMismatch && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {(sessionInfo?.sessionId ?? task.triggerSessionId) && onSelectSession && (
                    <button
                      type="button"
                      onClick={() => onSelectSession((sessionInfo?.sessionId ?? task.triggerSessionId)!)}
                      className="rounded border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:border-amber-400 hover:text-amber-800"
                    >
                      Open active session
                    </button>
                  )}
                  {canAdoptSessionRepo && sessionRepoCodebase && (
                    <button
                      type="button"
                      onClick={async () => {
                        setUpdateError(null);
                        try {
                          const nextCodebaseIds = [
                            sessionRepoCodebase.id,
                            ...currentCodebaseIds.filter((id) => id !== sessionRepoCodebase.id),
                          ];
                          await onPatchTask(task.id, { codebaseIds: nextCodebaseIds });
                          onRepositoryChange?.(nextCodebaseIds);
                          onRefresh();
                        } catch (error) {
                          setUpdateError(error instanceof Error ? error.message : "Failed to switch to the active session repo");
                        }
                      }}
                      className="rounded border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:border-amber-400 hover:text-amber-800"
                    >
                      Use session repo
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          {codebases.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">Edit linked repositories</div>
              <div className="flex flex-wrap gap-1.5">
                {codebases.map((codebase) => {
                  const selected = currentCodebaseIds.includes(codebase.id);
                  return (
                    <button
                      key={codebase.id}
                      type="button"
                      onClick={async () => {
                        setUpdateError(null);
                        try {
                          const nextCodebaseIds = selected
                            ? currentCodebaseIds.filter((id) => id !== codebase.id)
                            : [...currentCodebaseIds, codebase.id];
                          await onPatchTask(task.id, { codebaseIds: nextCodebaseIds });
                          onRepositoryChange?.(nextCodebaseIds);
                          onRefresh();
                        } catch (error) {
                          setUpdateError(error instanceof Error ? error.message : "Failed to update repositories");
                        }
                      }}
                      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] transition-colors ${
 selected
 ? "border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/20 dark:text-blue-300"
 : "border-slate-300 text-slate-600 hover:border-blue-300 dark:border-slate-600 dark:text-slate-400"
 }`}
                      data-testid="detail-repo-toggle"
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${codebase.sourceType === "github" ? "bg-blue-500" : "bg-emerald-500"}`} />
                      {codebase.label ?? codebase.repoPath.split("/").pop() ?? codebase.repoPath}
                    </button>
                  );
                })}
              </div>
              {updateError && (
                <div className="mt-1 text-xs text-rose-600 dark:text-rose-400">{updateError}</div>
              )}
            </div>
          )}
          {worktree && (
            <div data-testid="worktree-detail" className="truncate font-mono text-xs text-slate-500 dark:text-slate-500" title={worktree.worktreePath}>
              {worktree.worktreePath}
              {worktree.errorMessage && (
                <div className="mt-0.5 text-red-600 dark:text-red-400">{worktree.errorMessage}</div>
              )}
            </div>
          )}
        </div>
      </details>
    </DetailSection>
  );
}
