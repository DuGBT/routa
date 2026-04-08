/**
 * Knowledge Base Types
 *
 * Core types for the LLM-friendly knowledge base system.
 * Follows the Karpathy-style Markdown wiki approach: raw/ → wiki/ with structured entries.
 */

/** Health status of a knowledge base entry */
export type KbEntryHealth = "good" | "stale" | "broken" | "unknown";

/** Status of source URL health checks */
export type KbLinkStatus = "ok" | "broken" | "unverified";

/** Where a KB entry came from */
export type KbEntryOrigin =
  /** Repo-level fs file at docs/references/wiki/{slug}.md (shared across all workspaces) */
  | "fs"
  /** Workspace-scoped note with wikiFrontmatter */
  | "note";

/** A single wiki entry's frontmatter metadata, plus enough to render search results inline */
export interface KbEntryMeta {
  title: string;
  slug: string;
  source_urls: string[];
  last_compiled: string;
  compiled_by: string;
  health: KbEntryHealth;
  tags: string[];
  /** Short summary used in query results (no fs round-trip needed) */
  summary: string;
  /** Where this entry came from */
  origin: KbEntryOrigin;
  /** For origin=fs: absolute file path. For origin=note: `${workspaceId}/${noteId}` */
  sourceRef: string;
}

/** A full wiki entry with content sections */
export interface KbEntry extends KbEntryMeta {
  /** Map of section heading → section body text */
  sections: Record<string, string>;
  /** Slugs of related wiki entries (from cross-references) */
  crossRefs: string[];
}

/** Link health check result */
export interface KbLinkCheck {
  url: string;
  status: KbLinkStatus;
  checkedAt?: string;
  error?: string;
}

/** The knowledge base index, rebuilt from wiki/*.md at startup */
export interface KbIndex {
  version: 1;
  generatedAt: string;
  entries: KbEntryMeta[];
  /** Inverted index: tag → list of slugs */
  tagIndex: Record<string, string[]>;
  /** Full-text search tokens → slugs (lowercased) */
  searchIndex: Record<string, string[]>;
}

/** Result from query_knowledge_base */
export interface KbQueryResult {
  query: string;
  matches: Array<{
    slug: string;
    title: string;
    summary: string;
    tags: string[];
    health: KbEntryHealth;
    score: number;
  }>;
  total: number;
}

/** Result from kb_health_check */
export interface KbHealthReport {
  checkedAt: string;
  entries: Array<{
    slug: string;
    title: string;
    health: KbEntryHealth;
    links: KbLinkCheck[];
    issues: string[];
  }>;
  summary: {
    total: number;
    good: number;
    stale: number;
    broken: number;
    unknown: number;
  };
}
