# References

LLM-friendly knowledge base following Karpathy's Markdown wiki approach.

## Structure

```
references/
├── raw/           # Raw source material (manual paste, CLI import, URL fetch)
├── wiki/          # LLM-compiled structured knowledge entries
└── .kb-index.json # Auto-generated search index (do not edit manually)
```

## How It Works

1. **Import** — Raw material goes into `raw/` (markdown files, pasted docs, etc.)
2. **Compile** — The `knowledge-curator` specialist (or manual process) compiles raw material into structured `wiki/` entries
3. **Index** — The KB index (`.kb-index.json`) is auto-built from `wiki/*.md` frontmatter at startup
4. **Query** — Agents use `query_knowledge_base` MCP tool to search the index

## Wiki Entry Format

Each `wiki/*.md` file must have YAML frontmatter:

```yaml
---
title: "Entry Title"
slug: entry-slug
source_urls:
  - https://example.com/docs
last_compiled: 2026-04-06
compiled_by: knowledge-curator
health: good
tags: [tag1, tag2]
---
```

Required sections: **摘要** (or **Summary**), **核心概念** (or **Core Concepts**)

## Directory Policies

**Put here:**
- Distilled external references that agents need frequently
- Stable internal reference sheets for protocols, frameworks, or tooling
- Machine-scannable summaries easier to consume than vendor docs

**Do NOT put here:**
- Design decisions specific to Routa (use `docs/adr/`)
- Work-in-progress plans (use `docs/exec-plans/`)
- Incident reports (use `docs/issues/`)

## Cross-references

Use `[[slug]]` syntax to link between wiki entries. The knowledge-curator validates these links during health checks.

Project-specific references:
- `../specialists/README.md`: specialist overview
