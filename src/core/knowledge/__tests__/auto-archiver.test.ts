/**
 * KB Auto-Archiver Tests
 *
 * Verifies that document artifacts attached to completed
 * analysis/document tasks get promoted into the workspace KB as wiki notes,
 * with idempotent metadata tagging on the artifact.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { archiveCompletedTaskDocuments } from "../auto-archiver";
import { InMemoryArtifactStore } from "@/core/store/artifact-store";
import { InMemoryNoteStore } from "@/core/store/note-store";
import { InMemoryTaskStore } from "@/core/store/task-store";
import { InMemoryAgentStore } from "@/core/store/agent-store";
import { InMemoryConversationStore } from "@/core/store/conversation-store";
import { EventBus } from "@/core/events/event-bus";
import { AgentTools } from "@/core/tools/agent-tools";
import { NoteTools } from "@/core/tools/note-tools";
import { createArtifact } from "@/core/models/artifact";
import { createTask } from "@/core/models/task";
import { TaskStatus, type TaskType } from "@/core/models/task";
import type { RoutaSystem } from "@/core/routa-system";

const SAMPLE_DOC_CONTENT = `---
title: "Auth Audit Findings"
slug: auth-audit-findings
source_urls:
  - https://example.com/audit
last_compiled: 2026-04-07
compiled_by: knowledge-curator
health: good
tags: [auth, audit, security]
---

# Auth Audit Findings

## Summary

We found 3 issues in the legacy session middleware.

## Details

Issue 1, issue 2, issue 3.
`;

const SAMPLE_DOC_NO_FRONTMATTER = `# Plain Document

Just a markdown body, no frontmatter.
`;

interface TestSystem {
  system: RoutaSystem;
  artifactStore: InMemoryArtifactStore;
  noteStore: InMemoryNoteStore;
  taskStore: InMemoryTaskStore;
}

function buildTestSystem(): TestSystem {
  const artifactStore = new InMemoryArtifactStore();
  const noteStore = new InMemoryNoteStore();
  const taskStore = new InMemoryTaskStore();
  const agentStore = new InMemoryAgentStore();
  const conversationStore = new InMemoryConversationStore();
  const eventBus = new EventBus();
  const tools = new AgentTools(agentStore, conversationStore, taskStore, eventBus);
  const noteTools = new NoteTools(noteStore, taskStore);

  // Minimal RoutaSystem stub — only the fields auto-archiver touches
  const system = {
    taskStore,
    noteStore,
    artifactStore,
    noteTools,
    eventBus,
    // The rest are unused by the archiver but required by the type
    agentStore,
    conversationStore,
    tools,
  } as unknown as RoutaSystem;

  return { system, artifactStore, noteStore, taskStore };
}

async function seedTask(
  taskStore: InMemoryTaskStore,
  opts: { id: string; workspaceId: string; taskType: TaskType; status: TaskStatus },
) {
  const task = createTask({
    id: opts.id,
    title: `Task ${opts.id}`,
    objective: "test",
    workspaceId: opts.workspaceId,
    taskType: opts.taskType,
    status: opts.status,
  });
  await taskStore.save(task);
  return task;
}

async function seedDocumentArtifact(
  artifactStore: InMemoryArtifactStore,
  opts: { id: string; taskId: string; workspaceId: string; content: string },
) {
  const artifact = createArtifact({
    id: opts.id,
    type: "document",
    taskId: opts.taskId,
    workspaceId: opts.workspaceId,
    providedByAgentId: "agent-1",
    content: opts.content,
    status: "provided",
  });
  await artifactStore.saveArtifact(artifact);
  return artifact;
}

describe("archiveCompletedTaskDocuments", () => {
  let env: TestSystem;

  beforeEach(() => {
    env = buildTestSystem();
  });

  it("archives a document artifact for a completed document task", async () => {
    await seedTask(env.taskStore, {
      id: "task-1",
      workspaceId: "ws-1",
      taskType: "document",
      status: TaskStatus.COMPLETED,
    });
    await seedDocumentArtifact(env.artifactStore, {
      id: "art-1",
      taskId: "task-1",
      workspaceId: "ws-1",
      content: SAMPLE_DOC_CONTENT,
    });

    const outcomes = await archiveCompletedTaskDocuments(env.system, "task-1");

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].status).toBe("archived");
    expect(outcomes[0].slug).toBe("auth-audit-findings");
    expect(outcomes[0].noteId).toBe("wiki-auth-audit-findings");

    // Note got created
    const note = await env.noteStore.get("wiki-auth-audit-findings", "ws-1");
    expect(note).toBeDefined();
    expect(note!.title).toBe("Auth Audit Findings");
    expect(note!.metadata.wikiFrontmatter?.slug).toBe("auth-audit-findings");
    expect(note!.metadata.wikiFrontmatter?.tags).toEqual(["auth", "audit", "security"]);
    expect(note!.content).toContain("Issue 1, issue 2, issue 3");
    expect(note!.content).not.toContain("---"); // YAML stripped

    // Artifact metadata tagged
    const artifact = await env.artifactStore.getArtifact("art-1");
    expect(artifact!.metadata?.kb_archive_status).toBe("archived");
    expect(artifact!.metadata?.kb_archive_note_id).toBe("wiki-auth-audit-findings");
    expect(artifact!.metadata?.kb_archive_slug).toBe("auth-audit-findings");
  });

  it("archives for analysis tasks too", async () => {
    await seedTask(env.taskStore, {
      id: "task-2",
      workspaceId: "ws-1",
      taskType: "analysis",
      status: TaskStatus.COMPLETED,
    });
    await seedDocumentArtifact(env.artifactStore, {
      id: "art-2",
      taskId: "task-2",
      workspaceId: "ws-1",
      content: SAMPLE_DOC_CONTENT,
    });

    const outcomes = await archiveCompletedTaskDocuments(env.system, "task-2");
    expect(outcomes[0].status).toBe("archived");
  });

  it("skips code-type tasks entirely", async () => {
    await seedTask(env.taskStore, {
      id: "task-3",
      workspaceId: "ws-1",
      taskType: "code",
      status: TaskStatus.COMPLETED,
    });
    await seedDocumentArtifact(env.artifactStore, {
      id: "art-3",
      taskId: "task-3",
      workspaceId: "ws-1",
      content: SAMPLE_DOC_CONTENT,
    });

    const outcomes = await archiveCompletedTaskDocuments(env.system, "task-3");
    expect(outcomes).toEqual([]);

    // No note, no metadata change
    expect(await env.noteStore.get("wiki-auth-audit-findings", "ws-1")).toBeUndefined();
    const artifact = await env.artifactStore.getArtifact("art-3");
    expect(artifact!.metadata?.kb_archive_status).toBeUndefined();
  });

  it("skips non-COMPLETED tasks", async () => {
    await seedTask(env.taskStore, {
      id: "task-4",
      workspaceId: "ws-1",
      taskType: "document",
      status: TaskStatus.IN_PROGRESS,
    });
    await seedDocumentArtifact(env.artifactStore, {
      id: "art-4",
      taskId: "task-4",
      workspaceId: "ws-1",
      content: SAMPLE_DOC_CONTENT,
    });

    const outcomes = await archiveCompletedTaskDocuments(env.system, "task-4");
    expect(outcomes).toEqual([]);
  });

  it("tags artifacts without YAML frontmatter as skipped:no_frontmatter", async () => {
    await seedTask(env.taskStore, {
      id: "task-5",
      workspaceId: "ws-1",
      taskType: "document",
      status: TaskStatus.COMPLETED,
    });
    await seedDocumentArtifact(env.artifactStore, {
      id: "art-5",
      taskId: "task-5",
      workspaceId: "ws-1",
      content: SAMPLE_DOC_NO_FRONTMATTER,
    });

    const outcomes = await archiveCompletedTaskDocuments(env.system, "task-5");
    expect(outcomes[0].status).toBe("skipped:no_frontmatter");

    const artifact = await env.artifactStore.getArtifact("art-5");
    expect(artifact!.metadata?.kb_archive_status).toBe("skipped:no_frontmatter");
  });

  it("handles a mix of valid and invalid artifacts in one task", async () => {
    await seedTask(env.taskStore, {
      id: "task-6",
      workspaceId: "ws-1",
      taskType: "analysis",
      status: TaskStatus.COMPLETED,
    });
    await seedDocumentArtifact(env.artifactStore, {
      id: "art-6a",
      taskId: "task-6",
      workspaceId: "ws-1",
      content: SAMPLE_DOC_CONTENT,
    });
    await seedDocumentArtifact(env.artifactStore, {
      id: "art-6b",
      taskId: "task-6",
      workspaceId: "ws-1",
      content: SAMPLE_DOC_NO_FRONTMATTER,
    });

    const outcomes = await archiveCompletedTaskDocuments(env.system, "task-6");
    expect(outcomes).toHaveLength(2);
    const byId = Object.fromEntries(outcomes.map((o) => [o.artifactId, o.status]));
    expect(byId["art-6a"]).toBe("archived");
    expect(byId["art-6b"]).toBe("skipped:no_frontmatter");
  });

  it("is idempotent — re-running on the same task returns skipped:already_archived", async () => {
    await seedTask(env.taskStore, {
      id: "task-7",
      workspaceId: "ws-1",
      taskType: "document",
      status: TaskStatus.COMPLETED,
    });
    await seedDocumentArtifact(env.artifactStore, {
      id: "art-7",
      taskId: "task-7",
      workspaceId: "ws-1",
      content: SAMPLE_DOC_CONTENT,
    });

    const first = await archiveCompletedTaskDocuments(env.system, "task-7");
    expect(first[0].status).toBe("archived");

    const second = await archiveCompletedTaskDocuments(env.system, "task-7");
    expect(second[0].status).toBe("skipped:already_archived");

    // Still exactly one note
    const allNotes = await env.noteStore.listByWorkspace("ws-1");
    const wikiNotes = allNotes.filter((n) => n.metadata.wikiFrontmatter);
    expect(wikiNotes).toHaveLength(1);
  });

  it("tags duplicate-slug artifacts as skipped:duplicate", async () => {
    // Pre-seed a workspace note that already owns the wiki-<slug> id
    const noteStore = env.noteStore;
    await env.system.noteTools.createNote({
      title: "Pre-existing",
      content: "old body",
      workspaceId: "ws-1",
      noteId: "wiki-auth-audit-findings",
      type: "general",
      wikiFrontmatter: {
        slug: "auth-audit-findings",
        tags: [],
        sourceUrls: [],
        health: "good",
      },
    });
    expect(await noteStore.get("wiki-auth-audit-findings", "ws-1")).toBeDefined();

    await seedTask(env.taskStore, {
      id: "task-8",
      workspaceId: "ws-1",
      taskType: "document",
      status: TaskStatus.COMPLETED,
    });
    await seedDocumentArtifact(env.artifactStore, {
      id: "art-8",
      taskId: "task-8",
      workspaceId: "ws-1",
      content: SAMPLE_DOC_CONTENT,
    });

    const outcomes = await archiveCompletedTaskDocuments(env.system, "task-8");
    expect(outcomes[0].status).toBe("skipped:duplicate");

    const artifact = await env.artifactStore.getArtifact("art-8");
    expect(artifact!.metadata?.kb_archive_status).toBe("skipped:duplicate");
    // Pre-existing note should not have been overwritten
    const note = await noteStore.get("wiki-auth-audit-findings", "ws-1");
    expect(note!.title).toBe("Pre-existing");
    expect(note!.content).toBe("old body");
  });

  it("returns [] when the task does not exist", async () => {
    const outcomes = await archiveCompletedTaskDocuments(env.system, "ghost-task");
    expect(outcomes).toEqual([]);
  });
});
