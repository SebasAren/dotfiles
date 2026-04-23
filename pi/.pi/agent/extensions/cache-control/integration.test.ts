import { describe, it, expect, mock, beforeEach } from "bun:test";
import { piCodingAgentMock, typeboxMock } from "../shared/src/test-mocks";

mock.module("@mariozechner/pi-coding-agent", piCodingAgentMock);
mock.module("@sinclair/typebox", typeboxMock);

import cacheControlExtension from "./index";
import { addCacheControl } from "./index";

describe("cache-control extension", () => {
  it("can be loaded without errors", () => {
    const mockApi = {
      on: mock(() => {}),
    };
    expect(() => cacheControlExtension(mockApi as any)).not.toThrow();
  });

  it("registers a before_provider_request handler", () => {
    const handlers: Record<string, Function> = {};
    const mockApi = {
      on: mock((event: string, handler: Function) => {
        handlers[event] = handler;
      }),
    };
    cacheControlExtension(mockApi as any);
    expect(handlers["before_provider_request"]).toBeDefined();
  });
});

describe("before_provider_request handler", () => {
  let handler: Function;

  beforeEach(() => {
    const handlers: Record<string, Function> = {};
    const mockApi = {
      on: mock((event: string, h: Function) => {
        handlers[event] = h;
      }),
    };
    cacheControlExtension(mockApi as any);
    handler = handlers["before_provider_request"];
  });

  it("adds cache_control to system + last message for qwen models", () => {
    const payload = {
      model: "qwen/qwen3.6-plus",
      messages: [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Hello" },
      ],
    };

    handler({ payload }, {});

    // System message: string → array with cache_control
    expect(payload.messages[0].content).toEqual([
      {
        type: "text",
        text: "You are helpful.",
        cache_control: { type: "ephemeral" },
      },
    ]);

    // Last message: string → array with cache_control
    expect(payload.messages[1].content).toEqual([
      {
        type: "text",
        text: "Hello",
        cache_control: { type: "ephemeral" },
      },
    ]);
  });

  it("returns undefined (no modification) for non-matching models", () => {
    const payload = {
      model: "anthropic/claude-sonnet-4",
      messages: [{ role: "system", content: "You are helpful." }],
    };

    const result = handler({ payload }, {});

    expect(result).toBeUndefined();
    // Content should NOT be modified
    expect(payload.messages[0].content).toBe("You are helpful.");
  });

  it("returns undefined when model field is missing", () => {
    const payload = {
      messages: [{ role: "system", content: "You are helpful." }],
    };

    const result = handler({ payload }, {});

    expect(result).toBeUndefined();
  });

  it("returns undefined when messages array is empty", () => {
    const payload = {
      model: "qwen/qwen3.6-plus",
      messages: [],
    };

    const result = handler({ payload }, {});

    expect(result).toBeUndefined();
  });

  it("handles array content by adding cache_control to last block", () => {
    const payload = {
      model: "qwen/qwen3.6-plus",
      messages: [
        {
          role: "system",
          content: [
            { type: "text", text: "Part 1" },
            { type: "text", text: "Part 2" },
          ],
        },
        { role: "user", content: "Hello" },
      ],
    };

    handler({ payload }, {});

    // Only last block in system message gets cache_control
    expect(payload.messages[0].content[0].cache_control).toBeUndefined();
    expect(payload.messages[0].content[1].cache_control).toEqual({
      type: "ephemeral",
    });
  });

  it("does not overwrite existing cache_control", () => {
    const existing = { type: "ephemeral", ttl: "1h" };
    const payload = {
      model: "qwen/qwen3.6-plus",
      messages: [
        {
          role: "system",
          content: [{ type: "text", text: "Part 1", cache_control: existing }],
        },
        { role: "user", content: "Hello" },
      ],
    };

    handler({ payload }, {});

    // Existing cache_control should be preserved
    expect(payload.messages[0].content[0].cache_control).toBe(existing);
  });

  it("matches any qwen/ model", () => {
    for (const modelId of ["qwen/qwen3.6-plus", "qwen/qwen3.5-plus", "qwen/qwen3-coder-plus"]) {
      const handlers: Record<string, Function> = {};
      const mockApi = {
        on: mock((event: string, h: Function) => {
          handlers[event] = h;
        }),
      };
      cacheControlExtension(mockApi as any);
      const h = handlers["before_provider_request"];

      const payload = {
        model: modelId,
        messages: [{ role: "system", content: "sys" }],
      };
      const result = h({ payload }, {});
      expect(result).toBeDefined();
      expect(payload.messages[0].content).toEqual([
        {
          type: "text",
          text: "sys",
          cache_control: { type: "ephemeral" },
        },
      ]);
    }
  });

  it("returns the modified payload for matching models", () => {
    const payload = {
      model: "qwen/qwen3.6-plus",
      messages: [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Hello" },
      ],
    };

    const result = handler({ payload }, {});

    expect(result).toBe(payload);
  });
});

describe("addCacheControl", () => {
  it("converts string content to array with cache_control", () => {
    const msg = { role: "system", content: "Hello world" };
    addCacheControl(msg);
    expect(msg.content).toEqual([
      { type: "text", text: "Hello world", cache_control: { type: "ephemeral" } },
    ]);
  });

  it("adds cache_control to last block of array content", () => {
    const msg = {
      role: "system",
      content: [
        { type: "text", text: "Part 1" },
        { type: "text", text: "Part 2" },
      ],
    };
    addCacheControl(msg);
    expect(msg.content[0].cache_control).toBeUndefined();
    expect(msg.content[1].cache_control).toEqual({ type: "ephemeral" });
  });

  it("does not overwrite existing cache_control", () => {
    const existing = { type: "ephemeral", ttl: "1h" };
    const msg = {
      role: "system",
      content: [{ type: "text", text: "Part 1", cache_control: existing }],
    };
    addCacheControl(msg);
    expect(msg.content[0].cache_control).toBe(existing);
  });

  it("handles empty content array gracefully", () => {
    const msg = { role: "system", content: [] };
    addCacheControl(msg);
    expect(msg.content).toEqual([]);
  });

  it("handles null content gracefully", () => {
    const msg = { role: "assistant", content: null };
    addCacheControl(msg);
    expect(msg.content).toBeNull();
  });
});
