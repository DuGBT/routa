/**
 * KB Frontmatter Parser
 *
 * Extracts structured metadata from wiki/*.md entries.
 * Each wiki entry uses YAML frontmatter with standard fields.
 */

import fs from "fs";
import path from "path";
import type { KbEntry, KbEntryHealth, KbLinkStatus } from "./types";
import type { WikiFrontmatter } from "../models/note";

function normalizeLineEndings(source: string): string {
  return source.replace(/\r\n?/g, "\n");
}

function extractFrontmatterValue(source: string, key: string): string | null {
  const normalized = normalizeLineEndings(source);
  if (!normalized.startsWith("---\n")) {
    return null;
  }
  const endIndex = normalized.indexOf("\n---\n", 4);
  if (endIndex === -1) {
    return null;
  }
  const frontmatter = normalized.slice(4, endIndex);
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = frontmatter.match(new RegExp(`^${escaped}:\\s*(.+)$`, "m"));
  if (!match) return null;
  return match[1].trim().replace(/^["']|["']$/g, "");
}

function extractFrontmatterArray(source: string, key: string): string[] {
  const normalized = normalizeLineEndings(source);
  if (!normalized.startsWith("---\n")) {
    return [];
  }
  const endIndex = normalized.indexOf("\n---\n", 4);
  if (endIndex === -1) {
    return [];
  }
  const frontmatter = normalized.slice(4, endIndex);

  // Try inline YAML array format: ["a", "b", "c"]
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const arrayMatch = frontmatter.match(new RegExp(
    `^${escapedKey}:\\s*\\[([^\\]]*)\\]`, "m",
  ));
  if (arrayMatch) {
    return arrayMatch[1]
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }

  // Try multiline YAML array format:
  // key:
  //   - item1
  //   - item2
  const multiLineMatch = frontmatter.match(
    new RegExp(`^${escapedKey}:\\s*\\n((?:\\s+-\\s+.+\\n?)+)`, "m"),
  );
  if (multiLineMatch) {
    return multiLineMatch[1]
      .split("\n")
      .map((line) => line.replace(/^\s+-\s+/, "").trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }

  return [];
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
  const normalized = normalizeLineEndings(source);
  const matches = normalized.matchAll(/\[\[([^\]]+)\]\]/g);
  return [...matches].map((m) => m[1].trim());
}

/**
 * Parse a wiki/*.md file into a structured KbEntry.
 */
export function parseWikiEntry(filePath: string, source: string): KbEntry | null {
  const normalized = normalizeLineEndings(source);

  const title = extractFrontmatterValue(normalized, "title");
  const slug = extractFrontmatterValue(normalized, "slug");
  if (!title || !slug) {
    return null;
  }

  const sourceUrls = extractFrontmatterArray(normalized, "source_urls");
  const lastCompiled = extractFrontmatterValue(normalized, "last_compiled") ?? "unknown";
  const compiled_by = extractFrontmatterValue(normalized, "compiled_by") ?? "unknown";
  const healthStr = extractFrontmatterValue(normalized, "health") ?? "unknown";
  const tags = extractFrontmatterArray(normalized, "tags");

  const summary = extractFirstParagraph(extractSectionBody(normalized, "摘要"))
    ?? extractFirstParagraph(extractSectionBody(normalized, "Summary"))
    ?? "";

  // Extract all ## sections
  const sections: Record<string, string> = {};
  const sectionRegex = /^##\s+(.+?)\s*$/gm;
  const headingPositions: { heading: string; start: number }[] = [];

  let match: RegExpExecArray | null;
  while ((match = sectionRegex.exec(normalized)) !== null) {
    headingPositions.push({ heading: match[1].trim(), start: match.index });
  }

  for (let i = 0; i < headingPositions.length; i++) {
    const current = headingPositions[i];
    const nextStart = headingPositions[i + 1]?.start ?? normalized.length;
    const body = normalized.slice(current.start, nextStart)
      .replace(/^##\s+.+$/m, "")
      .trim();
    if (body) {
      sections[current.heading] = body;
    }
  }

  const crossRefs = extractCrossRefs(normalized);

  return {
    title,
    slug,
    source_urls: sourceUrls,
    last_compiled: lastCompiled,
    compiled_by,
    health: healthStr as KbEntry["health"],
    tags,
    summary,
    origin: "fs",
    sourceRef: filePath,
    sections,
    crossRefs,
  };
}

/**
 * Read all wiki/*.md files from a directory and parse them.
 */
export function loadWikiEntries(wikiDir: string): KbEntry[] {
  if (!fs.existsSync(wikiDir) || !fs.statSync(wikiDir).isDirectory()) {
    return [];
  }

  const entries: KbEntry[] = [];
  for (const fileName of fs.readdirSync(wikiDir).sort()) {
    if (!fileName.toLowerCase().endsWith(".md")) continue;
    const absolutePath = path.join(wikiDir, fileName);
    if (!fs.statSync(absolutePath).isFile()) continue;
    const source = fs.readFileSync(absolutePath, "utf-8");
    const entry = parseWikiEntry(absolutePath, source);
    if (entry) {
      entries.push(entry);
    }
  }
  return entries;
}

/**
 * Result of splitting a markdown source into structured frontmatter + body.
 */
export interface ExtractedMarkdown {
  /** Page title from `title:` frontmatter (required) */
  title: string;
  /** Structured wiki frontmatter, with snake_case YAML keys mapped to camelCase struct */
  frontmatter: WikiFrontmatter;
  /** Markdown body with the YAML frontmatter block stripped */
  body: string;
}

const HEALTH_VALUES: ReadonlySet<KbEntryHealth> = new Set([
  "good",
  "stale",
  "broken",
  "unknown",
]);

function coerceHealth(raw: string | null | undefined): KbEntryHealth {
  if (raw && HEALTH_VALUES.has(raw as KbEntryHealth)) {
    return raw as KbEntryHealth;
  }
  return "unknown";
}

/**
 * Parse a markdown document with YAML frontmatter into a structured
 * `WikiFrontmatter` plus body. Returns null if the source has no usable
 * frontmatter (missing `title:` or `slug:`).
 *
 * Used by `promote_document_to_wiki` to convert a document artifact into
 * a workspace note carrying `wikiFrontmatter`.
 */
export function extractMarkdownFrontmatter(
  source: string,
): ExtractedMarkdown | null {
  const normalized = normalizeLineEndings(source);
  if (!normalized.startsWith("---\n")) return null;
  const endIndex = normalized.indexOf("\n---\n", 4);
  if (endIndex === -1) return null;

  const title = extractFrontmatterValue(normalized, "title");
  const slug = extractFrontmatterValue(normalized, "slug");
  if (!title || !slug) return null;

  const frontmatter: WikiFrontmatter = {
    slug,
    tags: extractFrontmatterArray(normalized, "tags"),
    sourceUrls: extractFrontmatterArray(normalized, "source_urls"),
    health: coerceHealth(extractFrontmatterValue(normalized, "health")),
    lastCompiled: extractFrontmatterValue(normalized, "last_compiled") ?? undefined,
    compiledBy: extractFrontmatterValue(normalized, "compiled_by") ?? undefined,
  };

  // Body = everything after the closing `---\n` line
  const body = normalized.slice(endIndex + 5).replace(/^\n+/, "");

  return { title, frontmatter, body };
}

/**
 * Check health of a source URL by attempting a HEAD request.
 */
export async function checkLinkHealth(url: string): Promise<KbLinkStatus> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Routa-KB/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    return res.ok ? "ok" : "broken";
  } catch {
    return "unverified";
  }
}
