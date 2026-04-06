"use client";

/**
 * Knowledge Base browse view — list workspace KB entries with search,
 * origin filter (workspace / shared / all), and inline detail panel.
 *
 * Backed by:
 *   GET /api/workspaces/[workspaceId]/knowledge          → list (metadata)
 *   GET /api/workspaces/[workspaceId]/knowledge/[slug]   → detail (full body)
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "@/i18n";
import { desktopAwareFetch } from "@/client/utils/diagnostics";
import { DesktopAppShell } from "@/client/components/desktop-app-shell";
import { BookOpen, ExternalLink, Loader2 } from "lucide-react";

type EntryOrigin = "fs" | "note";
type EntryHealth = "good" | "stale" | "broken" | "unknown";

interface KbListEntry {
  title: string;
  slug: string;
  summary: string;
  tags: string[];
  source_urls: string[];
  health: EntryHealth;
  origin: EntryOrigin;
  sourceRef: string;
  last_compiled: string;
  compiled_by: string;
}

interface KbDetailEntry {
  title: string;
  slug: string;
  tags: string[];
  sourceUrls: string[];
  health: EntryHealth;
  origin: EntryOrigin;
  sourceRef: string;
  body: string;
  crossRefs: string[];
  summary: string;
  lastCompiled: string;
  compiledBy: string;
}

type OriginFilter = "all" | "note" | "fs";

export function KnowledgePageClient() {
  const { t } = useTranslation();
  const params = useParams();
  const rawWorkspaceId = params.workspaceId as string;
  const workspaceId =
    rawWorkspaceId === "__placeholder__" && typeof window !== "undefined"
      ? (window.location.pathname.match(/^\/workspace\/([^/]+)/)?.[1] ?? rawWorkspaceId)
      : rawWorkspaceId;

  const [entries, setEntries] = useState<KbListEntry[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [originFilter, setOriginFilter] = useState<OriginFilter>("all");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const [detail, setDetail] = useState<KbDetailEntry | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Fetch list
  useEffect(() => {
    let cancelled = false;
    setListLoading(true);
    setListError(null);
    (async () => {
      try {
        const res = await desktopAwareFetch(
          `/api/workspaces/${encodeURIComponent(workspaceId)}/knowledge`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { entries?: KbListEntry[] };
        if (cancelled) return;
        setEntries(Array.isArray(data.entries) ? data.entries : []);
      } catch (err) {
        if (cancelled) return;
        setListError(err instanceof Error ? err.message : String(err));
        setEntries([]);
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  // Fetch detail when a slug is selected
  useEffect(() => {
    if (!selectedSlug) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);
    (async () => {
      try {
        const res = await desktopAwareFetch(
          `/api/workspaces/${encodeURIComponent(workspaceId)}/knowledge/${encodeURIComponent(selectedSlug)}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { entry?: KbDetailEntry };
        if (cancelled) return;
        setDetail(data.entry ?? null);
      } catch (err) {
        if (cancelled) return;
        setDetailError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, selectedSlug]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return entries
      .filter((e) => originFilter === "all" || e.origin === originFilter)
      .filter((e) => {
        if (!needle) return true;
        if (e.title.toLowerCase().includes(needle)) return true;
        if (e.summary.toLowerCase().includes(needle)) return true;
        if (e.slug.toLowerCase().includes(needle)) return true;
        return e.tags.some((tag) => tag.toLowerCase().includes(needle));
      })
      .sort((a, b) => {
        // Workspace entries first, then alphabetical
        if (a.origin !== b.origin) return a.origin === "note" ? -1 : 1;
        return a.title.localeCompare(b.title);
      });
  }, [entries, search, originFilter]);

  const handleSelectSlug = useCallback((slug: string) => {
    setSelectedSlug((current) => (current === slug ? current : slug));
  }, []);

  return (
    <DesktopAppShell workspaceId={workspaceId}>
      <div className="flex h-full flex-col overflow-hidden bg-desktop-bg-primary">
        <div className="border-b border-desktop-border bg-desktop-bg-secondary px-6 py-5">
          <div className="flex items-center gap-3">
            <BookOpen
              className="h-5 w-5 text-desktop-text-secondary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            />
            <div>
              <h1 className="text-lg font-semibold text-desktop-text-primary">{t.knowledge.title}</h1>
              <p className="mt-0.5 text-xs text-desktop-text-muted">{t.knowledge.description}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.knowledge.searchPlaceholder}
              className="flex-1 min-w-[240px] rounded-lg border border-desktop-border bg-desktop-bg-primary px-3 py-2 text-[13px] text-desktop-text-primary outline-none focus:ring-2 focus:ring-amber-500/30"
            />
            <OriginFilterTabs value={originFilter} onChange={setOriginFilter} />
          </div>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* List pane */}
          <aside className="w-80 shrink-0 overflow-y-auto border-r border-desktop-border bg-desktop-bg-secondary">
            {listLoading ? (
              <div className="flex items-center justify-center py-12 text-desktop-text-muted">
                <Loader2
                  className="h-4 w-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                />
                <span className="ml-2 text-[12px]">{t.knowledge.loading}</span>
              </div>
            ) : listError ? (
              <div className="p-6 text-center">
                <p className="text-sm text-red-500 dark:text-red-400">{t.knowledge.loadFailed}</p>
                <p className="mt-1 text-[11px] text-desktop-text-muted">{listError}</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center">
                <BookOpen
                  className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1}
                />
                <p className="text-sm font-medium text-desktop-text-secondary">{t.knowledge.empty}</p>
                <p className="mt-1 text-[11px] text-desktop-text-muted">{t.knowledge.emptyDescription}</p>
              </div>
            ) : (
              <ul className="divide-y divide-desktop-border">
                {filtered.map((entry) => (
                  <li key={entry.slug}>
                    <button
                      type="button"
                      onClick={() => handleSelectSlug(entry.slug)}
                      className={`block w-full px-4 py-3 text-left transition-colors hover:bg-desktop-bg-active ${
                        selectedSlug === entry.slug ? "bg-desktop-bg-active" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex-1 truncate text-[13px] font-medium text-desktop-text-primary">
                          {entry.title}
                        </span>
                        <OriginBadge origin={entry.origin} />
                      </div>
                      {entry.summary && (
                        <p className="mt-1 line-clamp-2 text-[11px] text-desktop-text-muted">
                          {entry.summary}
                        </p>
                      )}
                      {entry.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {entry.tags.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          {/* Detail pane */}
          <main className="flex-1 overflow-y-auto bg-desktop-bg-primary">
            {!selectedSlug ? (
              <EmptyDetailState
                title={t.knowledge.notSelected}
                description={t.knowledge.notSelectedDescription}
              />
            ) : detailLoading ? (
              <div className="flex h-full items-center justify-center text-desktop-text-muted">
                <Loader2
                  className="h-4 w-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                />
                <span className="ml-2 text-[12px]">{t.knowledge.loading}</span>
              </div>
            ) : detailError ? (
              <div className="p-8 text-center">
                <p className="text-sm text-red-500 dark:text-red-400">{t.knowledge.detailLoadFailed}</p>
                <p className="mt-1 text-[11px] text-desktop-text-muted">{detailError}</p>
              </div>
            ) : detail ? (
              <KbDetailView entry={detail} />
            ) : null}
          </main>
        </div>
      </div>
    </DesktopAppShell>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

function OriginFilterTabs({
  value,
  onChange,
}: {
  value: OriginFilter;
  onChange: (next: OriginFilter) => void;
}) {
  const { t } = useTranslation();
  const items: { id: OriginFilter; label: string }[] = [
    { id: "all", label: t.knowledge.filterAll },
    { id: "note", label: t.knowledge.filterWorkspace },
    { id: "fs", label: t.knowledge.filterShared },
  ];
  return (
    <div className="inline-flex rounded-lg border border-desktop-border bg-desktop-bg-primary p-0.5">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`px-3 py-1.5 text-[12px] font-medium transition-colors rounded-md ${
            value === item.id
              ? "bg-amber-500 text-white shadow-sm"
              : "text-desktop-text-secondary hover:text-desktop-text-primary"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function OriginBadge({ origin }: { origin: EntryOrigin }) {
  const { t } = useTranslation();
  const isWorkspace = origin === "note";
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
        isWorkspace
          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
      }`}
    >
      {isWorkspace ? t.knowledge.originWorkspace : t.knowledge.originShared}
    </span>
  );
}

function HealthBadge({ health }: { health: EntryHealth }) {
  const { t } = useTranslation();
  const map = {
    good: { label: t.knowledge.healthGood, cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    stale: { label: t.knowledge.healthStale, cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    broken: { label: t.knowledge.healthBroken, cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    unknown: { label: t.knowledge.healthUnknown, cls: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" },
  };
  const { label, cls } = map[health];
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{label}</span>
  );
}

function EmptyDetailState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center text-desktop-text-muted">
      <BookOpen
        className="mb-4 h-12 w-12 text-slate-300 dark:text-slate-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1}
      />
      <p className="text-sm font-medium text-desktop-text-secondary">{title}</p>
      <p className="mt-1 max-w-sm text-[12px]">{description}</p>
    </div>
  );
}

function KbDetailView({ entry }: { entry: KbDetailEntry }) {
  const { t } = useTranslation();
  return (
    <article className="mx-auto max-w-3xl px-8 py-8">
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <h2 className="flex-1 text-2xl font-semibold text-desktop-text-primary">{entry.title}</h2>
          <HealthBadge health={entry.health} />
          <OriginBadge origin={entry.origin} />
        </div>
        <p className="mt-1 font-mono text-[11px] text-desktop-text-muted">{entry.slug}</p>
        {entry.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {entry.tags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] text-desktop-text-muted">
          {entry.lastCompiled && entry.lastCompiled !== "unknown" && (
            <>
              <dt className="font-semibold uppercase tracking-wider">{t.knowledge.lastCompiled}</dt>
              <dd className="font-mono">{entry.lastCompiled}</dd>
            </>
          )}
          {entry.compiledBy && entry.compiledBy !== "unknown" && (
            <>
              <dt className="font-semibold uppercase tracking-wider">{t.knowledge.compiledBy}</dt>
              <dd className="font-mono">{entry.compiledBy}</dd>
            </>
          )}
        </dl>
      </header>

      {entry.sourceUrls.length > 0 && (
        <section className="mb-6">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-desktop-text-muted">
            {t.knowledge.sourceUrls}
          </h3>
          <ul className="space-y-1">
            {entry.sourceUrls.map((url) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[12px] text-amber-600 hover:underline dark:text-amber-400"
                >
                  <span className="font-mono">{url}</span>
                  <ExternalLink className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-6">
        <pre className="whitespace-pre-wrap rounded-lg border border-desktop-border bg-desktop-bg-secondary p-4 font-mono text-[12px] leading-relaxed text-desktop-text-primary">
          {entry.body || "(empty)"}
        </pre>
      </section>

      {entry.crossRefs.length > 0 && (
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-desktop-text-muted">
            {t.knowledge.crossRefs}
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            {entry.crossRefs.map((slug) => (
              <li
                key={slug}
                className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              >
                [[{slug}]]
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
