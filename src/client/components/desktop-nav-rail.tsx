"use client";

/**
 * Desktop Navigation Rail — Minimal vertical icon bar for Tauri app.
 *
 * A slim navigation rail that can be added to any page layout.
 * Provides consistent navigation across all desktop app pages.
 */

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/i18n";
import { SettingsPopupMenu } from "./settings-popup-menu";
import { Columns2, LayoutGrid, House, Share2 } from "lucide-react";


interface DesktopNavRailProps {
  workspaceId: string;
}

export function DesktopNavRail({
  workspaceId,
}: DesktopNavRailProps) {
  const pathname = usePathname();
  const { t } = useTranslation();

  const navItems = [
    {
      id: "home",
      label: t.nav.home,
      href: "/",
      icon: (
        <House className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}/>
      ),
    },
    {
      id: "kanban",
      label: t.nav.kanban,
      href: `/workspace/${workspaceId}/kanban`,
      icon: (
        <Columns2 className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}/>
      ),
    },
    {
      id: "overview",
      label: t.nav.overview,
      href: `/workspace/${workspaceId}/overview`,
      icon: (
        <LayoutGrid className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}/>
      ),
    },
    {
      id: "team",
      label: t.nav.team,
      href: `/workspace/${workspaceId}/team`,
      icon: (
        <Share2 className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}/>
      ),
    },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <aside
      className=" h-full w-12 shrink-0 flex flex-col border-r border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"
 data-testid="desktop-nav-rail"
    >
      <nav className="flex-1 flex flex-col items-center py-2 gap-0.5">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`
 relative w-10 h-10 flex items-center justify-center rounded-md transition-colors
 ${active
 ? "bg-blue-100 dark:bg-blue-900 text-blue-500"
 : "text-slate-700 dark:text-slate-400 hover:bg-blue-100 dark:bg-blue-900/70 hover:text-slate-900 dark:text-slate-200"
 }
              `}
              title={item.label}
            >
              {active && (
                <div className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-blue-500" />
              )}
              {item.icon}
            </Link>
          );
        })}
      </nav>
      <div className="mx-2 border-t border-slate-300 dark:border-slate-700" />
      <div className="flex flex-col items-center py-2 gap-0.5">
        <SettingsPopupMenu
          position="sidebar"
          showLabel={false}
          isActive={pathname === "/settings" || pathname.startsWith("/settings/")}
          buttonClassName="w-10 h-10 px-0 py-0 justify-center"
        />
      </div>
    </aside>
  );
}
