import { describe, it, expect } from "bun:test";

import { generateDiff } from "./diff";

describe("generateDiff", () => {
  it("detects a single line addition", () => {
    const result = generateDiff("line1\nline2", "line1\nnew line\nline2");
    expect(result.diff).toContain("+");
    expect(result.firstChangedLine).toBe(2);
  });

  it("detects a single line removal", () => {
    const result = generateDiff("line1\nline2\nline3", "line1\nline3");
    expect(result.diff).toContain("-");
    expect(result.firstChangedLine).toBeUndefined();
  });

  it("detects a line modification", () => {
    const result = generateDiff("hello world", "hello earth");
    expect(result.diff).toContain("-");
    expect(result.diff).toContain("+");
    expect(result.firstChangedLine).toBe(1);
  });

  it("handles identical content (no diff)", () => {
    const result = generateDiff("same content", "same content");
    expect(result.diff).toBe("");
    expect(result.firstChangedLine).toBeUndefined();
  });

  it("handles multi-line changes", () => {
    const oldContent = "a\nb\nc\nd\ne";
    const newContent = "a\nB\nC\nd\ne";
    const result = generateDiff(oldContent, newContent);
    expect(result.diff).toContain("+");
    expect(result.diff).toContain("-");
  });

  it("handles empty old content", () => {
    const result = generateDiff("", "new content");
    expect(result.diff).toContain("+");
    expect(result.firstChangedLine).toBe(1);
  });

  it("handles empty new content", () => {
    const result = generateDiff("old content", "");
    expect(result.diff).toContain("-");
    expect(result.firstChangedLine).toBeUndefined();
  });

  it("produces zero-padded line numbers", () => {
    const result = generateDiff("a\nb", "a\nc");
    expect(result.diff).toMatch(/ \d/);
  });

  it("includes context lines around changes", () => {
    const oldLines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join("\n");
    const newLines = oldLines.replace("line 10", "LINE 10");
    const result = generateDiff(oldLines, newLines);
    expect(result.diff).toContain("line 9");
    expect(result.diff).toContain("LINE 10");
  });
});
