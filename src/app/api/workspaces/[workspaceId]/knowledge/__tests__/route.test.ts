/**
 * Tests for /api/workspaces/[workspaceId]/knowledge route handlers.
 *
 * Mocks getRoutaSystem to return an InMemory NoteStore + WorkspaceStore so we
 * can verify list / detail / 404 / origin filtering / dedup behavior end-to-end
 * through the route handlers.
 */

import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { InMemoryNoteStore } from "@/core/store/note-store";
import { InMemoryWorkspaceStore } from "@/core/store";
import { createNote, type WikiFrontmatter } from "@/core/models/note";

const noteStore = new InMemoryNoteStore();
const workspaceStore = new InMemoryWorkspaceStore();

vi.mock("@/core/routa-system", () => ({
  getRoutaSystem: () => ({ noteStore, workspaceStore }),
}));

import { GET as listGet } from "../route";
import { GET as detailGet } from "../[slug]/route";

async function seedWorkspaceNote(opts: {
  workspaceId: string;
  noteId: string;
  title: string;
  content: string;
  frontmatter: WikiFrontmatter;
}) {
  await noteStore.save(
    createNote({
      id: opts.noteId,
      title: opts.title,
      content: opts.content,
      workspaceId: opts.workspaceId,
      metadata: { type: "general", wikiFrontmatter: opts.frontmatter },
    }),
  );
}

// Each test uses unique workspaceIds so the shared in-memory stores don't collide.

