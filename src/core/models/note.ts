/**
 * Note model
 *
 * Represents a shared document in the workspace that agents can read and write.
 * Notes serve as the collaboration hub for multi-agent coordination:
 * - Spec Note (id="spec"): the planning source of truth
 * - Task Notes: structured task definitions created from @@@task blocks
 * - General Notes: free-form documents for context sharing
 */

import { TaskStatus } from "./task";

export type NoteType = "spec" | "task" | "general";

/** Health status of a wiki/KB entry */
export type KbEntryHealth = "good" | "stale" | "broken" | "unknown";

/**
 * Structured metadata for notes that act as knowledge base / wiki entries.
 * The presence of this field on a note signals "this note is a wiki entry";
 * absence means it's a regular spec/task/general note.
 */
export interface WikiFrontmatter {
  /** Stable kebab-case identifier, unique within workspace */
  slug: string;
  /** Tags for filtering and search */
  tags: string[];
  /** Source URLs for verification and traceability */
  sourceUrls: string[];
  /** Health status of this entry */
  health: KbEntryHealth;
  /** ISO date string when this entry was last compiled (e.g. "2026-04-06") */
  lastCompiled?: string;
  /** Identifier of the agent or user who compiled this entry */
  compiledBy?: string;
}

export interface NoteMetadata {
  /** Note type classification */
  type: NoteType;
  /** For task notes: current task status */
  taskStatus?: TaskStatus;
  /** For task notes: IDs of agents assigned to this task */
  assignedAgentIds?: string[];
  /** For task notes: parent note ID (usually "spec") */
  parentNoteId?: string;
  /** For task notes: linked task ID in the TaskStore */
  linkedTaskId?: string;
  /** Custom key-value metadata */
  custom?: Record<string, string>;
  /**
   * If set, this note is a knowledge base / wiki entry.
   * Used by the KB indexer for tag/health/search filtering.
   */
  wikiFrontmatter?: WikiFrontmatter;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  workspaceId: string;
  /** Session ID that created this note (for session-scoped grouping) */
  sessionId?: string;
  metadata: NoteMetadata;
  createdAt: Date;
  updatedAt: Date;
}

/** The fixed ID for the workspace spec note */
export const SPEC_NOTE_ID = "spec";

export function createNote(params: {
  id: string;
  title: string;
  content?: string;
  workspaceId: string;
  sessionId?: string;
  metadata?: Partial<NoteMetadata>;
}): Note {
  const now = new Date();
  return {
    id: params.id,
    title: params.title,
    content: params.content ?? "",
    workspaceId: params.workspaceId,
    sessionId: params.sessionId,
    metadata: {
      type: params.metadata?.type ?? "general",
      taskStatus: params.metadata?.taskStatus,
      assignedAgentIds: params.metadata?.assignedAgentIds,
      parentNoteId: params.metadata?.parentNoteId,
      linkedTaskId: params.metadata?.linkedTaskId,
      custom: params.metadata?.custom,
      wikiFrontmatter: params.metadata?.wikiFrontmatter,
    },
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create the default spec note for a workspace.
 */
export function createSpecNote(workspaceId: string): Note {
  return createNote({
    id: SPEC_NOTE_ID,
    title: "Spec",
    content: "",
    workspaceId,
    metadata: { type: "spec" },
  });
}
