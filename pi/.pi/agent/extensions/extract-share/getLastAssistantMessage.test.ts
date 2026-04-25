import { describe, it, expect } from "bun:test";
import { getLastAssistantMessage } from "./getLastAssistantMessage";

describe("getLastAssistantMessage", () => {
  it("extracts text content from the last assistant message in session entries", () => {
    const entries = [
      {
        type: "message",
        id: "2",
        parentId: "1",
        timestamp: "2",
        message: {
          role: "assistant" as const,
          content: [
            { type: "text" as const, text: "Hello world" },
            { type: "text" as const, text: "More text" },
          ],
          api: "anthropic-messages",
          provider: "anthropic",
          model: "claude-3",
          usage: {
            input: 10,
            output: 20,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 30,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
          stopReason: "stop",
          timestamp: 1000,
        },
      },
      {
        type: "message",
        id: "1",
        parentId: null,
        timestamp: "1",
        message: {
          role: "user" as const,
          content: "Hi",
          timestamp: 500,
        },
      },
    ];

    const result = getLastAssistantMessage(entries as any);
    expect(result).toBe("Hello world\nMore text");
  });

  it("returns null when there are no assistant messages", () => {
    const entries = [
      {
        type: "message",
        id: "1",
        parentId: null,
        timestamp: "1",
        message: {
          role: "user" as const,
          content: "Hello",
          timestamp: 500,
        },
      },
    ];

    const result = getLastAssistantMessage(entries as any);
    expect(result).toBeNull();
  });

  it("returns null when entries array is empty", () => {
    const result = getLastAssistantMessage([]);
    expect(result).toBeNull();
  });

  it("extracts text from the last assistant message (leaf-first, so first assistant entry wins)", () => {
    const entries = [
      {
        type: "message",
        id: "3",
        parentId: "2",
        timestamp: "3",
        message: {
          role: "assistant" as const,
          content: [{ type: "text" as const, text: "Second assistant" }],
          api: "anthropic-messages",
          provider: "anthropic",
          model: "claude-3",
          usage: {
            input: 10,
            output: 20,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 30,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
          stopReason: "stop",
          timestamp: 2000,
        },
      },
      {
        type: "message",
        id: "2",
        parentId: "1",
        timestamp: "2",
        message: {
          role: "assistant" as const,
          content: [{ type: "text" as const, text: "First assistant" }],
          api: "anthropic-messages",
          provider: "anthropic",
          model: "claude-3",
          usage: {
            input: 10,
            output: 20,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 30,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
          stopReason: "stop",
          timestamp: 1500,
        },
      },
      {
        type: "message",
        id: "1",
        parentId: null,
        timestamp: "1",
        message: {
          role: "user" as const,
          content: "Hi",
          timestamp: 500,
        },
      },
    ];

    const result = getLastAssistantMessage(entries as any);
    expect(result).toBe("Second assistant");
  });

  it("ignores thinking content and tool calls, only extracts text content", () => {
    const entries = [
      {
        type: "message",
        id: "2",
        parentId: "1",
        timestamp: "2",
        message: {
          role: "assistant" as const,
          content: [
            { type: "thinking" as const, thinking: "I need to think about this..." },
            { type: "text" as const, text: "Final answer" },
            {
              type: "toolCall" as const,
              id: "call_1",
              name: "bash",
              arguments: { command: "ls" },
            },
          ],
          api: "anthropic-messages",
          provider: "anthropic",
          model: "claude-3",
          usage: {
            input: 10,
            output: 20,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 30,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
          stopReason: "stop",
          timestamp: 1000,
        },
      },
    ];

    const result = getLastAssistantMessage(entries as any);
    expect(result).toBe("Final answer");
  });

  it("falls back to the previous assistant message when the most recent has no text", () => {
    const entries = [
      {
        type: "message",
        id: "3",
        parentId: "2",
        timestamp: "3",
        message: {
          role: "assistant" as const,
          content: [
            {
              type: "toolCall" as const,
              id: "call_1",
              name: "bash",
              arguments: { command: "ls" },
            },
          ],
          api: "anthropic-messages",
          provider: "anthropic",
          model: "claude-3",
          usage: {
            input: 10,
            output: 20,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 30,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
          stopReason: "stop",
          timestamp: 2000,
        },
      },
      {
        type: "message",
        id: "2",
        parentId: "1",
        timestamp: "2",
        message: {
          role: "assistant" as const,
          content: [{ type: "text" as const, text: "Previous answer" }],
          api: "anthropic-messages",
          provider: "anthropic",
          model: "claude-3",
          usage: {
            input: 10,
            output: 20,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 30,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
          stopReason: "stop",
          timestamp: 1500,
        },
      },
      {
        type: "message",
        id: "1",
        parentId: null,
        timestamp: "1",
        message: {
          role: "user" as const,
          content: "Hi",
          timestamp: 500,
        },
      },
    ];

    const result = getLastAssistantMessage(entries as any);
    expect(result).toBe("Previous answer");
  });
});
