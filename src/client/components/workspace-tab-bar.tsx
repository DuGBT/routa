"use client";

import { useTranslation } from "@/i18n";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type WorkspaceOverviewTab = "overview" | "notes" | "activity";

interface WorkspaceTabBarProps {
  activeTab: WorkspaceOverviewTab;
  notesCount: number;
  activityCount: number;
  onTabChange: (tab: WorkspaceOverviewTab) => void;
  className?: string;
}

export function WorkspaceTabBar({
  activeTab,
  notesCount,
  activityCount,
  onTabChange,
  className,
}: WorkspaceTabBarProps) {
  const { t } = useTranslation();

  return (
    <div className={className ?? ""} data-testid="workspace-tab-bar">
      <Tabs
        value={activeTab}
        onValueChange={(value) => onTabChange(value as WorkspaceOverviewTab)}
        className="w-full"
      >
        <TabsList variant="line" className="w-full border-b border-slate-300 dark:border-slate-700">
          <TabsTrigger value="overview" className="rounded-none px-3 py-1.5 text-[12px]">
            {t.workspace.overview}
          </TabsTrigger>
          <TabsTrigger value="notes" className="rounded-none px-3 py-1.5 text-[12px]">
            {t.workspace.notes}
            {notesCount > 0 && <span className="ml-1 text-[10px] opacity-60" data-testid="workspace-tab-count">({notesCount})</span>}
          </TabsTrigger>
          <TabsTrigger value="activity" className="rounded-none px-3 py-1.5 text-[12px]">
            {t.workspace.activity}
            {activityCount > 0 && <span className="ml-1 text-[10px] opacity-60" data-testid="workspace-tab-count">({activityCount})</span>}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
