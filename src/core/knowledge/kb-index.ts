/**
 * KB Index Builder
 *
 * Builds a search index from KB entries (sourced from fs wiki and/or workspace
 * notes with wikiFrontmatter). Uses a simple inverted-index approach
 * (no vector DB needed for <1000 entries).
 *
 * Two layers:
 *   1. `buildKbIndexFromEntries(entries)` — pure builder, source-agnostic
 *   2. `buildKbIndex(wikiDir)`            — fs-only convenience
 *      `buildHybridKbIndex({...})`        — workspace notes ∪ fs (workspace wins on slug clash)
 */

import fs from "fs";
import path from "path";
import type { KbIndex, KbEntry, KbEntryMeta, KbQueryResult } from "./types";
import { loadWikiEntries } from "./kb-frontmatter";
import { loadNoteKbEntries } from "./note-kb-source";
import type { NoteStore } from "../store/note-store";

const KB_INDEX_FILENAME = ".kb-index.json";

/** Stop words to exclude from the search index */
const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "can", "shall", "to", "of", "in", "for",
  "on", "with", "at", "by", "from", "as", "into", "through", "during",
  "before", "after", "above", "below", "between", "out", "off", "over",
  "under", "again", "further", "then", "once", "here", "there", "when",
  "where", "why", "how", "all", "each", "every", "both", "few", "more",
  "most", "other", "some", "such", "no", "nor", "not", "only", "own",
  "same", "so", "than", "too", "very", "just", "because", "but", "and",
  "or", "if", "while", "about", "up", "it", "its", "this", "that",
  "these", "those", "i", "me", "my", "we", "you", "your", "he", "him",
  "his", "she", "her", "they", "them", "their", "what", "which", "who",
]);

/** Tokenize text into lowercase search terms */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function entryToMeta(entry: KbEntry): KbEntryMeta {
  return {
    title: entry.title,
    slug: entry.slug,
    source_urls: entry.source_urls,
    last_compiled: entry.last_compiled,
    compiled_by: entry.compiled_by,
    health: entry.health,
    tags: entry.tags,
    summary: entry.summary,
    origin: entry.origin,
    sourceRef: entry.sourceRef,
  };
}

/**
 * Build a KbIndex from an arbitrary list of entries.
 * Source-agnostic — works for fs entries, note entries, or any union.
 */
export function buildKbIndexFromEntries(entries: KbEntry[]): KbIndex {
  const tagIndex: Record<string, string[]> = {};
  const searchIndex: Record<string, string[]> = {};

  for (const entry of entries) {
    for (const tag of entry.tags) {
      const normalized = tag.toLowerCase();
      tagIndex[normalized] = [...(tagIndex[normalized] ?? []), entry.slug];
    }

    const searchText = [entry.title, entry.summary, entry.tags.join(" ")].join(" ");
    const tokens = tokenize(searchText);
    for (const token of tokens) {
      searchIndex[token] = [...(searchIndex[token] ?? []), entry.slug];
    }
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    entries: entries.map(entryToMeta),
    tagIndex,
    searchIndex,
  };
}

/**
 * Build a KbIndex from all wiki entries in a directory (fs-only).
 */
export function buildKbIndex(wikiDir: string): KbIndex {
  return buildKbIndexFromEntries(loadWikiEntries(wikiDir));
}

/**
 * Build a workspace-aware hybrid KbIndex by merging:
 *   - workspace notes that carry wikiFrontmatter (primary)
 *   - repo-level fs wiki entries at docs/references/wiki/*.md (fallback baseline)
 *
 * Slug collisions are resolved with workspace-wins semantics: a workspace note
 * overrides any fs entry with the same slug.
 */
export async function buildHybridKbIndex(opts: {
  workspaceId: string;
  noteStore: NoteStore;
  repoRoot: string;
}): Promise<KbIndex> {
  const fsEntries = loadWikiEntries(getWikiDir(opts.repoRoot));
  const noteEntries = await loadNoteKbEntries(opts.noteStore, opts.workspaceId);

  const bySlug = new Map<string, KbEntry>();
  for (const entry of fsEntries) {
    bySlug.set(entry.slug, entry);
  }
  for (const entry of noteEntries) {
    bySlug.set(entry.slug, entry); // workspace overrides fs
  }

  return buildKbIndexFromEntries([...bySlug.values()]);
}

/**
 * Load or rebuild the fs-only KB index from disk.
 * Used as a fallback when no workspace context is available.
 */
export function loadKbIndex(repoRoot: string): KbIndex {
  const indexPath = path.join(repoRoot, "docs", "references", KB_INDEX_FILENAME);
  const wikiDir = path.join(repoRoot, "docs", "references", "wiki");

  if (fs.existsSync(indexPath)) {
    try {
      const cached: KbIndex = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
      if (cached.version === 1) {
        return cached;
      }
    } catch {
      // Corrupted index — rebuild
    }
  }

  const index = buildKbIndex(wikiDir);

  try {
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf-8");
  } catch {
    // Best-effort persist; continue with in-memory index
  }

  return index;
}

/**
 * Query a KbIndex for entries matching a query string.
 * Pure: relies on inline summary in the index, no fs round-trips.
 */
export function queryKb(index: KbIndex, query: string, tags?: string[], limit = 5): KbQueryResult {
  const queryTokens = tokenize(query);
  const tagSet = new Set((tags ?? []).map((t) => t.toLowerCase()));

  const scores = new Map<string, number>();

  for (const token of queryTokens) {
    const matching = index.searchIndex[token] ?? [];
    for (const slug of matching) {
      scores.set(slug, (scores.get(slug) ?? 0) + 1);
    }
  }

  for (const tag of tagSet) {
    const matching = index.tagIndex[tag] ?? [];
    for (const slug of matching) {
      scores.set(slug, (scores.get(slug) ?? 0) + 2);
    }
  }

  // Fuzzy fallback: tag substring matching
  if (scores.size === 0) {
    for (const token of queryTokens) {
      for (const [tag, slugs] of Object.entries(index.tagIndex)) {
        if (tag.includes(token) || token.includes(tag)) {
          for (const slug of slugs) {
            scores.set(slug, (scores.get(slug) ?? 0) + 1);
          }
        }
      }
    }
  }

  const ranked = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  const metaMap = new Map(index.entries.map((e) => [e.slug, e]));

  const matches = ranked
    .map(([slug, score]) => {
      const meta = metaMap.get(slug);
      if (!meta) return null;
      return {
        slug,
        title: meta.title,
        summary: meta.summary,
        tags: meta.tags,
        health: meta.health,
        score,
      };
    })
    .filter((m): m is NonNullable<typeof m> => Boolean(m));

  return { query, matches, total: index.entries.length };
}

/**
 * Rebuild and persist the fs-only KB index to disk.
 */
export function rebuildKbIndex(repoRoot: string): KbIndex {
  const indexPath = path.join(repoRoot, "docs", "references", KB_INDEX_FILENAME);
  const wikiDir = path.join(repoRoot, "docs", "references", "wiki");

  const index = buildKbIndex(wikiDir);

  try {
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf-8");
  } catch {
    // Best-effort
  }

  return index;
}

/** Path to the fs wiki directory */
export function getWikiDir(repoRoot: string): string {
  return path.join(repoRoot, "docs", "references", "wiki");
}

/** Path to the raw references directory */
export function getRawDir(repoRoot: string): string {
  return path.join(repoRoot, "docs", "references", "raw");
}
