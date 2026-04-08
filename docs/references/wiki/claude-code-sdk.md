---
title: "Claude Code SDK Adapter"
slug: claude-code-sdk
source_urls:
  - https://docs.anthropic.com/en/docs/claude-code/sdk
last_compiled: 2026-04-06
compiled_by: knowledge-curator
health: good
tags: [claude, sdk, serverless, adapter, agent]

# Claude Code SDK Adapter

## Summary

The Claude Code SDK adapter enables Routa to use the Claude Code SDK (TypeScript) as an ACP provider, primarily for serverless and edge environments where spawning CLI processes is not feasible. It wraps the Claude Code SDK's `Claude` class as a drop-in replacement for stdin/stdout-based providers.

## Core Concepts

### When SDK is Used
- **Serverless environments** (Vercel, Cloudflare Workers) — detected via `isServerlessEnvironment()`
- **Claude Code SDK configured** — `isClaudeCodeSdkConfigured()` checks for API key availability
- Falls back to CLI-based `claude` provider otherwise

### Architecture
```
AcpProcessManager
├── claude (CLI-based)      → stdin/stdout JSON-RPC
├── opencode (CLI-based)    → stdin/stdout JSON-RPC
└── claude-code-sdk (SDK)   → In-process TypeScript API
```

### Session Flow (SDK)
1. Create `Claude` instance with API key and model
2. Send messages via SDK API (not JSON-RPC)
3. Handle tool calls through the SDK's tool execution loop
4. Stream responses back to the orchestrator

### Model Mapping
| Tier | SDK Model ID |
|------|-------------|
| fast | claude-3-5-haiku-20241022 |
| balanced | claude-sonnet-4-20250514 |
| smart | claude-opus-4-5 |

## Routa Integration

- **src/core/acp/claude-code-sdk-adapter.ts** — Main adapter implementation
- **src/core/acp/acp-process-manager.ts** — Routes to SDK when appropriate
- **agent-trigger.ts** — `resolveKanbanAutomationProvider()` converts `claude` to `claude-code-sdk`

### Provider Resolution Chain
```
specialist config → parent provider → "claude" → isServerless? → "claude-code-sdk" : "claude"
```

## Usage Patterns

### Agent Session Creation
```
if (provider === "claude" && isClaudeCodeSdkConfigured()) {
  return "claude-code-sdk";
}
```

### In Kanban Automation
The workflow orchestrator automatically detects serverless environments and routes to the SDK adapter without manual configuration.

## Cross-references
- → [[acp-protocol]] (ACP transport layer)
- → [[provider-registry]] (Provider configuration and tier resolution)

## Health Check
- [x] Links valid
- [x] Content current
