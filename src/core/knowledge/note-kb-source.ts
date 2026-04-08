/**
 * Note-backed KB Source
 *
 * Adapts workspace notes that carry `wikiFrontmatter` into the same `KbEntry`
 * shape used by the fs-backed wiki, so the kb-index builder can consume both
 * sources uniformly.
 */

import type { Note } from "../models/note";
import type { KbEntry } from "./types";
import type { NoteStore } from "../store/note-store";

function normalizeLineEndings(source: string): string {
  return source.replace(/\r\n?/g, "\n");
}

function extractSectionBody(source: string, heading: string): string | null {
  const normalized = normalizeLineEndings(source);
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = normalized.match(
    new RegExp(`^##\\s+${escaped}\\s*$\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, "m"),
  );
  return match?.[1]?.trim() ?? null;
}

function extractFirstParagraph(source: string | null | undefined): string | null {
  if (!source) return null;
  const normalized = source.trim();
  if (!normalized) return null;
  const paragraphs = normalized.split(/\n\s*\n/);
  for (const paragraph of paragraphs) {
    const candidate = paragraph.trim();
    if (!candidate) continue;
    if (candidate.startsWith("- ") || /^\d+\.\s/.test(candidate) || candidate.startsWith("```")) continue;
    return candidate.replace(/\n+/g, " ").trim();
  }
  return null;
}

function extractCrossRefs(source: string): string[] {
  const matches = normalizeLineEndings(source).matchAll(/\[\[([^\]]+)\]\]/g);
  return [...matches].map((m) => m[1].trim());
}

function extractSections(source: string): Record<string, string> {
  const normalized = normalizeLineEndings(source);
  const sections: Record<string, string> = {};
  const sectionRegex = /^##\s+(.+?)\s*$/gm;
  const positions: { heading: string; start: number }[] = [];

  let match: RegExpExecArray | null;
  while ((match = sectionRegex.exec(normalized)) !== null) {
    positions.push({ heading: match[1].trim(), start: match.index });
  }

  for (let i = 0; i < positions.length; i++) {
    const current = positions[i];
    const nextStart = positions[i + 1]?.start ?? normalized.length;
    const body = normalized
      .slice(current.start, nextStart)
      .replace(/^##\s+.+$/m, "")
      .trim();
    if (body) {
      sections[current.heading] = body;
    }
  }

  return sections;
}

/**
 * Convert a workspace note (with wikiFrontmatter) into a KbEntry.
 * Returns null if the note has no wikiFrontmatter (i.e. it's not a wiki entry).
 */
export function noteToKbEntry(note: Note): KbEntry | null {
  const fm = note.metadata.wikiFrontmatter;
  if (!fm) return null;

  const summary =
    extractFirstParagraph(extractSectionBody(note.content, "摘要"))
    ?? extractFirstParagraph(extractSectionBody(note.content, "Summary"))
    ?? extractFirstParagraph(note.content)
    ?? "";

  return {
    title: note.title,
    slug: fm.slug,
    source_urls: fm.sourceUrls,
    last_compiled: fm.lastCompiled ?? "unknown",
    compiled_by: fm.compiledBy ?? "unknown",
    health: fm.health,
    tags: fm.tags,
    summary,
    origin: "note",
    sourceRef: `${note.workspaceId}/${note.id}`,
    sections: extractSections(note.content),
    crossRefs: extractCrossRefs(note.content),
  };
}

/**
 * Load all wiki-tagged notes from a workspace and convert them to KbEntry shape.
 */
export async function loadNoteKbEntries(
  noteStore: NoteStore,
  workspaceId: string,
): Promise<KbEntry[]> {
  const notes = await noteStore.listByWorkspace(workspaceId);
  const entries: KbEntry[] = [];
  for (const note of notes) {
    const entry = noteToKbEntry(note);
    if (entry) entries.push(entry);
  }
  return entries;
}
