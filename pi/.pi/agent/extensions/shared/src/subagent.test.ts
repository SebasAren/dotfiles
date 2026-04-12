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
}

/**
 * Create a mock AgentSession that emits a single `turn_end` event when
 * `prompt()` is called, producing a result described by `config`.
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
    const createSession = createMockSessionFactory([
      { errorMessage: "429 Rate limit exceeded" },
      { output: "recovered" },
    ]);

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
    const createSession = createMockSessionFactory([
      { errorMessage: "429 Rate limit exceeded" },
      { errorMessage: "429 Rate limit exceeded" }, // after 1 retry
      { output: "fallback success", model: "fallback-model" }, // fallback attempt
    ]);

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

  it("uses default maxRetries of 1 when not specified", async () => {
    // Provide exactly 2 configs: 1 initial failure + 1 retry success
    const createSession = createMockSessionFactory([
      { errorMessage: "429 Rate limit exceeded" },
      { output: "ok after default retry" },
    ]);

    const result = await runSubagent(baseOptions({ createSession }));

    expect(result.output).toBe("ok after default retry");
    expect(result.errorMessage).toBeUndefined();
  });
});
