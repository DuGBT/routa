---
title: "Provider Registry"
slug: provider-registry
source_urls:
  - https://github.com/nicepkg/routa
last_compiled: 2026-04-06
compiled_by: knowledge-curator
health: good
tags: [provider, registry, claude, opencode, model-tier, agent]

# Provider Registry

## Summary

The Provider Registry manages multiple AI provider configurations in Routa. It supports compound model IDs (provider:model format), model tier-based resolution (fast/balanced/smart), and provider inheritance from parent to child agents. Default provider is `claude`.

## Core Concepts

### Compound Model IDs
Model IDs use `provider:model` format:
- `claude:opus-4.6` — Opus 4.6 via Claude provider
- `sonnet-4.5` — Defaults to `claude:sonnet-4.5` when no provider specified
- `opencode:smart` — Smart tier via OpenCode provider

### Model Tiers
| Tier | Claude | Claude Code SDK | OpenCode |
|------|--------|----------------|----------|
| `fast` | haiku-4.5 | claude-3-5-haiku-20241022 | fast |
| `balanced` | sonnet-4.5 | claude-sonnet-4-20250514 | balanced |
| `smart` | opus-4.6 | claude-opus-4-5 | smart |

### Provider Selection Priority
1. Explicit provider in specialist YAML config
2. Parent agent's provider (inheritance)
3. Default provider (`claude`)

### Key Functions
- `parseCompoundModelId(id, defaultProvider)` — Parse "provider:model" into parts
- `resolveModelForSpecialist()` — Pick model for specialist based on tier + parent
- `getDefaultProviderId()` — Returns `"claude"`

## Routa Integration

- **src/core/acp/provider-registry.ts** — Main registry implementation
- **resources/specialists/**/*.yaml** — Specialist configs may override provider
- **acp-session-create.ts** — Session creation uses provider resolution chain
- **agent-trigger.ts** — Kanban automation resolves provider per step

### Environment Variables
- `ROUTA_INTERNAL_API_ORIGIN` — Override API origin for provider selection
- No env var to change default provider (use config files)

## Cross-references
- → [[acp-protocol]] (ACP transport layer)
- → [[claude-code-sdk]] (Claude Code SDK provider details)

## Health Check
- [x] Links valid
- [x] Content current
