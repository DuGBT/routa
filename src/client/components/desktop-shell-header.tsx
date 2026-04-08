"use client";

import React from "react";
import Link from "next/link";

import { useTranslation } from "@/i18n";
import { ShellHeaderControls } from "./shell-header-controls";
import { Folder } from "lucide-react";


interface DesktopShellHeaderProps {
  workspaceId?: string | null;
  workspaceTitle?: string;
  titleBarRight?: React.ReactNode;
  workspaceSwitcher?: React.ReactNode;
}

export function DesktopShellHeader({
  workspaceId,
  workspaceTitle,
  workspaceSwitcher,
  titleBarRight,
}: DesktopShellHeaderProps) {
  const { t } = useTranslation();
  const normalizedWorkspaceId = workspaceId?.trim() || null;
  const workspaceHref = normalizedWorkspaceId ? `/workspace/${normalizedWorkspaceId}` : null;
  const workspaceLabel = workspaceTitle ?? normalizedWorkspaceId ?? t.workspace.workspaces;

  return (
    <header
      className="h-10 shrink-0 flex items-center border-b border-slate-300 dark:border-slate-700 bg-slate-200 dark:bg-slate-700 backdrop-blur-md select-none"
 data-testid="desktop-shell-header"
    >
      <div className="w-20 h-full app-drag-region" />

      <div className="ml-3">
        {workspaceSwitcher ?? (
          workspaceHref ? (
          <Link
            href={workspaceHref}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 text-[11px] text-slate-900 dark:text-slate-200 transition-colors hover:bg-blue-100 dark:bg-blue-900"
 >
            <Folder className="w-3 h-3 text-slate-700 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}/>
            <span className="max-w-30 truncate">{workspaceLabel}</span>
          </Link>
          ) : (
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 text-[11px] text-slate-700 dark:text-slate-400">
              <Folder className="w-3 h-3 text-slate-700 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}/>
              <span className="max-w-30 truncate">{workspaceLabel}</span>
            </div>
          )
        )}
      </div>

      <div className="flex-1 app-drag-region h-full" />

      {titleBarRight ? (
        <div className="mr-2 flex items-center gap-2">
          {titleBarRight}
        </div>
      ) : null}

      <ShellHeaderControls className="px-2" showProtocolBadges={false} showSettingsMenu={false} compactStatus />
    </header>
  );
}
