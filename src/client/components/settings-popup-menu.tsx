"use client";

import Link from "next/link";
import React from "react";
import { Moon, Settings, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";

import { useTranslation, type Locale, SUPPORTED_LOCALES } from "@/i18n";
import {
  getStoredThemePreference,
  resolveThemePreference,
  setThemePreference,
  subscribeToThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from "@/client/utils/theme";


const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  zh: "\u4e2d\u6587",
};

const THEME_OPTIONS: ThemePreference[] = ["light", "dark", "system"];

interface SettingsPopupMenuProps {
  position?: "topbar" | "sidebar";
  showLabel?: boolean;
  isActive?: boolean;
  buttonClassName?: string;
  className?: string;
}

export function SettingsPopupMenu({
  position = "topbar",
  showLabel = false,
  isActive = false,
  buttonClassName,
  className,
}: SettingsPopupMenuProps) {
  const { t, locale, setLocale } = useTranslation();
  const themeSnapshot = React.useSyncExternalStore(
    (onStoreChange) => subscribeToThemePreference(() => onStoreChange()),
    () => {
      const nextThemePreference = getStoredThemePreference();
      const nextResolvedTheme = resolveThemePreference(nextThemePreference);
      return `${nextThemePreference}:${nextResolvedTheme}` as const;
    },
    () => "system:light",
  );
  const [themePreference, resolvedTheme] = themeSnapshot.split(":") as [ThemePreference, ResolvedTheme];

  const isTopbar = position === "topbar";
  const themeDotClass = resolvedTheme === "dark" ? "text-sky-300" : "text-amber-500";

  const getThemeLabel = (preference: ThemePreference) => {
    if (preference === "light") return t.settings.light;
    if (preference === "dark") return t.settings.dark;
    return t.settings.system;
  };

  return (
    <div className={className ?? ""}>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={`inline-flex items-center rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium transition-colors ${buttonClassName ?? "h-8 px-2 py-1"} ${
            isActive
              ? "bg-blue-100 dark:bg-blue-900 text-blue-500"
              : "text-slate-700 dark:text-slate-400 hover:border-blue-500/40 hover:text-slate-900 dark:text-slate-200 hover:bg-blue-100 dark:bg-blue-900/60"
          }`}
          aria-label={t.settings.title}
        >
          <Settings className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}/>
          {showLabel && (
            <>
              <span className="ml-1.5 mr-1.5">{t.settings.title}</span>
            </>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={isTopbar ? "end" : "center"}
          side={isTopbar ? "bottom" : "top"}
          className="min-w-48 text-[11px]"
        >
          <DropdownMenuItem
            className="font-semibold"
            render={<Link href="/settings" />}
          >
            {t.settings.title}
          </DropdownMenuItem>
          <DropdownMenuSeparator />

          {/* Language Switcher */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-[11px]">
              {t.settings.language}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-24 text-[11px]">
              <DropdownMenuGroup>
                {SUPPORTED_LOCALES.map((item) => {
                  const selected = item === locale;
                  return (
                    <DropdownMenuCheckboxItem
                      key={item}
                      checked={selected}
                      onCheckedChange={() => setLocale(item)}
                      className="text-[11px]"
                    >
                      {LOCALE_LABELS[item]}
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </DropdownMenuGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Theme Switcher */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-[11px]">
              {t.settings.theme}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-28 text-[11px]">
              <DropdownMenuGroup>
                {THEME_OPTIONS.map((option) => {
                  const active = themePreference === option;
                  return (
                    <DropdownMenuCheckboxItem
                      key={option}
                      checked={active}
                      onCheckedChange={() => setThemePreference(option)}
                      className="text-[11px]"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {option === "light" ? (
                          <Sun className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}/>
                        ) : option === "dark" ? (
                          <Moon className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}/>
                        ) : (
                          <span className={`inline-flex h-3 w-3 items-center justify-center rounded-full border border-current text-[8px] leading-none ${themeDotClass}`}>◉</span>
                        )}
                        <span>{getThemeLabel(option)}</span>
                      </span>
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </DropdownMenuGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
