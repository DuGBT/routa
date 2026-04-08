"use client";

import { MarkdownViewer } from "@/client/components/markdown/markdown-viewer";
import { useTranslation } from "@/i18n";
import { KanbanDescriptionEditor } from "../kanban-description-editor";
import { DetailSection } from "./shared";

export interface DescriptionSectionProps {
  task: import("../../types").TaskInfo;
  compact: boolean;
  displayedObjective: string;
  displayedTestCases: string;
  editTestCases: string;
  isTestCasesEditing: boolean;
  onDescriptionEditingChange: (nextEditing: boolean) => void;
  onEditObjectiveInit: () => void;
  onDescriptionSave: (nextObjective: string) => Promise<void>;
  onTestCasesFocus: () => void;
  onTestCasesChange: (value: string) => void;
  onTestCasesBlur: () => void;
  testCasesInputRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function DescriptionSection({
  task,
  compact,
  displayedObjective,
  displayedTestCases,
  editTestCases,
  isTestCasesEditing,
  onDescriptionEditingChange,
  onEditObjectiveInit,
  onDescriptionSave,
  onTestCasesFocus,
  onTestCasesChange,
  onTestCasesBlur,
  testCasesInputRef,
}: DescriptionSectionProps) {
  const { t } = useTranslation();

  return (
    <>
      <section className={compact ? "space-y-2 border-b border-slate-200/80 py-2 dark:border-[#232736]" : "space-y-2 border-b border-slate-200/70 py-2.5 dark:border-[#232736]"}>
        <KanbanDescriptionEditor
          value={displayedObjective}
          compact={compact}
          onEditingChange={(nextEditing) => {
            if (nextEditing) {
              onEditObjectiveInit();
            }
            onDescriptionEditingChange(nextEditing);
          }}
          onSave={onDescriptionSave}
        />
      </section>

      <DetailSection
        title={t.kanbanDetail.progressNotes}
        description={compact ? undefined : t.kanbanDetail.progressNotesHint}
        compact={compact}
      >
        <div className={`border-b border-slate-200/70 py-2 dark:border-slate-700 ${compact ? "px-3" : "px-4"}`}>
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {t.kanbanDetail.appendedComments}
          </div>
          {task.comment?.trim() ? (
            <div className={compact ? "mt-2 px-3 py-2.5" : "mt-2 px-4 py-2.5"}>
              <MarkdownViewer
                content={task.comment}
                className="prose prose-sm max-w-none text-slate-800 dark:prose-invert dark:text-slate-200"
              />
            </div>
          ) : (
            <div className={`text-sm text-slate-500 dark:text-slate-400 ${compact ? "mt-2 px-3 py-2.5" : "mt-2 px-4 py-2.5"}`}>
              {t.kanbanDetail.noProgressNotesYet}
            </div>
          )}
        </div>
      </DetailSection>

      <DetailSection
        title={t.kanbanDetail.testCases}
        description={compact ? undefined : t.kanbanDetail.testCasesHint}
        compact={compact}
      >
        <textarea
          ref={testCasesInputRef}
          value={isTestCasesEditing ? editTestCases : displayedTestCases}
          onFocus={onTestCasesFocus}
          onChange={(event) => onTestCasesChange(event.target.value)}
          onBlur={onTestCasesBlur}
          rows={compact ? 4 : 5}
          placeholder={t.kanbanDetail.testCasesPlaceholder}
          className="focus:ring-offset-0 w-full border border-slate-200/80 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-transparent dark:text-slate-100"
        />
      </DetailSection>
    </>
  );
}
