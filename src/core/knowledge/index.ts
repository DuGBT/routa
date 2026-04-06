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
} from "./kb-frontmatter";

export {
  buildKbIndex,
  loadKbIndex,
  queryKb,
  rebuildKbIndex,
  getWikiDir,
  getRawDir,
} from "./kb-index";
