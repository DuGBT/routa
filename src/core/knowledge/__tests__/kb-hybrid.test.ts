/**
 * Hybrid KB Index Tests
 *
 * Verifies that buildHybridKbIndex correctly merges:
 *   - workspace notes carrying wikiFrontmatter (workspace-private, primary)
 *   - repo-level fs wiki entries (shared baseline)
 *
 * Slug collisions: workspace notes win over fs entries.
 */

import fs from "fs";
import path from "path";
import os from "os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InMemoryNoteStore } from "@/core/store/note-store";
import { createNote, type WikiFrontmatter } from "@/core/models/note";
import { buildHybridKbIndex, queryKb } from "../kb-index";
import { noteToKbEntry } from "../note-kb-source";

const FS_ENTRY_ACP = `---
title: "ACP Protocol"
slug: acp-protocol
source_urls:
  - https://github.com/anthropics/agent-client-protocol
last_compiled: 2026-04-06
compiled_by: knowledge-curator
health: good
tags: [acp, protocol, json-rpc]
---

# ACP Protocol

## Summary

ACP is a JSON-RPC protocol for AI agent communication, version 1.

## Cross-references

- → [[claude-code-sdk]]
`;

const FS_ENTRY_SDK = `---
title: "Claude Code SDK"
slug: claude-code-sdk
source_urls:
  - https://docs.anthropic.com
last_compiled: 2026-04-06
compiled_by: knowledge-curator
health: good
tags: [claude, sdk, adapter]
---

# Claude Code SDK

## Summary

TypeScript SDK for Claude Code integration in serverless environments.
`;

function makeWikiNote(opts: {
  workspaceId: string;
  noteId: string;
  title: string;
  content: string;
  frontmatter: WikiFrontmatter;
}) {
  return createNote({
    id: opts.noteId,
    title: opts.title,
    content: opts.content,
    workspaceId: opts.workspaceId,
    metadata: { type: "general", wikiFrontmatter: opts.frontmatter },
  });
}

