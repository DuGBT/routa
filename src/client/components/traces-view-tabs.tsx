"use client";

import React from "react";
import { useTranslation } from "@/i18n";
import { Button } from "./button";

export type TraceViewTab = "chat" | "event-bridge";

interface TracesViewTabsProps {
  activeTab: TraceViewTab;
  onTabChange: (tab: TraceViewTab) => void;
  className?: string;
}

const TAB_DEFINITIONS: Array<{ key: TraceViewTab; label: string; color: string }> = [
  { key: "chat", label: "traces:chat", color: "bg-blue-500" },
  { key: "event-bridge", label: "traces:traceTab", color: "bg-amber-500" },
];

export function TracesViewTabs({ activeTab, onTabChange, className }: TracesViewTabsProps) {
  const { t } = useTranslation();
  return (
    <div className={className ?? ""}>
      <div
        className="inline-flex items-center rounded-md border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5"
 data-testid="traces-view-tabs"
      >
        {TAB_DEFINITIONS.map(({ key, label: _label, color }) => (
          <Button
            key={key}
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => onTabChange(key)}
            className={`rounded-none px-3 py-1.5 text-[11px] font-semibold tracking-wide transition-all ${
 activeTab === key
 ? `${color} text-white`
                : "text-slate-700 dark:text-slate-400 hover:bg-blue-100 dark:bg-blue-900/70 hover:text-slate-900 dark:text-slate-200"
            }`}
          >
            {key === "chat" ? t.traces.chat : t.traces.traceTab}
          </Button>
        ))}
      </div>
    </div>
  );
}