describe("GET /api/workspaces/[workspaceId]/knowledge", () => {
  it("returns 400 when workspaceId is missing in params", async () => {
    const res = await listGet(new NextRequest("http://localhost/api/workspaces//knowledge"), {
      params: Promise.resolve({ workspaceId: "" }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("workspaceId");
  });

  it("returns 404 when the workspace does not exist", async () => {
    const res = await listGet(new NextRequest("http://localhost/api/workspaces/ghost/knowledge"), {
      params: Promise.resolve({ workspaceId: "ghost-ws" }),
    });
    expect(res.status).toBe(404);
  });

  it("lists workspace wiki notes (entries with origin=note)", async () => {
    await workspaceStore.save({
      id: "ws-list-1",
      title: "WS",
      status: "active",
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await seedWorkspaceNote({
      workspaceId: "ws-list-1",
      noteId: "wiki-routing-strategy",
      title: "Routing Strategy",
      content: "## Summary\n\nWe route by region.",
      frontmatter: {
        slug: "routing-strategy",
        tags: ["routing"],
        sourceUrls: [],
        health: "good",
      },
    });

    const res = await listGet(
      new NextRequest("http://localhost/api/workspaces/ws-list-1/knowledge"),
      { params: Promise.resolve({ workspaceId: "ws-list-1" }) },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.workspaceId).toBe("ws-list-1");
    const noteEntry = data.entries.find((e: { slug: string }) => e.slug === "routing-strategy");
    expect(noteEntry).toBeDefined();
    expect(noteEntry.origin).toBe("note");
    expect(noteEntry.summary).toContain("region");
  });

  it("isolates entries between workspaces", async () => {
    await workspaceStore.save({
      id: "ws-iso-A",
      title: "A",
      status: "active",
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await workspaceStore.save({
      id: "ws-iso-B",
      title: "B",
      status: "active",
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await seedWorkspaceNote({
      workspaceId: "ws-iso-A",
      noteId: "wiki-only-a",
      title: "Only A",
      content: "## Summary\n\nA-only.",
      frontmatter: { slug: "only-a", tags: [], sourceUrls: [], health: "good" },
    });
    await seedWorkspaceNote({
      workspaceId: "ws-iso-B",
      noteId: "wiki-only-b",
      title: "Only B",
      content: "## Summary\n\nB-only.",
      frontmatter: { slug: "only-b", tags: [], sourceUrls: [], health: "good" },
    });

    const resA = await listGet(
      new NextRequest("http://localhost/api/workspaces/ws-iso-A/knowledge"),
      { params: Promise.resolve({ workspaceId: "ws-iso-A" }) },
    );
    const dataA = await resA.json();
    const slugsA = dataA.entries.map((e: { slug: string }) => e.slug);
    expect(slugsA).toContain("only-a");
    expect(slugsA).not.toContain("only-b");

    const resB = await listGet(
      new NextRequest("http://localhost/api/workspaces/ws-iso-B/knowledge"),
      { params: Promise.resolve({ workspaceId: "ws-iso-B" }) },
    );
    const dataB = await resB.json();
    const slugsB = dataB.entries.map((e: { slug: string }) => e.slug);
    expect(slugsB).toContain("only-b");
    expect(slugsB).not.toContain("only-a");
  });
});

describe("GET /api/workspaces/[workspaceId]/knowledge/[slug]", () => {
  it("returns 404 when the workspace does not exist", async () => {
    const res = await detailGet(
      new NextRequest("http://localhost/api/workspaces/ghost/knowledge/foo"),
      { params: Promise.resolve({ workspaceId: "ghost-detail", slug: "foo" }) },
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when no entry matches the slug", async () => {
    await workspaceStore.save({
      id: "ws-detail-empty",
      title: "WS",
      status: "active",
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = await detailGet(
      new NextRequest("http://localhost/api/workspaces/ws-detail-empty/knowledge/nope"),
      { params: Promise.resolve({ workspaceId: "ws-detail-empty", slug: "nope" }) },
    );
    expect(res.status).toBe(404);
  });

  it("returns the workspace note via fast path (wiki-<slug> id)", async () => {
    await workspaceStore.save({
      id: "ws-detail-fast",
      title: "WS",
      status: "active",
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await seedWorkspaceNote({
      workspaceId: "ws-detail-fast",
      noteId: "wiki-runbook",
      title: "Incident Runbook",
      content: "## Summary\n\nWhat to do during an incident.\n\n## Steps\n\n1. Page on-call.\n",
      frontmatter: {
        slug: "runbook",
        tags: ["ops", "runbook"],
        sourceUrls: ["https://example.com/runbook"],
        health: "good",
        lastCompiled: "2026-04-07",
        compiledBy: "knowledge-curator",
      },
    });

    const res = await detailGet(
      new NextRequest("http://localhost/api/workspaces/ws-detail-fast/knowledge/runbook"),
      { params: Promise.resolve({ workspaceId: "ws-detail-fast", slug: "runbook" }) },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.entry.title).toBe("Incident Runbook");
    expect(data.entry.slug).toBe("runbook");
    expect(data.entry.tags).toEqual(["ops", "runbook"]);
    expect(data.entry.sourceUrls).toEqual(["https://example.com/runbook"]);
    expect(data.entry.lastCompiled).toBe("2026-04-07");
    expect(data.entry.body).toContain("Page on-call");
    expect(data.entry.origin).toBe("note");
  });

  it("falls back to listByWorkspace scan when noteId is not wiki-<slug>", async () => {
    await workspaceStore.save({
      id: "ws-detail-scan",
      title: "WS",
      status: "active",
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    // Note ID intentionally does NOT match the wiki-<slug> convention
    await seedWorkspaceNote({
      workspaceId: "ws-detail-scan",
      noteId: "legacy-id-12345",
      title: "Legacy Wiki",
      content: "## Summary\n\nMigrated from another system.",
      frontmatter: {
        slug: "legacy-wiki",
        tags: [],
        sourceUrls: [],
        health: "good",
      },
    });

    const res = await detailGet(
      new NextRequest("http://localhost/api/workspaces/ws-detail-scan/knowledge/legacy-wiki"),
      { params: Promise.resolve({ workspaceId: "ws-detail-scan", slug: "legacy-wiki" }) },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.entry.slug).toBe("legacy-wiki");
    expect(data.entry.title).toBe("Legacy Wiki");
  });
});
