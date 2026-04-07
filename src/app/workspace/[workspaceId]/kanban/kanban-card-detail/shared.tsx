"use client";

import { type ReactNode } from "react";
import { Select } from "@/client/components/select";

export function DetailSection({
  title,
  description,
  children,
  compact = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <section className={compact ? "space-y-2 border-b border-slate-200/80 py-2 dark:border-[#232736]" : "space-y-2 border-b border-slate-200/70 py-2.5 dark:border-[#232736]"}>
      <div className={compact ? "mb-2" : "mb-3"}>
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{title}</div>
        {description && (
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</div>
        )}
      </div>
      {children}
    </section>
  );
}

export function MetaBadge({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 font-medium text-slate-700 dark:border-slate-700 dark:bg-[#0d1018] dark:text-slate-300 ${compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"}`}>
      <span className="uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</span>
      <span>{value}</span>
    </span>
  );
}

export function MetaSelect({
  label,
  value,
  options,
  onChange,
  compact = false,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => Promise<void>;
  compact?: boolean;
}) {
  return (
    <label className={`inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 font-medium text-slate-700 dark:border-slate-700 dark:bg-[#0d1018] dark:text-slate-300 ${compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]"}`}>
      <span className="uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</span>
      <Select
        value={value}
        onChange={(event) => {
          void onChange(event.target.value);
        }}
        className={`rounded-full bg-transparent font-medium text-slate-700 outline-none dark:text-slate-300 ${compact ? "pr-3 text-[10px]" : "pr-4 text-[11px]"}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </Select>
    </label>
  );
}

export function InlineSummary({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-3 border-b border-slate-200/70 px-1 ${compact ? "py-2" : "py-2.5"} dark:border-slate-700/60`}>
      <div className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
        {label}
      </div>
      <div className={`min-w-0 text-right font-medium text-slate-800 dark:text-slate-100 ${compact ? "text-[12px] leading-[1.1rem]" : "text-sm"}`}>
        {value}
      </div>
    </div>
  );
}

export function SummaryGridItem({
  label,
  value,
  detail,
  compact = false,
}: {
  label: string;
  value: string;
  detail?: string;
  compact?: boolean;
}) {
  return (
    <div className="space-y-0.5 border-b border-slate-200/70 px-1.5 py-1.5 text-sm dark:border-slate-700/60">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </div>
      <div className="font-medium text-slate-900 dark:text-slate-100">{value}</div>
      {detail && !compact && (
        <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">{detail}</div>
      )}
    </div>
  );
}
