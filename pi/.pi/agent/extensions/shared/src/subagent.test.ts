import { describe, it, expect, afterEach } from "bun:test";

// Test the model resolution and fallback logic independently.
// The full runSubagent integration is tested via the explore/librarian
// integration tests since it requires a real pi SDK setup.

import { getModel, getFallbackModel, shouldUseFallback } from "./model";

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
