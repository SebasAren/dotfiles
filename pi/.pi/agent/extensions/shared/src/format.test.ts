import { describe, it, expect } from "bun:test";
import { formatTokens, formatUsageLine } from "./format";

describe("formatTokens", () => {
  it("returns raw number for values < 1000", () => {
    expect(formatTokens(0)).toBe("0");
    expect(formatTokens(500)).toBe("500");
    expect(formatTokens(999)).toBe("999");
  });

  it("uses k suffix with one decimal for 1000–9999", () => {
    expect(formatTokens(1000)).toBe("1.0k");
    expect(formatTokens(1500)).toBe("1.5k");
    expect(formatTokens(9999)).toBe("10.0k");
  });

  it("uses k suffix with rounded whole number for 10000–999999", () => {
    expect(formatTokens(10000)).toBe("10k");
    expect(formatTokens(500000)).toBe("500k");
    expect(formatTokens(999999)).toBe("1000k");
  });

  it("uses M suffix for millions", () => {
    expect(formatTokens(1000000)).toBe("1.0M");
    expect(formatTokens(1500000)).toBe("1.5M");
  });
});

describe("formatUsageLine", () => {
  it("formats turns only", () => {
    const usage = { input: 0, output: 0, turns: 3, cost: 0 };
    expect(formatUsageLine(usage)).toBe("3 turns");
  });

  it("formats single turn without plural s", () => {
    const usage = { input: 0, output: 0, turns: 1, cost: 0 };
    expect(formatUsageLine(usage)).toBe("1 turn");
  });

  it("includes token counts", () => {
    const usage = { input: 1500, output: 800, turns: 1, cost: 0 };
    expect(formatUsageLine(usage)).toBe("1 turn ↑1.5k ↓800");
  });

  it("includes cost when present", () => {
    const usage = { input: 1000, output: 500, turns: 1, cost: 0.0015 };
    expect(formatUsageLine(usage)).toContain("$0.0015");
  });

  it("includes model name when provided", () => {
    const usage = { input: 0, output: 0, turns: 1, cost: 0 };
    expect(formatUsageLine(usage, "gpt-4o-mini")).toContain("gpt-4o-mini");
  });

  it("formats full usage line", () => {
    const usage = { input: 50000, output: 20000, turns: 4, cost: 0.03 };
    const result = formatUsageLine(usage, "codestral");
    expect(result).toBe("4 turns ↑50k ↓20k $0.0300 codestral");
  });
});