describe("buildHybridKbIndex", () => {
  let tempRoot: string;
  let wikiDir: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kb-hybrid-"));
    wikiDir = path.join(tempRoot, "docs", "references", "wiki");
    fs.mkdirSync(wikiDir, { recursive: true });
  });

  afterEach(() => {
    if (tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("merges fs entries and workspace notes into a single index", async () => {
    fs.writeFileSync(path.join(wikiDir, "acp-protocol.md"), FS_ENTRY_ACP);
    fs.writeFileSync(path.join(wikiDir, "claude-code-sdk.md"), FS_ENTRY_SDK);

    const noteStore = new InMemoryNoteStore();
    await noteStore.save(
      makeWikiNote({
        workspaceId: "ws-1",
        noteId: "note-team-conventions",
        title: "Team Conventions",
        content: "## Summary\n\nWe use squash merges and TypeScript strict mode.",
        frontmatter: {
          slug: "team-conventions",
          tags: ["team", "conventions"],
          sourceUrls: [],
          health: "good",
        },
      }),
    );

    const index = await buildHybridKbIndex({
      workspaceId: "ws-1",
      noteStore,
      repoRoot: tempRoot,
    });

    expect(index.entries).toHaveLength(3);
    const slugs = index.entries.map((e) => e.slug).sort();
    expect(slugs).toEqual(["acp-protocol", "claude-code-sdk", "team-conventions"]);

    // origin tagging works
    const acp = index.entries.find((e) => e.slug === "acp-protocol")!;
    const team = index.entries.find((e) => e.slug === "team-conventions")!;
    expect(acp.origin).toBe("fs");
    expect(team.origin).toBe("note");
    expect(team.sourceRef).toBe("ws-1/note-team-conventions");
  });

  it("workspace notes override fs entries on slug collision", async () => {
    fs.writeFileSync(path.join(wikiDir, "acp-protocol.md"), FS_ENTRY_ACP);

    const noteStore = new InMemoryNoteStore();
    await noteStore.save(
      makeWikiNote({
        workspaceId: "ws-1",
        noteId: "note-acp-override",
        title: "ACP Protocol (Workspace Override)",
        content: "## Summary\n\nWorkspace-private notes about ACP version 2.",
        frontmatter: {
          slug: "acp-protocol",
          tags: ["acp", "v2"],
          sourceUrls: [],
          health: "good",
        },
      }),
    );

    const index = await buildHybridKbIndex({
      workspaceId: "ws-1",
      noteStore,
      repoRoot: tempRoot,
    });

    expect(index.entries).toHaveLength(1);
    const winner = index.entries[0];
    expect(winner.slug).toBe("acp-protocol");
    expect(winner.title).toBe("ACP Protocol (Workspace Override)");
    expect(winner.origin).toBe("note");
    expect(winner.summary).toContain("version 2");
  });

  it("isolates KB entries between workspaces", async () => {
    fs.writeFileSync(path.join(wikiDir, "acp-protocol.md"), FS_ENTRY_ACP);

    const noteStore = new InMemoryNoteStore();
    await noteStore.save(
      makeWikiNote({
        workspaceId: "ws-A",
        noteId: "note-ws-a-only",
        title: "WS-A Private",
        content: "## Summary\n\nOnly visible to ws-A.",
        frontmatter: { slug: "ws-a-only", tags: [], sourceUrls: [], health: "good" },
      }),
    );
    await noteStore.save(
      makeWikiNote({
        workspaceId: "ws-B",
        noteId: "note-ws-b-only",
        title: "WS-B Private",
        content: "## Summary\n\nOnly visible to ws-B.",
        frontmatter: { slug: "ws-b-only", tags: [], sourceUrls: [], health: "good" },
      }),
    );

    const indexA = await buildHybridKbIndex({
      workspaceId: "ws-A",
      noteStore,
      repoRoot: tempRoot,
    });
    const indexB = await buildHybridKbIndex({
      workspaceId: "ws-B",
      noteStore,
      repoRoot: tempRoot,
    });

    // Both see the shared fs entry
    expect(indexA.entries.some((e) => e.slug === "acp-protocol")).toBe(true);
    expect(indexB.entries.some((e) => e.slug === "acp-protocol")).toBe(true);

    // ws-A sees only its own private slug
    expect(indexA.entries.some((e) => e.slug === "ws-a-only")).toBe(true);
    expect(indexA.entries.some((e) => e.slug === "ws-b-only")).toBe(false);

    // ws-B sees only its own private slug
    expect(indexB.entries.some((e) => e.slug === "ws-b-only")).toBe(true);
    expect(indexB.entries.some((e) => e.slug === "ws-a-only")).toBe(false);
  });

  it("queryKb returns inline summaries from the index without fs round-trips", async () => {
    // No fs entries — pure note-backed query
    const noteStore = new InMemoryNoteStore();
    await noteStore.save(
      makeWikiNote({
        workspaceId: "ws-1",
        noteId: "note-1",
        title: "Routing Strategy",
        content: "## Summary\n\nWe route requests by region and tenant tier.",
        frontmatter: {
          slug: "routing-strategy",
          tags: ["routing", "strategy"],
          sourceUrls: [],
          health: "good",
        },
      }),
    );

    const index = await buildHybridKbIndex({
      workspaceId: "ws-1",
      noteStore,
      repoRoot: tempRoot, // empty wiki dir
    });

    const result = queryKb(index, "routing", ["routing"]);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].slug).toBe("routing-strategy");
    expect(result.matches[0].summary).toContain("region and tenant tier");
  });
});

describe("noteToKbEntry", () => {
  it("returns null for notes without wikiFrontmatter", () => {
    const note = createNote({
      id: "plain",
      title: "Plain note",
      content: "no frontmatter",
      workspaceId: "ws-1",
      metadata: { type: "general" },
    });
    expect(noteToKbEntry(note)).toBeNull();
  });

  it("extracts sections, summary, and crossRefs from note content", () => {
    const note = createNote({
      id: "rich",
      title: "Rich Wiki Note",
      content: [
        "## Summary",
        "",
        "First-paragraph summary.",
        "",
        "## Details",
        "",
        "Some detail. See also [[other-entry]] and [[third-entry]].",
      ].join("\n"),
      workspaceId: "ws-1",
      metadata: {
        type: "general",
        wikiFrontmatter: {
          slug: "rich-wiki-note",
          tags: ["a", "b"],
          sourceUrls: ["https://example.com"],
          health: "good",
          lastCompiled: "2026-04-06",
          compiledBy: "knowledge-curator",
        },
      },
    });

    const entry = noteToKbEntry(note);
    expect(entry).not.toBeNull();
    expect(entry!.title).toBe("Rich Wiki Note");
    expect(entry!.slug).toBe("rich-wiki-note");
    expect(entry!.summary).toBe("First-paragraph summary.");
    expect(Object.keys(entry!.sections).sort()).toEqual(["Details", "Summary"]);
    expect(entry!.crossRefs.sort()).toEqual(["other-entry", "third-entry"]);
    expect(entry!.origin).toBe("note");
    expect(entry!.sourceRef).toBe("ws-1/rich");
    expect(entry!.last_compiled).toBe("2026-04-06");
    expect(entry!.compiled_by).toBe("knowledge-curator");
  });
});
