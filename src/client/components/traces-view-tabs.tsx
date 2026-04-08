"use client";

import { useTranslation } from "@/i18n";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type TraceViewTab = "chat" | "event-bridge";

interface TracesViewTabsProps {
  activeTab: TraceViewTab;
  onTabChange: (tab: TraceViewTab) => void;
  className?: string;
}

export function TracesViewTabs({ activeTab, onTabChange, className }: TracesViewTabsProps) {
  const { t } = useTranslation();
  return (
    <div className={className ?? ""} data-testid="traces-view-tabs">
      <Tabs
        value={activeTab}
        onValueChange={(value) => onTabChange(value as TraceViewTab)}
      >
        <TabsList className="inline-flex items-center gap-0 p-0">
          <TabsTrigger
            value="chat"
            className="rounded-none px-3 py-1.5 text-[11px] font-semibold tracking-wide transition-all data-[state=active]:bg-blue-500 data-[state=active]:text-white"
          >
            {t.traces.chat}
          </TabsTrigger>
          <TabsTrigger
            value="event-bridge"
            className="rounded-none px-3 py-1.5 text-[11px] font-semibold tracking-wide transition-all data-[state=active]:bg-amber-500 data-[state=active]:text-white"
          >
            {t.traces.traceTab}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
