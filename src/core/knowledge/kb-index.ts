/**
 * KB Index Builder
 *
 * Builds a search index from wiki/*.md entries.
 * Uses simple inverted-index approach (no vector DB needed for <1000 entries).
 */

import fs from "fs";
import path from "path";
import type { KbIndex, KbEntryMeta, KbQueryResult } from "./types";
import { loadWikiEntries, parseWikiEntry } from "./kb-frontmatter";

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

/** Extract entry metadata from a full KbEntry */
function entryToMeta(entry: { title: string; slug: string; source_urls: string[]; last_compiled: string; compiled_by: string; health: string; tags: string[] }): KbEntryMeta {
  return {
    title: entry.title,
    slug: entry.slug,
    source_urls: entry.source_urls,
    last_compiled: entry.last_compiled,
    compiled_by: entry.compiled_by,
    health: entry.health as KbEntryMeta["health"],
    tags: entry.tags,
  };
}

/**
 * Build a KbIndex from all wiki entries in a directory.
 */
export function buildKbIndex(wikiDir: string): KbIndex {
  const entries = loadWikiEntries(wikiDir);

  const tagIndex: Record<string, string[]> = {};
  const searchIndex: Record<string, string[]> = {};

  for (const entry of entries) {
    // Tag index
    for (const tag of entry.tags) {
      const normalized = tag.toLowerCase();
      tagIndex[normalized] = [...(tagIndex[normalized] ?? []), entry.slug];
    }

    // Search index — tokenize title, summary, and tags
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
 * Load or rebuild the KB index from disk.
 * If the index file doesn't exist or is stale, rebuilds from wiki/ files.
 */
export function loadKbIndex(repoRoot: string): KbIndex {
  const indexPath = path.join(repoRoot, "docs", "references", KB_INDEX_FILENAME);
  const wikiDir = path.join(repoRoot, "docs", "references", "wiki");

  // Try loading existing index
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

  // Build fresh index
  const index = buildKbIndex(wikiDir);

  // Persist to disk
  try {
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf-8");
  } catch {
    // Best-effort persist; continue with in-memory index
  }

  return index;
}

/**
 * Query the knowledge base index for entries matching a query string.
 */
export function queryKb(index: KbIndex, query: string, tags?: string[], limit = 5): KbQueryResult {
  const queryTokens = tokenize(query);
  const tagSet = new Set((tags ?? []).map((t) => t.toLowerCase()));

  // Score each entry by how many query tokens match
  const scores = new Map<string, number>();

  // Token-based scoring
  for (const token of queryTokens) {
    const matching = index.searchIndex[token] ?? [];
    for (const slug of matching) {
      scores.set(slug, (scores.get(slug) ?? 0) + 1);
    }
  }

  // Tag-based scoring (higher weight)
  for (const tag of tagSet) {
    const matching = index.tagIndex[tag] ?? [];
    for (const slug of matching) {
      scores.set(slug, (scores.get(slug) ?? 0) + 2);
    }
  }

  // If no scores, try fuzzy matching against tags
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

  // Sort by score descending
  const ranked = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  const metaMap = new Map(index.entries.map((e) => [e.slug, e]));

  const matches = ranked
    .map(([slug, score]) => {
      const meta = metaMap.get(slug);
      if (!meta) return null;
      const entry = loadSingleEntrySummary(slug);
      return {
        slug,
        title: meta.title,
        summary: entry?.summary ?? "",
        tags: meta.tags,
        health: meta.health,
        score,
      };
    })
    .filter((m): m is NonNullable<typeof m> => Boolean(m));

  return { query, matches, total: index.entries.length };
}

/**
 * Rebuild and persist the KB index to disk.
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

/**
 * Get the full path to the wiki directory.
 */
export function getWikiDir(repoRoot: string): string {
  return path.join(repoRoot, "docs", "references", "wiki");
}

/**
 * Get the full path to the raw directory.
 */
export function getRawDir(repoRoot: string): string {
  return path.join(repoRoot, "docs", "references", "raw");
}

/** Load a single wiki entry summary by slug for query results */
function loadSingleEntrySummary(slug: string): { summary: string } | null {
  const wikiDir = path.join(process.cwd(), "docs", "references", "wiki");
  const candidates = [
    path.join(wikiDir, `${slug}.md`),
    path.join(wikiDir, `${slug.replace(/-/g, "_")}.md`),
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    try {
      const source = fs.readFileSync(candidate, "utf-8");
      const entry = parseWikiEntry(candidate, source);
      if (entry) return { summary: entry.summary };
    } catch {
      // Ignore
    }
  }

  return null;
}
