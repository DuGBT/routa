/**
 * Trace Replay — Converts stored TraceRecord[] into higher-level event streams.
 *
 * Replays TraceRecords through AgentEventBridge to produce
 * WorkspaceAgentEvent[] (semantic block layer).
 */

import type { TraceRecord } from "./types";
import type { NormalizedSessionUpdate, NormalizedToolCall } from "../acp/provider-adapter/types";
import { AgentEventBridge, makeStartedEvent } from "../acp/agent-event-bridge";
import type { WorkspaceAgentEvent } from "../acp/agent-event-bridge/types";

// ─── TraceRecord → NormalizedSessionUpdate ────────────────────────────────────

/**
 * Map a TraceRecord to a NormalizedSessionUpdate that AgentEventBridge can
 * process. This is the "replay adapter" — it recreates the wire format from
 * the persisted trace.
 */
export function traceToNormalizedUpdate(trace: TraceRecord): NormalizedSessionUpdate | null {
  const base = {
    sessionId: trace.sessionId,
    provider: (trace.contributor?.provider ?? "unknown") as NormalizedSessionUpdate["provider"],
    timestamp: new Date(trace.timestamp),
  };

  switch (trace.eventType) {
    case "user_message":
      return {
        ...base,
        eventType: "user_message",
        message: {
          role: "user",
          content: trace.conversation?.fullContent ?? trace.conversation?.contentPreview ?? "",
          isChunk: false,
        },
      };

    case "agent_message":
      return {
        ...base,
        eventType: "agent_message",
        message: {
          role: "assistant",
          content: trace.conversation?.fullContent ?? trace.conversation?.contentPreview ?? "",
          isChunk: false,
        },
      };

    case "agent_thought":
      return {
        ...base,
        eventType: "agent_thought",
        message: {
          role: "assistant",
          content: trace.conversation?.fullContent ?? trace.conversation?.contentPreview ?? "",
          isChunk: false,
        },
      };

    case "tool_call": {
      const toolCall: NormalizedToolCall = {
        toolCallId: trace.tool?.toolCallId ?? trace.id,
        name: trace.tool?.name ?? "unknown",
        status: mapTraceToolStatus(trace.tool?.status ?? "running"),
        input: normalizeToolInput(trace.tool?.input),
        output: trace.tool?.output,
        inputFinalized: true,
      };
      return {
        ...base,
        eventType: "tool_call",
        toolCall,
      };
    }

    case "tool_result": {
      const toolCall: NormalizedToolCall = {
        toolCallId: trace.tool?.toolCallId ?? trace.id,
        name: trace.tool?.name ?? "unknown",
        status: mapTraceToolStatus(trace.tool?.status ?? "completed"),
        input: normalizeToolInput(trace.tool?.input),
        output: trace.tool?.output,
        inputFinalized: true,
      };
      return {
        ...base,
        eventType: "tool_call_update",
        toolCall,
      };
    }

    case "session_start":
      // Not a NormalizedSessionUpdate event type — handled separately
      return null;

    case "session_end":
      return {
        ...base,
        eventType: "turn_complete",
        turnComplete: {
          stopReason: "end_turn",
        },
      };

    default:
      return null;
  }
}

// ─── High-level Replay Functions ──────────────────────────────────────────────

/**
 * Replay an array of TraceRecords through AgentEventBridge.
 * Returns a time-ordered array of WorkspaceAgentEvent[].
 */
export function replayTracesAsEventBridge(
  traces: TraceRecord[],
  sessionId: string,
): WorkspaceAgentEvent[] {
  const bridge = new AgentEventBridge(sessionId);
  const events: WorkspaceAgentEvent[] = [];
  const sorted = [...traces].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const provider = sorted[0]?.contributor?.provider ?? "unknown";
  const startedAt = sorted[0]?.timestamp ? new Date(sorted[0].timestamp) : new Date();

  // Emit agent_started with the persisted trace timestamp for deterministic replay.
  events.push(makeStartedEvent(sessionId, provider, startedAt));

  for (const trace of sorted) {
    const update = traceToNormalizedUpdate(trace);
    if (update) {
      const generated = bridge.process(update);
      events.push(...generated);
    }
  }

  bridge.cleanup();
  return events;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapTraceToolStatus(status: string): NormalizedToolCall["status"] {
  switch (status) {
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "pending":
      return "pending";
    case "running":
    default:
      return "running";
  }
}

function normalizeToolInput(input: unknown): Record<string, unknown> | undefined {
  if (!input) return undefined;
  if (typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  if (typeof input === "string") {
    try {
      return JSON.parse(input);
    } catch {
      return { raw: input };
    }
  }
  return { value: input };
}
