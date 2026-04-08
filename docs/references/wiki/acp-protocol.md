---
title: "ACP (Agent Client Protocol)"
slug: acp-protocol
source_urls:
  - https://github.com/anthropics/agent-client-protocol
last_compiled: 2026-04-06
compiled_by: knowledge-curator
health: good
tags: [acp, protocol, json-rpc, agent, claude]

# ACP (Agent Client Protocol)

## Summary

ACP is a JSON-RPC 2.0 protocol over stdin/stdout for communicating with AI agent CLI tools. It enables programmatic agent orchestration, session management, and tool integration. Routa uses ACP as its primary transport layer for spawning and managing specialist agents.

## Core Concepts

### Transport
- Communication over **stdin/stdout** using JSON-RPC 2.0 messages
- Each agent process is a long-running stdin/stdout server
- Supports bidirectional streaming for real-time agent output

### Session Lifecycle
1. **Create Session** — Start a new agent process with system prompt and tools
2. **Send Message** — Submit user messages or tool results to the agent
3. **Receive Events** — Stream back agent text, tool calls, and state changes
4. **Kill Session** — Terminate the agent process

### Key RPC Methods
- `initialize` — Protocol handshake, exchange capabilities
- `sessions/create` — Create a new agent session
- `sessions/sendMessage` — Send a message to an existing session
- `sessions/list` — List active sessions
- `sessions/kill` — Terminate a session

### Tool Integration
- Agents can call tools during execution
- Tool calls are sent as JSON-RPC notifications/events
- Tool results are sent back via `sessions/sendMessage` with tool_result content

## Routa Integration

Routa's ACP layer (`src/core/acp/`) implements:
- **AcpProcessManager** — Spawns and manages agent processes
- **Session Prompt Builder** — Constructs first-turn prompts with context
- **Provider Registry** — Routes to different backends (Claude, OpenCode, etc.)

### Provider Support
| Provider | Transport | Notes |
|----------|-----------|-------|
| `claude` | Claude Code CLI | Default provider, uses Claude Code SDK when available |
| `opencode` | OpenCode CLI | Alternative Go-based provider |
| `claude-code-sdk` | SDK (TypeScript) | Serverless/edge environments |

## Usage Patterns

### Spawning a Specialist Agent
```
1. AcpProcessManager.createSession(provider, config)
2. Inject system prompt via first message
3. Listen for tool_call events
4. Execute tools, return results
5. Agent completes and reports back
```

### Orchestrator Delegation
The orchestrator delegates tasks to specialists via ACP:
- `delegateTaskWithSpawn()` creates a new session
- Specialist role determines system prompt
- Results flow back via events and task updates

## Cross-references
- → [[claude-code-sdk]] (Claude Code SDK adapter details)
- → [[provider-registry]] (Provider configuration and selection)

## Health Check
- [x] Links valid
- [x] Content current
