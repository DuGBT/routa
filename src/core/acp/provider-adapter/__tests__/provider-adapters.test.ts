/**
 * Provider Adapter Tests
 *
 * Tests for the Claude Code provider adapter.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ClaudeCodeAdapter } from "../claude-adapter";
import { getProviderAdapter, clearAdapterCache } from "../index";
import type { NormalizedSessionUpdate } from "../types";

describe("Provider Adapter Factory", () => {
  beforeEach(() => {
    clearAdapterCache();
  });

  it("returns ClaudeCodeAdapter for claude provider", () => {
    const adapter = getProviderAdapter("claude");
    expect(adapter.getBehavior().type).toBe("claude");
    expect(adapter.getBehavior().immediateToolInput).toBe(true);
  });

  it("normalizes provider names case-insensitively", () => {
    expect(getProviderAdapter("CLAUDE").getBehavior().type).toBe("claude");
  });

  it("handles hyphenated provider names", () => {
    expect(getProviderAdapter("claude-code").getBehavior().type).toBe("claude");
  });
});

describe("ClaudeCodeAdapter", () => {
  const adapter = new ClaudeCodeAdapter();

  describe("tool_call normalization", () => {
    it("normalizes tool_call with immediate rawInput", () => {
      const notification = {
        sessionId: "test-session",
        update: {
          sessionUpdate: "tool_call",
          toolCallId: "call_123",
          kind: "view",
          title: "View File",
          rawInput: { filePath: "/path/to/file.ts" },
        },
      };

      const result = adapter.normalize("test-session", notification) as NormalizedSessionUpdate;

      expect(result).not.toBeNull();
      expect(result.eventType).toBe("tool_call");
      expect(result.toolCall?.inputFinalized).toBe(true);
      expect(result.toolCall?.input).toEqual({ filePath: "/path/to/file.ts" });
      expect(result.toolCall?.name).toBe("view");
    });

    it("always sets inputFinalized to true (Claude behavior)", () => {
      const notification = {
        sessionId: "test-session",
        update: {
          sessionUpdate: "tool_call",
          toolCallId: "call_123",
          kind: "unknown-tool",
          rawInput: {},
        },
      };

      const result = adapter.normalize("test-session", notification) as NormalizedSessionUpdate;

      expect(result.toolCall?.inputFinalized).toBe(true);
    });
  });

  describe("agent_message_chunk normalization", () => {
    it("normalizes agent message chunks", () => {
      const notification = {
        sessionId: "test-session",
        update: {
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text: "Hello, I'm analyzing your code..." },
        },
      };

      const result = adapter.normalize("test-session", notification) as NormalizedSessionUpdate;

      expect(result.eventType).toBe("agent_message");
      expect(result.message?.isChunk).toBe(true);
      expect(result.message?.content).toBe("Hello, I'm analyzing your code...");
      expect(result.message?.role).toBe("assistant");
    });
  });
});
