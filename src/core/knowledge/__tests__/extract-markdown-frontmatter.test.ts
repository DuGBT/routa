/**
 * extractMarkdownFrontmatter Tests
 *
 * Used by promote_document_to_wiki to convert a document artifact's
 * markdown content into structured WikiFrontmatter + body.
 */

import { describe, expect, it } from "vitest";
import { extractMarkdownFrontmatter } from "../kb-frontmatter";

const FULL_FRONTMATTER = `---
title: "ACP Protocol"
slug: acp-protocol
source_urls:
  - https://github.com/anthropics/agent-client-protocol
  - https://docs.anthropic.com/acp
last_compiled: 2026-04-06
compiled_by: knowledge-curator
health: good
tags: [acp, protocol, json-rpc, agent]
---

# ACP Protocol

## Summary

ACP is a JSON-RPC protocol for AI agent communication.

## Core Concepts

Communication over stdin/stdout.
`;

describe("extractMarkdownFrontmatter", () => {
  it("parses a fully-populated frontmatter into WikiFrontmatter + body", () => {
    const result = extractMarkdownFrontmatter(FULL_FRONTMATTER);
    expect(result).not.toBeNull();
    expect(result!.title).toBe("ACP Protocol");
    expect(result!.frontmatter).toEqual({
      slug: "acp-protocol",
      tags: ["acp", "protocol", "json-rpc", "agent"],
      sourceUrls: [
        "https://github.com/anthropics/agent-client-protocol",
        "https://docs.anthropic.com/acp",
      ],
      health: "good",
      lastCompiled: "2026-04-06",
      compiledBy: "knowledge-curator",
    });
    // Body should start with the H1, NOT the YAML block
    expect(result!.body.startsWith("# ACP Protocol")).toBe(true);
    expect(result!.body).toContain("## Summary");
    expect(result!.body).not.toContain("---");
  });

  it("returns null when frontmatter is missing entirely", () => {
    const source = "# Just a heading\n\nNo frontmatter here.";
    expect(extractMarkdownFrontmatter(source)).toBeNull();
  });

  it("returns null when title is missing", () => {
    const source = `---
slug: my-entry
tags: [test]
---

# Body
`;
    expect(extractMarkdownFrontmatter(source)).toBeNull();
  });

  it("returns null when slug is missing", () => {
    const source = `---
title: "My Entry"
tags: [test]
---

# Body
`;
    expect(extractMarkdownFrontmatter(source)).toBeNull();
  });

  it("coerces invalid health to 'unknown'", () => {
    const source = `---
title: "Test"
slug: test-entry
health: bogus-status
---

Body content.
`;
    const result = extractMarkdownFrontmatter(source);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.health).toBe("unknown");
  });

  it("defaults missing health/tags/source_urls to safe empty values", () => {
    const source = `---
title: "Minimal"
slug: minimal-entry
---

Just a body.
`;
    const result = extractMarkdownFrontmatter(source);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.health).toBe("unknown");
    expect(result!.frontmatter.tags).toEqual([]);
    expect(result!.frontmatter.sourceUrls).toEqual([]);
    expect(result!.frontmatter.lastCompiled).toBeUndefined();
    expect(result!.frontmatter.compiledBy).toBeUndefined();
    expect(result!.body.trim()).toBe("Just a body.");
  });

  it("supports inline YAML array syntax for tags", () => {
    const source = `---
title: "Inline Tags"
slug: inline-tags
tags: [one, two, three]
---

Body.
`;
    const result = extractMarkdownFrontmatter(source);
    expect(result!.frontmatter.tags).toEqual(["one", "two", "three"]);
  });

  it("strips leading newlines from body after frontmatter", () => {
    const source = `---
title: "T"
slug: t
---



Three blank lines above.
`;
    const result = extractMarkdownFrontmatter(source);
    expect(result!.body.startsWith("Three")).toBe(true);
  });
});
