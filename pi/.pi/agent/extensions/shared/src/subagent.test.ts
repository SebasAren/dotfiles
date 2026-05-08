import { describe, it, expect, afterEach, beforeEach } from "bun:test";

// Test the model resolution and fallback logic independently.
// The full runSubagent retry integration is tested below using mock sessions.

import { getModel, getFallbackModel, shouldUseFallback } from "./model";
import { runSubagent } from "./subagent";
import type { RunSubagentOptions } from "./subagent";

describe("getModel", () => {
  const original = process.env.CHEAP_MODEL;

  afterEach(() => {
    if (original !== undefined) {
      process.env.CHEAP_MODEL = original;
    } else {
      delete process.env.CHEAP_MODEL;
    }
  });

  it("returns undefined when CHEAP_MODEL is not set", () => {
    delete process.env.CHEAP_MODEL;
    expect(getModel()).toBeUndefined();
  });

  it("returns the CHEAP_MODEL value when set", () => {
    process.env.CHEAP_MODEL = "test-model";
    expect(getModel()).toBe("test-model");
  });
});

describe("getFallbackModel", () => {
  const original = process.env.FALLBACK_MODEL;

  afterEach(() => {
    if (original !== undefined) {
      process.env.FALLBACK_MODEL = original;
    } else {
      delete process.env.FALLBACK_MODEL;
    }
  });

  it("returns undefined when FALLBACK_MODEL is not set", () => {
    delete process.env.FALLBACK_MODEL;
    expect(getFallbackModel()).toBeUndefined();
  });

  it("returns the FALLBACK_MODEL value when set", () => {
    process.env.FALLBACK_MODEL = "fallback-model";
    expect(getFallbackModel()).toBe("fallback-model");
  });
});

