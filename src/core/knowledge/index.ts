/**
 * Knowledge Base Module
 *
 * Karpathy-style LLM knowledge base: raw/ → wiki/ with structured entries.
 * Provides index building, querying, and health checking for project knowledge.
 */

export type {
  KbEntry,
  KbEntryMeta,
  KbEntryHealth,
  KbEntryOrigin,
  KbLinkStatus,
  KbLinkCheck,
  KbIndex,
  KbQueryResult,
  KbHealthReport,
} from "./types";

export {
  parseWikiEntry,
  loadWikiEntries,
  checkLinkHealth,
  extractMarkdownFrontmatter,
  type ExtractedMarkdown,
} from "./kb-frontmatter";

export {
  noteToKbEntry,
  loadNoteKbEntries,
} from "./note-kb-source";

export {
  buildKbIndex,
  buildKbIndexFromEntries,
  buildHybridKbIndex,
  loadKbIndex,
  queryKb,
  rebuildKbIndex,
  getWikiDir,
  getRawDir,
} from "./kb-index";

export {
  archiveCompletedTaskDocuments,
  startKbAutoArchiver,
  type ArchiveOutcome,
  type KbArchiveStatus,
} from "./auto-archiver";
