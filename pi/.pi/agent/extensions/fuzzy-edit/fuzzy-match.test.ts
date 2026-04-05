import { describe, it, expect } from "bun:test";

import { tabFuzzyReplace, lineFuzzyMatch } from "./fuzzy-match";

describe("tabFuzzyReplace", () => {
  describe("exact match (Tier 0)", () => {
    it("finds and replaces exact unique match", () => {
      const content = "hello world\nfoo bar\nbaz";
      const result = tabFuzzyReplace(content, "foo bar", "FOO BAR");
      expect(result.found).toBe(true);
      expect(result.fuzzy).toBe(false);
      expect(result.content).toBe("hello world\nFOO BAR\nbaz");
    });

    it("throws when multiple exact matches found", () => {
      const content = "hello\nhello\nhello";
      expect(() => tabFuzzyReplace(content, "hello", "world")).toThrow("3 matches");
    });

    it("returns not found when text doesn't exist", () => {
      const content = "hello world";
      const result = tabFuzzyReplace(content, "xyz", "abc");
      expect(result.found).toBe(false);
    });
  });

  describe("tab-to-space normalization (Tier 1)", () => {
    it("matches when tabs are used instead of spaces", () => {
      const content = "function foo() {\n\treturn 42;\n}";
      const result = tabFuzzyReplace(content, "  return 42;", "  return 43;");
      expect(result.found).toBe(true);
      expect(result.fuzzy).toBe(true);
      expect(result.content).toBe("function foo() {\n  return 43;\n}");
    });

    it("matches with trailing whitespace differences", () => {
      const content = "line1  \nline2  \nline3";
      const result = tabFuzzyReplace(content, "line1\nline2", "LINE1\nLINE2");
      expect(result.found).toBe(true);
      expect(result.fuzzy).toBe(true);
    });
  });

  describe("content-only matching (Tier 2)", () => {
    it("matches ignoring indentation differences", () => {
      const content = "    if (x) {\n      doStuff();\n    }";
      const result = tabFuzzyReplace(content, "if (x) {\ndoStuff();\n}", "if (y) {\ndoStuff();\n}");
      expect(result.found).toBe(true);
      expect(result.fuzzy).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles empty content", () => {
      const result = tabFuzzyReplace("", "hello", "world");
      expect(result.found).toBe(false);
    });

    it("handles replacement that produces identical content", () => {
      const content = "hello world";
      const result = tabFuzzyReplace(content, "hello", "hello");
      expect(result.found).toBe(true);
      expect(result.fuzzy).toBe(false);
      expect(result.content).toBe("hello world");
    });
  });
});

describe("lineFuzzyMatch", () => {
  it("returns not found for empty search text", () => {
    const result = lineFuzzyMatch("content", "", "replacement", (s) => s);
    expect(result.found).toBe(false);
  });

  it("matches single line", () => {
    const content = "line1\nline2\nline3";
    const result = lineFuzzyMatch(content, "line2", "LINE2", (s) => s.trim());
    expect(result.found).toBe(true);
    expect(result.content).toBe("line1\nLINE2\nline3");
  });

  it("matches multiple lines", () => {
    const content = "a\nb\nc\nd\ne";
    const result = lineFuzzyMatch(content, "b\nc\nd", "B\nC\nD", (s) => s);
    expect(result.found).toBe(true);
    expect(result.content).toBe("a\nB\nC\nD\ne");
  });

  it("throws when multiple matches found", () => {
    const content = "a\nb\na\nb";
    expect(() => lineFuzzyMatch(content, "a", "X", (s) => s)).toThrow("2 matches");
  });

  it("returns not found when no match", () => {
    const content = "hello world";
    const result = lineFuzzyMatch(content, "xyz", "abc", (s) => s);
    expect(result.found).toBe(false);
  });
});
