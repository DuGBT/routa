"use client";

import { useTranslation } from "@/i18n";
import { RefreshCw, Zap, ChartColumn, Settings } from "lucide-react";


type QuickStartAction = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
};

type HarnessQuickStartCardProps = {
  dimensionCount: number;
  metricCount?: number;
  hardGateCount?: number;
  hookCount?: number;
  workflowCount?: number;
  onNavigateToSection: (sectionId: string) => void;
};

export function HarnessQuickStartCard({
  dimensionCount,
  metricCount: _metricCount = 0,
  hardGateCount = 0,
  hookCount = 0,
  workflowCount = 0,
  onNavigateToSection,
}: HarnessQuickStartCardProps) {
  const { t } = useTranslation();

  const actions: QuickStartAction[] = [
    {
      id: "fitness",
      title: t.settings.harness.quickStart.viewQualityDimensions || "查看质量维度",
      description: `检查 Entrix Fitness 的 ${dimensionCount} 个维度`,
      icon: (
        <ChartColumn className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"/>
      ),
      onClick: () => onNavigateToSection("entrix-fitness"),
    },
    {
      id: "hooks",
      title: t.settings.harness.quickStart.reviewHooks || "审查 Hook 配置",
      description: `确认 ${hookCount} 个 runtime hooks`,
      icon: (
        <Settings className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"/>
      ),
      onClick: () => onNavigateToSection("hook-systems"),
    },
    {
      id: "cicd",
      title: t.settings.harness.quickStart.checkCICD || "检查 CI/CD 流程",
      description: `查看 ${workflowCount} 个 GitHub Actions workflows`,
      icon: (
        <RefreshCw className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"/>
      ),
      onClick: () => onNavigateToSection("ci-cd"),
    },
  ];

  const stats = [
    { label: "Fitness", value: dimensionCount, color: "emerald", section: "entrix-fitness" },
    { label: "Gates", value: hardGateCount, color: "amber", section: "entrix-fitness" },
    { label: "Hooks", value: hookCount, color: "blue", section: "hook-systems" },
    { label: "Workflows", value: workflowCount, color: "violet", section: "ci-cd" },
  ];

  const colorClasses = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    blue: "text-blue-600 dark:text-blue-400",
    violet: "text-violet-600 dark:text-violet-400",
  };

  const StatItem = ({ stat }: { stat: typeof stats[0] }) => (
    <button
      onClick={() => onNavigateToSection(stat.section)}
      className="flex items-center gap-2 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1.5 transition-colors hover:bg-blue-100 dark:bg-blue-900"
 >
      <div className={`text-[14px] font-bold leading-none ${colorClasses[stat.color as keyof typeof colorClasses]}`}>
        {stat.value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-slate-700 dark:text-slate-400">
        {stat.label}
      </div>
    </button>
  );

  return (
    <div className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Zap className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"/>
        <h2 className="text-[12px] font-semibold text-slate-900 dark:text-slate-200">
          {t.settings.harness.quickStart.title || "快速开始"}
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_auto]">
        {/* Left: Health Metrics */}
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {stats.map((stat) => (
            <StatItem key={stat.label} stat={stat} />
          ))}
        </div>

        {/* Right: Quick Actions */}
        <div className="flex flex-col gap-1.5">
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={action.onClick}
              className="group flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1.5 text-left transition-colors hover:bg-blue-100 dark:bg-blue-900"
 >
              <div className="shrink-0 text-blue-500">
                {action.icon}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold leading-tight text-slate-900 dark:text-slate-200">
                  {action.title}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
