import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createNote, type WikiFrontmatter } from "@/core/models/note";
import * as sqliteSchema from "../sqlite-schema";
import { SqliteNoteStore } from "../sqlite-stores";

describe("SqliteNoteStore wikiFrontmatter round-trip", () => {
  let sqlite: BetterSqlite3.Database;
  let store: SqliteNoteStore;

  beforeEach(() => {
    sqlite = new BetterSqlite3(":memory:");
    sqlite.pragma("foreign_keys = ON");
    sqlite.exec(`
      CREATE TABLE workspaces (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        metadata TEXT DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE notes (
        id TEXT NOT NULL,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        session_id TEXT,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        type TEXT NOT NULL DEFAULT 'general',
        task_status TEXT,
        assigned_agent_ids TEXT,
        parent_note_id TEXT,
        linked_task_id TEXT,
        custom_metadata TEXT,
        wiki_frontmatter TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (workspace_id, id)
      );
    `);

    sqlite.prepare(`
      INSERT INTO workspaces (id, title, status, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run("workspace-1", "Workspace", "active", "{}", Date.now(), Date.now());

    const db = drizzle(sqlite, { schema: sqliteSchema });
    store = new SqliteNoteStore(db);
  });

  afterEach(() => {
    sqlite.close();
  });

  it("persists and reads back wikiFrontmatter on a general note", async () => {
    const frontmatter: WikiFrontmatter = {
      slug: "acp-protocol",
      tags: ["acp", "protocol", "json-rpc"],
      sourceUrls: ["https://github.com/anthropics/agent-client-protocol"],
      health: "good",
      lastCompiled: "2026-04-06",
      compiledBy: "knowledge-curator",
    };

    const note = createNote({
      id: "note-acp",
      title: "ACP Protocol",
      content: "## Summary\nACP is a JSON-RPC protocol for AI agents.",
      workspaceId: "workspace-1",
      metadata: {
        type: "general",
        wikiFrontmatter: frontmatter,
      },
    });

    await store.save(note);

    const retrieved = await store.get("note-acp", "workspace-1");
    expect(retrieved).toBeDefined();
    expect(retrieved!.metadata.wikiFrontmatter).toEqual(frontmatter);
    expect(retrieved!.metadata.type).toBe("general");
    expect(retrieved!.title).toBe("ACP Protocol");
  });

  it("leaves wikiFrontmatter undefined for regular notes", async () => {
    const note = createNote({
      id: "note-plain",
      title: "Plain general note",
      content: "Just a regular note",
      workspaceId: "workspace-1",
      metadata: { type: "general" },
    });

    await store.save(note);

    const retrieved = await store.get("note-plain", "workspace-1");
    expect(retrieved).toBeDefined();
    expect(retrieved!.metadata.wikiFrontmatter).toBeUndefined();
  });

  it("updates wikiFrontmatter on save", async () => {
    const initial: WikiFrontmatter = {
      slug: "claude-sdk",
      tags: ["claude", "sdk"],
      sourceUrls: [],
      health: "stale",
    };
    const note = createNote({
      id: "note-sdk",
      title: "Claude SDK",
      content: "old content",
      workspaceId: "workspace-1",
      metadata: { type: "general", wikiFrontmatter: initial },
    });
    await store.save(note);

    const updated: WikiFrontmatter = {
      slug: "claude-sdk",
      tags: ["claude", "sdk", "agent"],
      sourceUrls: ["https://docs.anthropic.com"],
      health: "good",
      lastCompiled: "2026-04-06",
      compiledBy: "knowledge-curator",
    };
    note.metadata.wikiFrontmatter = updated;
    note.content = "new content";
    await store.save(note);

    const retrieved = await store.get("note-sdk", "workspace-1");
    expect(retrieved!.metadata.wikiFrontmatter).toEqual(updated);
    expect(retrieved!.content).toBe("new content");
  });
});
