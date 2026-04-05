import { describe, it, expect } from "bun:test";
import { splitIntoSentences, formatAsBulletList } from "./sentences";

describe("splitIntoSentences", () => {
  it("splits on sentence boundaries with capital letters", () => {
    const text = "First sentence. Second sentence. Third sentence.";
    const result = splitIntoSentences(text);
    expect(result).toHaveLength(3);
    expect(result[0].text).toBe("First sentence.");
    expect(result[1].text).toBe("Second sentence.");
    expect(result[2].text).toBe("Third sentence.");
  });

  it("splits on colon-separated thoughts", () => {
    const text = "Let me check the files: Now I see the structure: Found the issue";
    const result = splitIntoSentences(text);
    expect(result).toHaveLength(3);
    expect(result[0].text).toBe("Let me check the files");
    expect(result[1].text).toBe("Now I see the structure");
    expect(result[2].text).toBe("Found the issue");
  });

  it("handles mixed sentence endings and colons", () => {
    const text =
      "This is the first thought. Second longer thing here: Third important item! Fourth useful item? Fifth final item.";
    const result = splitIntoSentences(text);
    expect(result).toHaveLength(5);
  });

  it("filters out short fragments", () => {
    const text = "This is a longer sentence. Hi. Another long sentence here.";
    const result = splitIntoSentences(text, { minLength: 15 });
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("This is a longer sentence.");
    expect(result[1].text).toBe("Another long sentence here.");
  });

  it("truncates long sentences", () => {
    const text =
      "This is a very long sentence that exceeds the maximum length limit and should be truncated.";
    const result = splitIntoSentences(text, { maxLength: 30 });
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("This is a very long sentenc...");
    expect(result[0].truncated).toBe(true);
  });

  it("does not truncate short sentences", () => {
    const text = "Short sentence.";
    const result = splitIntoSentences(text, { maxLength: 80 });
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Short sentence.");
    expect(result[0].truncated).toBe(false);
  });

  it("returns empty array for empty input", () => {
    expect(splitIntoSentences("")).toHaveLength(0);
    expect(splitIntoSentences("   ")).toHaveLength(0);
  });

  it("returns empty array when all fragments are too short", () => {
    const text = "Hi. Ok. Go.";
    const result = splitIntoSentences(text, { minLength: 10 });
    expect(result).toHaveLength(0);
  });

  it("handles typical explore agent output", () => {
    const text =
      "I'll help you explore the codebase. Let me start by understanding the current directory structure: Now let me check the shared utilities: Found the relevant files.";
    const result = splitIntoSentences(text);
    expect(result.length).toBeGreaterThanOrEqual(3);
    // Should have meaningful fragments, not the tiny "I'll help you explore the codebase." wait that's 37 chars
    expect(result[0].text).toContain("explore");
  });

  it("handles newlines in input", () => {
    const text = "First sentence.\nSecond sentence.\nThird sentence.";
    const result = splitIntoSentences(text);
    expect(result).toHaveLength(3);
  });

  it("handles missing space after period (e.g., 'there.Now')", () => {
    const text =
      "I'll explore the structure there.Now let me check the README:Let me also check package.json";
    const result = splitIntoSentences(text);
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result[0].text).toContain("explore");
    expect(result[1].text).toContain("Now");
    expect(result[2].text).toContain("Let me");
  });
});

describe("formatAsBulletList", () => {
  it("formats fragments as bullet list", () => {
    const fragments = [
      { text: "First item", truncated: false },
      { text: "Second item", truncated: false },
    ];
    const result = formatAsBulletList(fragments);
    expect(result).toBe("  • First item\n  • Second item");
  });

  it("limits to maxItems", () => {
    const fragments = [
      { text: "First", truncated: false },
      { text: "Second", truncated: false },
      { text: "Third", truncated: false },
      { text: "Fourth", truncated: false },
      { text: "Fifth", truncated: false },
    ];
    const result = formatAsBulletList(fragments, { maxItems: 3 });
    expect(result).toContain("First");
    expect(result).toContain("Third");
    expect(result).not.toContain("Fourth");
    expect(result).toContain("+2 more");
  });

  it("uses custom bullet character", () => {
    const fragments = [{ text: "Item", truncated: false }];
    const result = formatAsBulletList(fragments, { bullet: "-" });
    expect(result).toBe("  - Item");
  });

  it("returns empty string for empty input", () => {
    expect(formatAsBulletList([])).toBe("");
  });

  it("shows correct count for overflow", () => {
    const fragments = Array(7)
      .fill(null)
      .map((_, i) => ({ text: `Item ${i + 1}`, truncated: false }));
    const result = formatAsBulletList(fragments, { maxItems: 4 });
    expect(result).toContain("+3 more");
  });
});
