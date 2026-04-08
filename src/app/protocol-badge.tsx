export function ProtocolBadge({
  name,
  endpoint,
}: {
  name: string;
  endpoint: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-400">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      {name}
      <span className="font-mono text-[10px] text-slate-400">
        {endpoint}
      </span>
    </div>
  );
}
