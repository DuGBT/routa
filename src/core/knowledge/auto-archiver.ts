/**
 * KB Auto-Archiver
 *
 * When a task completes with taskType ∈ {analysis, document}, harvests its
 * document artifacts and promotes them into the workspace's knowledge base
 * as wiki notes. Mirrors what the agent could do via promote_document_to_wiki,
 * but happens automatically so finished research doesn't sit unindexed.
 *
 * Wiring: registered as an EventBus handler in routa-system.ts. The handler
 * fires-and-forgets the async archive work so task completion is never
 * blocked by archive failures.
 *
 * Idempotency: artifacts that have already been archived (or skipped for a
 * deterministic reason) are tagged via `metadata.kb_archive_status` and
 * skipped on subsequent runs. Re-emitting TASK_STATUS_CHANGED is safe.
 */

import type { RoutaSystem } from "../routa-system";
import { TaskStatus } from "../models/task";
import type { Artifact } from "../models/artifact";
import { AgentEventType, type AgentEvent } from "../events/event-bus";
import { extractMarkdownFrontmatter } from "./kb-frontmatter";

/** Status values written to artifact.metadata.kb_archive_status */
export type KbArchiveStatus =
  | "archived"
  | "skipped:no_content"
  | "skipped:no_frontmatter"
  | "skipped:duplicate"
  | "skipped:already_archived"
  | `failed:${string}`;

export interface ArchiveOutcome {
  artifactId: string;
  status: KbArchiveStatus;
  noteId?: string;
  slug?: string;
}

const ARCHIVE_ELIGIBLE_TASK_TYPES = new Set(["analysis", "document"] as const);

/**
 * Archive any document artifacts attached to a completed task.
 * Pure async function — no event bus involvement, called directly by both
 * the auto-archiver handler and tests.
 *
 * Returns one outcome per artifact considered.
 */
export async function archiveCompletedTaskDocuments(
  system: RoutaSystem,
  taskId: string,
): Promise<ArchiveOutcome[]> {
  const task = await system.taskStore.get(taskId);
  if (!task) return [];
  if (task.status !== TaskStatus.COMPLETED) return [];
  if (!task.taskType || !ARCHIVE_ELIGIBLE_TASK_TYPES.has(task.taskType as "analysis" | "document")) {
    return [];
  }

  const artifactStore = system.artifactStore;
  if (!artifactStore) return [];

  const documents = await artifactStore.listByTaskAndType(taskId, "document");
  const outcomes: ArchiveOutcome[] = [];

  for (const artifact of documents) {
    const outcome = await archiveOneArtifact(system, artifact);
    outcomes.push(outcome);
    // Persist updated metadata regardless of outcome so we don't redo work.
    artifact.metadata = {
      ...(artifact.metadata ?? {}),
      kb_archive_status: outcome.status,
      ...(outcome.noteId && { kb_archive_note_id: outcome.noteId }),
      ...(outcome.slug && { kb_archive_slug: outcome.slug }),
    };
    artifact.updatedAt = new Date();
    try {
      await artifactStore.saveArtifact(artifact);
    } catch (err) {
      console.warn(
        `[kb-auto-archiver] Failed to persist archive metadata for artifact ${artifact.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return outcomes;
}

async function archiveOneArtifact(
  system: RoutaSystem,
  artifact: Artifact,
): Promise<ArchiveOutcome> {
  const existingStatus = artifact.metadata?.kb_archive_status as KbArchiveStatus | undefined;
  if (existingStatus === "archived" || existingStatus === "skipped:duplicate") {
    return { artifactId: artifact.id, status: "skipped:already_archived" };
  }

  if (!artifact.content) {
    return { artifactId: artifact.id, status: "skipped:no_content" };
  }

  let extracted: ReturnType<typeof extractMarkdownFrontmatter>;
  try {
    extracted = extractMarkdownFrontmatter(artifact.content);
  } catch (err) {
    return {
      artifactId: artifact.id,
      status: `failed:extract:${(err instanceof Error ? err.message : String(err)).slice(0, 60)}`,
    };
  }
  if (!extracted) {
    return { artifactId: artifact.id, status: "skipped:no_frontmatter" };
  }

  const slug = extracted.frontmatter.slug;
  const noteId = `wiki-${slug}`;

  // Duplicate check: workspace already has a wiki note with this slug
  try {
    const existing = await system.noteStore.get(noteId, artifact.workspaceId);
    if (existing) {
      return { artifactId: artifact.id, status: "skipped:duplicate", noteId, slug };
    }
  } catch {
    // Treat lookup failures as transient — fall through and let createNote retry
  }

  try {
    const result = await system.noteTools.createNote({
      title: extracted.title,
      content: extracted.body,
      workspaceId: artifact.workspaceId,
      noteId,
      type: "general",
      wikiFrontmatter: extracted.frontmatter,
    });
    if (!result.success) {
      return {
        artifactId: artifact.id,
        status: `failed:create:${(result.error ?? "unknown").slice(0, 60)}`,
      };
    }
  } catch (err) {
    return {
      artifactId: artifact.id,
      status: `failed:create:${(err instanceof Error ? err.message : String(err)).slice(0, 60)}`,
    };
  }

  return { artifactId: artifact.id, status: "archived", noteId, slug };
}

/**
 * Register an EventBus handler that triggers the archiver whenever a task
 * transitions to COMPLETED. Fire-and-forget — never blocks the emitter.
 */
export function startKbAutoArchiver(system: RoutaSystem): void {
  system.eventBus.on("kb-auto-archiver", (event: AgentEvent) => {
    if (!isTaskCompletedEvent(event)) return;
    const taskId = event.data?.taskId;
    if (typeof taskId !== "string") return;

    void archiveCompletedTaskDocuments(system, taskId).catch((err) => {
      console.warn(
        `[kb-auto-archiver] Archive run failed for task ${taskId}:`,
        err instanceof Error ? err.message : String(err),
      );
    });
  });
}

function isTaskCompletedEvent(event: AgentEvent): boolean {
  if (event.type === AgentEventType.TASK_COMPLETED) return true;
  if (event.type === AgentEventType.TASK_STATUS_CHANGED) {
    const newStatus = event.data?.newStatus;
    return newStatus === TaskStatus.COMPLETED || newStatus === "COMPLETED";
  }
  return false;
}
