interface OverviewCardProps {
  className?: string;
  eyebrow: string;
  title: string;
  description: string;
  meta: string[];
  actionLabel: string;
  onAction: () => void;
}

export function OverviewCard({
  className,
  eyebrow,
  title,
  description,
  meta,
  actionLabel,
  onAction,
}: OverviewCardProps) {
  return (
    <section className={`rounded-[24px] border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-5 ${className ?? ""}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {eyebrow}
      </div>
      <div className="mt-3 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-200">
        {title}
      </div>
      <div className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-400">
        {description}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {meta.map((item) => (
          <span
            key={item}
            className="rounded-full border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-2.5 py-1 text-[11px] text-slate-700 dark:text-slate-400"
 >
            {item}
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={onAction}
        className="mt-5 rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-[12px] font-medium text-slate-700 dark:text-slate-400 transition-colors hover:bg-blue-100 dark:bg-blue-900 hover:text-slate-900 dark:text-slate-200"
 >
        {actionLabel}
      </button>
    </section>
  );
}
