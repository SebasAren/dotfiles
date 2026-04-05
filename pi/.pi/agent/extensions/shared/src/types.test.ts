import { describe, it, expect } from "bun:test";
import type { UsageStats, SubagentResult } from "./types";

// Force a runtime import to verify the module exists
import * as typesModule from "./types";

describe("types module", () => {
  it("exports UsageStats and SubagentResult (module exists)", () => {
    // Type-only exports don't appear at runtime, but the module must resolve
    expect(typesModule).toBeDefined();
  });
});

describe("UsageStats type", () => {
  it("has all required fields", () => {
    const usage: UsageStats = {
      input: 100,
      output: 50,
      cacheRead: 200,
      cacheWrite: 75,
      cost: 0.003,
      contextTokens: 500,
      turns: 3,
    };
    expect(usage.input).toBe(100);
    expect(usage.output).toBe(50);
    expect(usage.cacheRead).toBe(200);
    expect(usage.cacheWrite).toBe(75);
    expect(usage.cost).toBe(0.003);
    expect(usage.contextTokens).toBe(500);
    expect(usage.turns).toBe(3);
  });
});

describe("SubagentResult type", () => {
  it("has all required fields", () => {
    const result: SubagentResult = {
      exitCode: 0,
      output: "done",
      stderr: "",
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        cost: 0,
        contextTokens: 0,
        turns: 0,
      },
    };
    expect(result.exitCode).toBe(0);
    expect(result.output).toBe("done");
    expect(result.stderr).toBe("");
    expect(result.usage.turns).toBe(0);
  });

  it("has optional model field", () => {
    const result: SubagentResult = {
      exitCode: 0,
      output: "",
      stderr: "",
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        cost: 0,
        contextTokens: 0,
        turns: 0,
      },
      model: "codestral",
    };
    expect(result.model).toBe("codestral");
  });

  it("has optional errorMessage field", () => {
    const result: SubagentResult = {
      exitCode: 1,
      output: "",
      stderr: "error",
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        cost: 0,
        contextTokens: 0,
        turns: 0,
      },
      errorMessage: "something failed",
    };
    expect(result.errorMessage).toBe("something failed");
  });
});
