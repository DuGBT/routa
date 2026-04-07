"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import type { TaskInfo } from "../../types";
import { useTranslation } from "@/i18n";
import { MetaSelect, MetaBadge } from "./shared";

export interface CardDetailHeaderProps {
  task: TaskInfo;
  compact: boolean;
  editTitle: string;
  isTitleEditing: boolean;
  editPriority: string;
  orderedSessionIds: string[];
  onTitleFocus: () => void;
  onTitleChange: (value: string) => void;
  onTitleBlur: () => void;
  onPriorityChange: (value: string) => Promise<void>;
  onRefresh: () => void;
  onToggleFullscreen?: (next: boolean) => void;
  isFullscreen: boolean;
  titleInputRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function CardDetailHeader({
  task,
  compact,
  editTitle,
  isTitleEditing,
  editPriority,
  orderedSessionIds,
  onTitleFocus,
  onTitleChange,
  onTitleBlur,
  onPriorityChange,
  onRefresh,
  onToggleFullscreen,
  isFullscreen,
  titleInputRef,
}: CardDetailHeaderProps) {
  const { t } = useTranslation();
  const displayedTitle = isTitleEditing ? editTitle : task.title;

  return (
    <section className={`border-b border-slate-200/80 pb-3 dark:border-[#232736] ${compact ? "pt-0.5" : "pt-1"}`}>
      <div className={`flex items-center justify-between gap-3 ${compact ? "mb-1.5" : "mb-2"}`}>
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
          {t.kanbanDetail.cardDetail}
        </div>
        <div className="flex items-center gap-1.5">
          {onToggleFullscreen ? (
            <button
              type="button"
              onClick={() => onToggleFullscreen(!isFullscreen)}
              className="inline-flex h-6 w-6 items-center justify-center border border-slate-300/80 text-slate-500 transition-colors hover:border-amber-400 hover:text-amber-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-amber-700 dark:hover:text-amber-200"
              aria-label={isFullscreen ? t.kanbanDetail.exitFullscreen : t.kanbanDetail.enterFullscreen}
              title={isFullscreen ? t.kanbanDetail.exitFullscreen : t.kanbanDetail.enterFullscreen}
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 transition-colors hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 dark:border-slate-700 dark:bg-[#0d1018] dark:text-slate-300 dark:hover:border-amber-700 dark:hover:bg-amber-900/20 dark:hover:text-amber-200"
          >
            {t.common.refresh}
          </button>
        </div>
      </div>
      <textarea
        ref={titleInputRef}
        value={displayedTitle}
        onFocus={onTitleFocus}
        onChange={(event) => onTitleChange(event.target.value)}
        onBlur={onTitleBlur}
        rows={isTitleEditing ? 2 : 1}
        className={`w-full resize-none border-0 bg-transparent px-0 py-0 font-semibold leading-tight text-slate-950 outline-none focus:border-transparent focus:ring-0 dark:text-slate-50 ${compact ? "text-lg" : "text-xl"}`}
      />
      <div className={`flex flex-wrap items-center ${compact ? "mt-2 gap-1.5" : "mt-3 gap-2"}`}>
        <MetaSelect
          label={t.kanbanDetail.priority}
          value={editPriority}
          compact={compact}
          options={[
            { value: "low", label: t.kanbanDetail.low },
            { value: "medium", label: t.kanbanDetail.medium },
            { value: "high", label: t.kanbanDetail.high },
            { value: "urgent", label: t.kanbanDetail.urgent },
          ]}
          onChange={onPriorityChange}
        />
        <MetaBadge label="Column" value={task.columnId ?? "backlog"} compact={compact} />
        {orderedSessionIds.length > 0 && (
          <MetaBadge label="Runs" value={String(orderedSessionIds.length)} compact={compact} />
        )}
        {task.githubNumber && (
          <MetaBadge label="GitHub" value={`#${task.githubNumber}`} compact={compact} />
        )}
        {(task.labels ?? []).map((label) => (
          <span
            key={label}
            className={`inline-flex items-center rounded-full border border-amber-200 bg-amber-50 font-medium text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-200 ${compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"}`}
          >
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}
