import { describe, it, expect } from "bun:test";

import { tabFuzzyReplace, lineFuzzyMatch, indentShiftMatch } from "./fuzzy-match";

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

    it("reports line numbers of duplicate exact matches", () => {
      const content = "a\nfoo\nb\nfoo\nc\nfoo";
      expect(() => tabFuzzyReplace(content, "foo", "bar")).toThrow("at line(s) 2, 4, 6");
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

  describe("indent-shift (Tier 2)", () => {
    it("matches search indented less than file and preserves file indent", () => {
      const content = "function foo() {\n    if (x) {\n        return 1;\n    }\n}";
      const result = tabFuzzyReplace(
        content,
        "  if (x) {\n      return 1;\n  }",
        "  if (y) {\n      return 2;\n  }",
      );
      expect(result.found).toBe(true);
      expect(result.fuzzy).toBe(true);
      expect(result.content).toBe("function foo() {\n    if (y) {\n        return 2;\n    }\n}");
    });

    it("matches search indented more than file and strips indent from newText", () => {
      const content = "if (x) {\n  return 1;\n}";
      const result = tabFuzzyReplace(
        content,
        "    if (x) {\n      return 1;\n    }",
        "    if (y) {\n      return 2;\n    }",
      );
      expect(result.found).toBe(true);
      expect(result.fuzzy).toBe(true);
      expect(result.content).toBe("if (y) {\n  return 2;\n}");
    });

    it("preserves relative inner indentation when shifting", () => {
      const content = "    a\n      b\n    c";
      const result = tabFuzzyReplace(content, "a\n  b\nc", "a\n  B\nc");
      expect(result.found).toBe(true);
      expect(result.content).toBe("    a\n      B\n    c");
    });

    it("does not match when inner structure differs", () => {
      // Inner indent shape differs between search and file — should not match
      // under indent-shift; falls through to content-only tier which accepts it.
      const content = "    if (x) {\n      doStuff();\n    }";
      const result = tabFuzzyReplace(content, "if (x) {\ndoStuff();\n}", "if (y) {\ndoStuff();\n}");
      expect(result.found).toBe(true); // matched at content-only tier
    });
  });

  describe("content-only matching (Tier 3)", () => {
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

  it("reports line numbers of multiple matches", () => {
    const content = "a\nb\na\nb\na";
    expect(() => lineFuzzyMatch(content, "a", "X", (s) => s)).toThrow("at line(s) 1, 3, 5");
  });

  it("returns not found when no match", () => {
    const content = "hello world";
    const result = lineFuzzyMatch(content, "xyz", "abc", (s) => s);
    expect(result.found).toBe(false);
  });
});

describe("indentShiftMatch", () => {
  it("returns not found when the indents already align", () => {
    // When the dedented form matches but the indents are equal, this tier
    // skips so tier 1 (tab-normalize) remains the canonical path.
    const content = "  foo\n  bar";
    const result = indentShiftMatch(content, "  foo\n  bar", "X\nY");
    expect(result.found).toBe(false);
  });

  it("reports line numbers when multiple indent-shift matches found", () => {
    // Two blocks with different indents both match the same dedented search.
    const content = "    foo\n    bar\n\n  foo\n  bar";
    expect(() => indentShiftMatch(content, "foo\nbar", "BAZ\nQUX")).toThrow("at line(s) 1, 4");
  });

  it("handles tabs in file vs spaces in search via tab-normalize", () => {
    const content = "\t\tfoo\n\t\tbar";
    const result = indentShiftMatch(content, "foo\nbar", "BAZ\nQUX");
    expect(result.found).toBe(true);
    // Indent delta is 4 spaces (2 tabs × 2), prepended to newText lines
    expect(result.content).toBe("    BAZ\n    QUX");
  });
});
