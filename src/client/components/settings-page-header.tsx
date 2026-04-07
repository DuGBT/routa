"use client";

import type { ReactNode } from "react";

type SettingsPageHeaderProps = {
  title: string;
  description?: string;
  metadata?: Array<{ label: string; value: string }>;
  extra?: ReactNode;
};

export function SettingsPageHeader({
  title,
  description,
  metadata = [],
  extra,
}: SettingsPageHeaderProps) {
  return (
    <header className="mb-3 border-b border-slate-300 dark:border-slate-700 pb-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-semibold text-slate-900 dark:text-slate-200">{title}</h1>
          {description ? (
            <p className="mt-1 max-w-3xl text-[11px] leading-5 text-slate-700 dark:text-slate-400">{description}</p>
          ) : null}
          {extra ? <div className="mt-2">{extra}</div> : null}
        </div>

        {metadata.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {metadata.map((item) => (
              <div
                key={item.label}
                className="inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-2.5 py-1 text-[10px] font-medium text-slate-700 dark:text-slate-400"
 >
                <span className="opacity-70">{item.label}:</span>
                <span className="font-semibold">{item.value}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </header>
  );
}