describe("shouldUseFallback", () => {
  it("returns true for rate limit errors", () => {
    expect(shouldUseFallback("429 Rate limit exceeded")).toBe(true);
    expect(shouldUseFallback("rate_limit_error")).toBe(true);
    expect(shouldUseFallback("Too many requests")).toBe(true);
  });

  it("returns true for server errors", () => {
    expect(shouldUseFallback("503 Service Unavailable")).toBe(true);
    expect(shouldUseFallback("502 Bad Gateway")).toBe(true);
    expect(shouldUseFallback("Internal server error")).toBe(true);
  });

  it("returns true for connection errors", () => {
    expect(shouldUseFallback("ECONNREFUSED")).toBe(true);
    expect(shouldUseFallback("connection reset")).toBe(true);
    expect(shouldUseFallback("ETIMEDOUT")).toBe(true);
  });

  it("returns false for non-transient errors", () => {
    expect(shouldUseFallback("Invalid API key")).toBe(false);
    expect(shouldUseFallback("Permission denied")).toBe(false);
    expect(shouldUseFallback(undefined)).toBe(false);
    expect(shouldUseFallback("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Mock session factory for testing runSubagent retry / fallback logic
// ---------------------------------------------------------------------------

interface MockSessionConfig {
  output?: string;
  errorMessage?: string;
  /** Model name to attach to the turn_end event (mirrors SDK behavior). */
  model?: string;
  /** Tool calls to emit as tool_execution_start/tool_execution_end events. */
  toolCalls?: Array<{ toolName: string; args: Record<string, unknown>; isError?: boolean }>;
}

/**
 * Create a mock AgentSession that emits tool_execution_start events (if
 * configured) followed by a single `turn_end` event when `prompt()` is
 * called, producing a result described by `config`.
 */
function createMockSession(config: MockSessionConfig) {
  const listeners: Array<(event: any) => void> = [];

  return {
    subscribe: (cb: (event: any) => void) => {
      listeners.push(cb);
      return () => {
        const idx = listeners.indexOf(cb);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    },
    prompt: async (_query: string) => {
      // Emit tool_execution_start + tool_execution_end for each tool call
      for (const toolCall of config.toolCalls || []) {
        for (const listener of listeners) {
          listener({
            type: "tool_execution_start",
            toolName: toolCall.toolName,
            args: toolCall.args,
          });
        }
        for (const listener of listeners) {
          listener({
            type: "tool_execution_end",
            toolName: toolCall.toolName,
            toolCallId: "mock-call-id",
            result: null,
            isError: toolCall.isError ?? false,
          });
        }
      }
      // Emit turn_end
      for (const listener of listeners) {
        listener({
          type: "turn_end",
          message: {
            role: "assistant",
            errorMessage: config.errorMessage,
            model: config.model,
            content: config.output ? [{ type: "text", text: config.output }] : [],
            usage: {
              input: 10,
              output: 5,
              cacheRead: 0,
              cacheWrite: 0,
              cost: { total: 0.001 },
              totalTokens: 15,
            },
          },
        });
      }
    },
    abort: async () => {},
    steer: async () => {},
    dispose: () => {},
    agent: { waitForIdle: async () => {} },
  } as any;
}

/**
 * Create a mock AgentSession whose `prompt()` behavior cycles through
 * a sequence of configs. Each call to `prompt()` produces the next config's
 * result. This is needed for testing session reuse across retries.
 */
function createMockSessionWithBehaviors(configs: MockSessionConfig[]) {
  const listeners: Array<(event: any) => void> = [];
  let promptIndex = 0;

  return {
    subscribe: (cb: (event: any) => void) => {
      listeners.push(cb);
      return () => {
        const idx = listeners.indexOf(cb);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    },
    prompt: async (_query: string) => {
      const config = configs[Math.min(promptIndex, configs.length - 1)];
      promptIndex++;
      for (const listener of listeners) {
        listener({
          type: "turn_end",
          message: {
            role: "assistant",
            errorMessage: config.errorMessage,
            model: config.model,
            content: config.output ? [{ type: "text", text: config.output }] : [],
            usage: {
              input: 10,
              output: 5,
              cacheRead: 0,
              cacheWrite: 0,
              cost: { total: 0.001 },
              totalTokens: 15,
            },
          },
        });
      }
    },
    abort: async () => {},
    steer: async () => {},
    dispose: () => {},
    agent: { waitForIdle: async () => {} },
  } as any;
}

/**
 * Create a mock AgentSession whose `prompt()` never resolves.
 * Used for testing timeout and abort signal handling.
 */
/** Hanging session whose prompt never resolves. Used for timeout tests. */
function createHangingSession(): any {
  const listeners: Array<(event: any) => void> = [];
  return {
    subscribe: (cb: (event: any) => void) => {
      listeners.push(cb);
      return () => {
        const idx = listeners.indexOf(cb);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    },
    prompt: async (_query: string) => {
      await new Promise(() => {}); // never resolves
    },
    abort: async () => {},
    steer: async () => {},
    dispose: () => {},
    agent: { waitForIdle: async () => {} },
  } as any;
}

/** Hanging session whose prompt resolves when abort() is called. Used for abort signal tests. */
function createAbortableHangingSession(): any {
  const listeners: Array<(event: any) => void> = [];
  let _resolveAbort: (() => void) | undefined;
  const abortHandled = new Promise<void>((resolve) => {
    _resolveAbort = resolve;
  });
  return {
    subscribe: (cb: (event: any) => void) => {
      listeners.push(cb);
      return () => {
        const idx = listeners.indexOf(cb);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    },
    prompt: async (_query: string) => {
      await abortHandled;
    },
    abort: async () => {
      _resolveAbort?.();
    },
    steer: async () => {},
    dispose: () => {},
    agent: { waitForIdle: async () => {} },
  } as any;
}

/**
 * Create a `createSession` factory that cycles through a sequence of mock
 * session configs. Each call to the factory produces the next config's session.
 * If the factory is called more times than configs provided, it reuses the
 * last config.
 */
function createMockSessionFactory(configs: MockSessionConfig[]) {
  let index = 0;
  return async (_systemPrompt: string, _cwd: string, _modelName?: string) => {
    const config = configs[Math.min(index, configs.length - 1)];
    index++;
    return createMockSession(config);
  };
}

/** Build minimal RunSubagentOptions with sensible defaults for retry tests. */
function baseOptions(overrides: Partial<RunSubagentOptions> = {}): RunSubagentOptions {
  return {
    cwd: "/tmp",
    query: "test query",
    systemPrompt: "test system prompt",
    createSession: createMockSessionFactory([{ output: "ok" }]),
    model: "test-model",
    // Zero delay so tests run fast
    _retryDelayMs: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// runSubagent retry tests
// ---------------------------------------------------------------------------

describe("runSubagent retry logic", () => {
  // Save/restore FALLBACK_MODEL to isolate tests from the environment
  const savedFallback = process.env.FALLBACK_MODEL;
  afterEach(() => {
    if (savedFallback !== undefined) process.env.FALLBACK_MODEL = savedFallback;
    else delete process.env.FALLBACK_MODEL;
  });

  // Ensure no fallback model leaks from env into these tests unless explicitly set
  beforeEach(() => {
    delete process.env.FALLBACK_MODEL;
  });

  it("returns immediately on first success (no retry)", async () => {
    const createSession = createMockSessionFactory([{ output: "success" }]);

    const result = await runSubagent(baseOptions({ createSession }));

    expect(result.output).toBe("success");
    expect(result.errorMessage).toBeUndefined();
  });

  it("retries on transient failure and returns when second attempt succeeds", async () => {
    // Single session reused across attempts — prompt() fails first, succeeds second
    const session = createMockSessionWithBehaviors([
      { errorMessage: "429 Rate limit exceeded" },
      { output: "recovered" },
    ]);
    const createSession = async () => session;

    const result = await runSubagent(baseOptions({ createSession, maxRetries: 1 }));

    expect(result.output).toBe("recovered");
    expect(result.errorMessage).toBeUndefined();
  });

  it("retries up to maxRetries then gives up", async () => {
    const createSession = createMockSessionFactory([
      { errorMessage: "503 Service Unavailable" },
      { errorMessage: "503 Service Unavailable" },
      { errorMessage: "503 Service Unavailable" },
    ]);

    const result = await runSubagent(baseOptions({ createSession, maxRetries: 2 }));

    // Should have retried twice (3 total attempts) and returned the last failure
    expect(result.errorMessage).toBe("503 Service Unavailable");
  });

  it("does not retry when maxRetries is 0", async () => {
    const createSession = createMockSessionFactory([
      { errorMessage: "429 Rate limit exceeded" },
      { output: "should not reach" },
    ]);

    const result = await runSubagent(baseOptions({ createSession, maxRetries: 0 }));

    // First (and only) attempt failed — no retry
    expect(result.errorMessage).toBe("429 Rate limit exceeded");
  });

  it("does not retry on non-transient errors", async () => {
    const createSession = createMockSessionFactory([
      { errorMessage: "Invalid API key" },
      { output: "should not reach" },
    ]);

    const result = await runSubagent(baseOptions({ createSession, maxRetries: 2 }));

    // "Invalid API key" is not a transient error — no retry
    expect(result.errorMessage).toBe("Invalid API key");
  });

  it("switches to fallback model after retries exhausted", async () => {
    // Primary session fails on both attempts (original + 1 retry)
    const primarySession = createMockSessionWithBehaviors([
      { errorMessage: "429 Rate limit exceeded" },
      { errorMessage: "429 Rate limit exceeded" },
    ]);
    // Fallback session succeeds
    const fallbackSession = createMockSession({
      output: "fallback success",
      model: "fallback-model",
    });
    let callCount = 0;
    const createSession = async () => {
      return callCount++ === 0 ? primarySession : fallbackSession;
    };

    const result = await runSubagent(
      baseOptions({
        createSession,
        maxRetries: 1,
        fallbackModel: "fallback-model",
      }),
    );

    expect(result.output).toBe("fallback success");
    expect(result.errorMessage).toBeUndefined();
  });

  it("does not use fallback when it equals the primary model", async () => {
    const createSession = createMockSessionFactory([
      { errorMessage: "429 Rate limit exceeded" },
      { output: "should not reach" },
    ]);

    const result = await runSubagent(
      baseOptions({
        createSession,
        maxRetries: 0,
        model: "same-model",
        fallbackModel: "same-model",
      }),
    );

    // Fallback is same as primary — no fallback attempt
    expect(result.errorMessage).toBe("429 Rate limit exceeded");
  });

  it("returns fallback failure when fallback also fails", async () => {
    const createSession = createMockSessionFactory([
      { errorMessage: "429 Rate limit exceeded" },
      { errorMessage: "502 Bad Gateway" }, // fallback attempt
    ]);

    const result = await runSubagent(
      baseOptions({
        createSession,
        maxRetries: 0,
        fallbackModel: "fallback-model",
      }),
    );

    // Fallback also failed — return its failure
    expect(result.errorMessage).toBe("502 Bad Gateway");
  });

  it("calls onUpdate with retry message during retries", async () => {
    const createSession = createMockSessionFactory([
      { errorMessage: "429 Rate limit exceeded" },
      { output: "ok" },
    ]);
    const updates: string[] = [];

    await runSubagent(
      baseOptions({
        createSession,
        maxRetries: 1,
        onUpdate: (update) => updates.push(update.text),
      }),
    );

    expect(updates.some((text) => text.includes("Retrying (1/1)"))).toBe(true);
  });

  it("uses default maxRetries of 3 when not specified", async () => {
    // Session reused across retries — fails first 2 times, succeeds on 3rd retry
    // (attempt 0 + retries 1, 2, 3 → but succeeds at retry 2, which is within 3 max)
    const session = createMockSessionWithBehaviors([
      { errorMessage: "429 Rate limit exceeded" },
      { errorMessage: "429 Rate limit exceeded" },
      { output: "ok after default retry" },
    ]);
    const createSession = async () => session;

    const result = await runSubagent(baseOptions({ createSession }));

    expect(result.output).toBe("ok after default retry");
    expect(result.errorMessage).toBeUndefined();
  });

  it("SUBAGENT_MAX_RETRIES env var overrides the default maxRetries", async () => {
    const original = process.env.SUBAGENT_MAX_RETRIES;
    try {
      process.env.SUBAGENT_MAX_RETRIES = "1";

      const session = createMockSessionWithBehaviors([
        { errorMessage: "429 Rate limit exceeded" },
        { output: "ok after env retry" },
      ]);
      const createSession = async () => session;

      const result = await runSubagent(baseOptions({ createSession }));

      expect(result.output).toBe("ok after env retry");
      expect(result.errorMessage).toBeUndefined();
    } finally {
      if (original !== undefined) process.env.SUBAGENT_MAX_RETRIES = original;
      else delete process.env.SUBAGENT_MAX_RETRIES;
    }
  });

  it("SUBAGENT_MAX_RETRIES env var is clamped to >= 0", async () => {
    const original = process.env.SUBAGENT_MAX_RETRIES;
    try {
      process.env.SUBAGENT_MAX_RETRIES = "-5";

      const createSession = createMockSessionFactory([
        { errorMessage: "429 Rate limit exceeded" },
        { output: "should not reach" },
      ]);

      const result = await runSubagent(baseOptions({ createSession }));

      // Negative value clamped to 0 — no retry, returns failure
      expect(result.errorMessage).toBe("429 Rate limit exceeded");
    } finally {
      if (original !== undefined) process.env.SUBAGENT_MAX_RETRIES = original;
      else delete process.env.SUBAGENT_MAX_RETRIES;
    }
  });

  it("reuses the same session across retries (createSession called once)", async () => {
    let sessionCount = 0;
    const session = createMockSessionWithBehaviors([
      { errorMessage: "429 Rate limit exceeded" },
      { output: "recovered via session reuse" },
    ]);
    const createSession = async () => {
      sessionCount++;
      return session;
    };

    await runSubagent(baseOptions({ createSession, maxRetries: 1 }));

    // Session should be created only once and reused for the retry
    expect(sessionCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// onToolCall callback tests
// ---------------------------------------------------------------------------

describe("onToolCall callback", () => {
  it("calls onToolCall with toolName, argsSummary, durationMs, success for each tool call", async () => {
    const calls: Array<{
      toolName: string;
      argsSummary: string;
      durationMs: number;
      success: boolean;
    }> = [];

    const session = createMockSession({
      output: "search complete",
      toolCalls: [
        { toolName: "read", args: { path: "test.ts" } },
        { toolName: "grep", args: { pattern: "function" } },
      ],
    });

    await runSubagent(
      baseOptions({
        createSession: async () => session,
        onToolCall: (info) => calls.push(info),
      }),
    );

    expect(calls.length).toBe(2);

    // First call: read
    expect(calls[0].toolName).toBe("read");
    expect(calls[0].argsSummary).toContain("test.ts");
    expect(typeof calls[0].durationMs).toBe("number");
    expect(calls[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(calls[0].success).toBe(true);

    // Second call: grep
    expect(calls[1].toolName).toBe("grep");
    expect(calls[1].argsSummary).toContain("function");
    expect(typeof calls[1].durationMs).toBe("number");
    expect(calls[1].durationMs).toBeGreaterThanOrEqual(0);
    expect(calls[1].success).toBe(true);
  });

  it("reports success=false when tool_execution_end.isError is true", async () => {
    const calls: Array<{
      toolName: string;
      argsSummary: string;
      durationMs: number;
      success: boolean;
    }> = [];

    const session = createMockSession({
      toolCalls: [{ toolName: "bash", args: { command: "invalid" }, isError: true }],
    });

    await runSubagent(
      baseOptions({
        createSession: async () => session,
        onToolCall: (info) => calls.push(info),
      }),
    );

    expect(calls.length).toBe(1);
    expect(calls[0].toolName).toBe("bash");
    expect(calls[0].success).toBe(false);
  });

  it("does not call onToolCall when no tool calls occur", async () => {
    const calls: Array<{
      toolName: string;
      argsSummary: string;
      durationMs: number;
      success: boolean;
    }> = [];

    const session = createMockSession({
      output: "direct response",
    });

    await runSubagent(
      baseOptions({
        createSession: async () => session,
        onToolCall: (info) => calls.push(info),
      }),
    );

    expect(calls.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// onToolCall error swallowing
// ---------------------------------------------------------------------------

describe("onToolCall error handling", () => {
  it("swallows errors from onToolCall callback", async () => {
    const session = createMockSession({
      output: "done",
      toolCalls: [{ toolName: "read", args: { path: "file.ts" } }],
    });

    // onToolCall that throws should not crash the subagent
    const result = await runSubagent(
      baseOptions({
        createSession: async () => session,
        onToolCall: () => {
          throw new Error("callback error");
        },
      }),
    );

    expect(result.output).toBe("done");
    expect(result.errorMessage).toBeUndefined();
  });

  it("covers pendingToolCalls push and argsSummary code point truncation", async () => {
    const calls: Array<{ argsSummary: string }> = [];

    // Use a `path` arg (not truncated by formatRecentCall) long enough to exceed 100 code points.
    // "read: " (6) + 95 x's = 101 > 100 → truncated to 97 chars + "..."
    const longPath = "x".repeat(95);
    const session = createMockSession({
      output: "done",
      toolCalls: [
        { toolName: "read", args: { path: longPath } },
        { toolName: "noargs", args: {} },
      ],
    });

    await runSubagent(
      baseOptions({
        createSession: async () => session,
        onToolCall: (info) => calls.push({ argsSummary: info.argsSummary }),
      }),
    );

    expect(calls.length).toBe(2);
    // The callLine = "read: xxxx...xxx" (6 + 95 = 101 > 100) → truncated to 97 chars + "..."
    expect(calls[0].argsSummary).toMatch(/^read: x+\.{3}$/);
    expect(calls[0].argsSummary.length).toBe(100);
    // noargs has no recognized arg key → argsSummary = "noargs"
    expect(calls[1].argsSummary).toBe("noargs");
  });
});

// ---------------------------------------------------------------------------
// Budget exhaustion (maxToolCalls)
// ---------------------------------------------------------------------------

describe("budget exhaustion", () => {
  it("steers on budget exhaustion (exceeds maxToolCalls)", async () => {
    // maxToolCalls=3, TOOL_CALL_GRACE_BUFFER=5 → steering at 4th call
    const toolCalls = [
      { toolName: "read", args: { path: "a.ts" } },
      { toolName: "read", args: { path: "b.ts" } },
      { toolName: "read", args: { path: "c.ts" } },
      { toolName: "read", args: { path: "d.ts" } }, // 4th → triggers steering
    ];
    const session = createMockSession({
      output: "final result",
      toolCalls,
    });

    const result = await runSubagent(
      baseOptions({
        createSession: async () => session,
        maxToolCalls: 3,
      }),
    );

    // Should complete normally, output should contain the budget exhaustion message
    expect(result.output).toContain("Budget exhausted");
    expect(result.output).toContain("final result");
  });

  it("hard aborts when tool calls exceed budget + grace buffer", async () => {
    const toolCalls = [
      { toolName: "read", args: { path: "a.ts" } },
      { toolName: "read", args: { path: "b.ts" } },
      { toolName: "read", args: { path: "c.ts" } },
      { toolName: "read", args: { path: "d.ts" } }, // 4th → steering
      { toolName: "read", args: { path: "e.ts" } },
      { toolName: "read", args: { path: "f.ts" } },
      { toolName: "read", args: { path: "g.ts" } },
      { toolName: "read", args: { path: "h.ts" } },
      { toolName: "read", args: { path: "i.ts" } }, // 9th > 3+5=8 → hard abort
    ];
    const session = createMockSession({
      output: "won't reach",
      toolCalls,
    });

    const result = await runSubagent(
      baseOptions({
        createSession: async () => session,
        maxToolCalls: 3,
      }),
    );

    expect(result.output).toContain("Stopped: exceeded");
    // The prompt output should be before the budget messages since events fire
    // synchronously during prompt, and stop on hard abort.
    expect(result.output).toContain("budget was 3");
  });
});

// ---------------------------------------------------------------------------
// Loop detection
// ---------------------------------------------------------------------------

describe("loop detection", () => {
  it("aborts on kill-level loop (4+ consecutive identical calls)", async () => {
    // 4 identical calls → detectLoop returns severity "kill"
    const toolCalls = [
      { toolName: "grep", args: { pattern: "test" } },
      { toolName: "grep", args: { pattern: "test" } },
      { toolName: "grep", args: { pattern: "test" } },
      { toolName: "grep", args: { pattern: "test" } }, // 4th → kill
    ];
    const session = createMockSession({
      output: "won't reach",
      toolCalls,
    });

    const result = await runSubagent(
      baseOptions({
        createSession: async () => session,
        loopDetection: true,
      }),
    );

    expect(result.output).toContain("Stopped: Loop detected");
    expect(result.output).toContain("grep called 4 times");
  });

  it("does not hard-abort on warn-level loop (3 identical) — continues to output", async () => {
    const toolCalls = [
      { toolName: "grep", args: { pattern: "test" } },
      { toolName: "grep", args: { pattern: "test" } },
      { toolName: "grep", args: { pattern: "test" } }, // 3rd → warn, but don't abort
    ];
    const session = createMockSession({
      output: "continued after warning",
      toolCalls,
    });

    const result = await runSubagent(
      baseOptions({
        createSession: async () => session,
        loopDetection: true,
      }),
    );

    // Warn-level doesn't stop execution, so we get the full output
    expect(result.output).toContain("continued after warning");
    // No stopped message
    expect(result.output).not.toContain("Stopped");
  });
});

// ---------------------------------------------------------------------------
// Timeout
// ---------------------------------------------------------------------------

describe("timeout handling", () => {
  it("returns timeout error when prompt exceeds timeoutMs", async () => {
    // A session whose prompt never resolves
    const session = createHangingSession();

    const result = await runSubagent(
      baseOptions({
        createSession: async () => session,
        timeoutMs: 50,
        _retryDelayMs: 0,
      }),
    );

    expect(result.errorMessage).toContain("timed out");
  });
});

// ---------------------------------------------------------------------------
// Abort signal
// ---------------------------------------------------------------------------

describe("abort signal handling", () => {
  it("throws on external abort signal", async () => {
    const controller = new AbortController();
    const session = createAbortableHangingSession();

    const promise = runSubagent(
      baseOptions({
        createSession: async () => session,
        signal: controller.signal,
        timeoutMs: 1000, // long enough not to race with the abort, but quick fail if abort doesn't work
        _retryDelayMs: 0,
      }),
    );

    // Fire abort after the function starts
    await new Promise((resolve) => setTimeout(resolve, 50));
    controller.abort();

    await expect(promise).rejects.toThrow("Subagent was aborted");
  });
});

// ---------------------------------------------------------------------------
// Prompt error propagation
// ---------------------------------------------------------------------------

describe("prompt error handling", () => {
  it("captures unexpected prompt errors in stderr", async () => {
    // A session whose prompt rejects with an unexpected error
    const listeners: Array<(event: any) => void> = [];
    const session = {
      subscribe: (cb: (event: any) => void) => {
        listeners.push(cb);
        return () => {
          const idx = listeners.indexOf(cb);
          if (idx >= 0) listeners.splice(idx, 1);
        };
      },
      prompt: async (_query: string) => {
        // Emit turn_end first so output is set (prevents timeout from being the only error)
        for (const listener of listeners) {
          listener({
            type: "turn_end",
            message: {
              role: "assistant",
              content: [],
              usage: {
                input: 1,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                cost: { total: 0 },
                totalTokens: 1,
              },
            },
          });
        }
        throw new Error("Unexpected prompt failure");
      },
      abort: async () => {},
      steer: async () => {},
      dispose: () => {},
      agent: { waitForIdle: async () => {} },
    } as any;

    const result = await runSubagent(
      baseOptions({
        createSession: async () => session,
        _retryDelayMs: 0,
        maxRetries: 0, // no retry so we see the prompt error
      }),
    );

    // The error should be captured in stderr
    expect(result.stderr).toContain("Unexpected prompt failure");
  });
});

// ---------------------------------------------------------------------------
// No-output fallback
// ---------------------------------------------------------------------------

describe("no-output fallback", () => {
  it("synthesizes fallback output when no text is produced and no tool calls ran", async () => {
    const session = createMockSession({
      output: "", // empty output
      toolCalls: [],
    });

    const result = await runSubagent(
      baseOptions({
        createSession: async () => session,
        _retryDelayMs: 0,
      }),
    );

    expect(result.output).toContain("Subagent exited without producing any output");
  });

  it("synthesizes fallback output with tool call activity when tool calls ran but no text produced", async () => {
    const session = createMockSession({
      output: "", // empty output
      toolCalls: [
        { toolName: "read", args: { path: "file.ts" } },
        { toolName: "grep", args: { pattern: "function" } },
      ],
    });

    const result = await runSubagent(
      baseOptions({
        createSession: async () => session,
        _retryDelayMs: 0,
      }),
    );

    expect(result.output).toContain("The subagent ran 2 tool calls");
    expect(result.output).toContain("1. read: file.ts");
    expect(result.output).toContain("2. grep: function");
  });
});

// ---------------------------------------------------------------------------
// Flush pending tool calls on early exit
// ---------------------------------------------------------------------------

describe("flush pending tool calls", () => {
  it("flushes pending onToolCall entries when no tool_execution_end fires", async () => {
    const calls: Array<{ toolName: string; success: boolean }> = [];

    // Session that fires tool_execution_start but NO tool_execution_end
    // This simulates the case where the prompt resolves but end events never fired.
    const listeners: Array<(event: any) => void> = [];
    const session = {
      subscribe: (cb: (event: any) => void) => {
        listeners.push(cb);
        return () => {
          const idx = listeners.indexOf(cb);
          if (idx >= 0) listeners.splice(idx, 1);
        };
      },
      prompt: async (_query: string) => {
        // Fire tool_execution_start but NOT tool_execution_end
        for (const listener of listeners) {
          listener({
            type: "tool_execution_start",
            toolName: "read",
            args: { path: "file.ts" },
          });
        }
        for (const listener of listeners) {
          listener({
            type: "tool_execution_start",
            toolName: "bash",
            args: { command: "test" },
          });
        }
        // Emit turn_end
        for (const listener of listeners) {
          listener({
            type: "turn_end",
            message: {
              role: "assistant",
              content: [{ type: "text", text: "done" }],
              usage: {
                input: 1,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                cost: { total: 0 },
                totalTokens: 1,
              },
            },
          });
        }
      },
      abort: async () => {},
      steer: async () => {},
      dispose: () => {},
      agent: { waitForIdle: async () => {} },
    } as any;

    await runSubagent(
      baseOptions({
        createSession: async () => session,
        onToolCall: (info) => calls.push({ toolName: info.toolName, success: info.success }),
      }),
    );

    // Both tool calls should be flushed with success=false
    expect(calls.length).toBe(2);
    expect(calls.every((c) => c.success === false)).toBe(true);
    expect(calls.map((c) => c.toolName).sort()).toEqual(["bash", "read"]);
  });
});
