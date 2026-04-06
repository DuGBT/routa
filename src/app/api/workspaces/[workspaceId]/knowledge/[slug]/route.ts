/**
 * /api/workspaces/[workspaceId]/knowledge/[slug] — fetch a single KB entry by slug.
 *
 * Looks up workspace notes first (workspace-private wins), then falls back
 * to the repo-level fs wiki at docs/references/wiki/.
 *
 * Returns the full markdown body so the client can render it; the list
 * endpoint only returns metadata.
 *
 * GET /api/workspaces/:id/knowledge/:slug → { entry: { …, body: string } }
 */

import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getRoutaSystem } from "@/core/routa-system";
import {
  noteToKbEntry,
  parseWikiEntry,
  getWikiDir,
  type KbEntry,
} from "@/core/knowledge";

export const dynamic = "force-dynamic";

interface KbEntryDetail {
  title: string;
  slug: string;
  tags: string[];
  sourceUrls: string[];
  health: KbEntry["health"];
  lastCompiled: string;
  compiledBy: string;
  origin: KbEntry["origin"];
  sourceRef: string;
  body: string;
  crossRefs: string[];
  summary: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; slug: string }> },
) {
  const { workspaceId, slug } = await params;
  if (!workspaceId || !slug) {
    return NextResponse.json(
      { error: "workspaceId and slug are required" },
      { status: 400 },
    );
  }

  const system = getRoutaSystem();
  const workspace = await system.workspaceStore.get(workspaceId);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // 1. Workspace-private wiki note (workspace wins on slug collision)
  const noteEntry = await loadFromNotes(system, workspaceId, slug);
  if (noteEntry) {
    return NextResponse.json({ entry: noteEntry });
  }

  // 2. Repo-level fs wiki fallback
  const fsEntry = loadFromFs(slug);
  if (fsEntry) {
    return NextResponse.json({ entry: fsEntry });
  }

  return NextResponse.json({ error: `KB entry not found: ${slug}` }, { status: 404 });
}

async function loadFromNotes(
  system: ReturnType<typeof getRoutaSystem>,
  workspaceId: string,
  slug: string,
): Promise<KbEntryDetail | null> {
  // Fast path: deterministic noteId convention
  const fastId = `wiki-${slug}`;
  let note = await system.noteStore.get(fastId, workspaceId);

  // Fallback: scan workspace for any wiki note that matches the slug
  if (!note?.metadata.wikiFrontmatter || note.metadata.wikiFrontmatter.slug !== slug) {
    const all = await system.noteStore.listByWorkspace(workspaceId);
    note = all.find((n) => n.metadata.wikiFrontmatter?.slug === slug);
  }
  if (!note) return null;

  const entry = noteToKbEntry(note);
  if (!entry) return null;

  return {
    title: entry.title,
    slug: entry.slug,
    tags: entry.tags,
    sourceUrls: entry.source_urls,
    health: entry.health,
    lastCompiled: entry.last_compiled,
    compiledBy: entry.compiled_by,
    origin: entry.origin,
    sourceRef: entry.sourceRef,
    body: note.content,
    crossRefs: entry.crossRefs,
    summary: entry.summary,
  };
}

function loadFromFs(slug: string): KbEntryDetail | null {
  const wikiDir = getWikiDir(process.cwd());
  const candidatePath = path.join(wikiDir, `${slug}.md`);
  if (!fs.existsSync(candidatePath)) return null;
  let source: string;
  try {
    source = fs.readFileSync(candidatePath, "utf-8");
  } catch {
    return null;
  }
  const entry = parseWikiEntry(candidatePath, source);
  if (!entry) return null;

  return {
    title: entry.title,
    slug: entry.slug,
    tags: entry.tags,
    sourceUrls: entry.source_urls,
    health: entry.health,
    lastCompiled: entry.last_compiled,
    compiledBy: entry.compiled_by,
    origin: entry.origin,
    sourceRef: entry.sourceRef,
    body: source,
    crossRefs: entry.crossRefs,
    summary: entry.summary,
  };
}
