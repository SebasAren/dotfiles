import { describe, it, expect } from "bun:test";
import { parseSections, getSectionSummary } from "./markdown";

describe("parseSections", () => {
  it("parses ## Title sections with content", () => {
    const input = "## Overview\nSome content\n## Details\nMore content";
    const sections = parseSections(input);
    expect(sections).toHaveLength(2);
    expect(sections[0].title).toBe("Overview");
    expect(sections[0].content).toBe("Some content");
    expect(sections[1].title).toBe("Details");
    expect(sections[1].content).toBe("More content");
  });

  it("handles section without content", () => {
    const input = "## Summary";
    const sections = parseSections(input);
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe("Summary");
    expect(sections[0].content).toBe("");
  });

  it("returns a section from text before any ## header", () => {
    const input = "Just some plain text\nNo headers here";
    const sections = parseSections(input);
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe("Just some plain text");
    expect(sections[0].content).toBe("No headers here");
  });

  it("handles multiline section content", () => {
    const input = "## Overview\nLine one\nLine two\nLine three\n## End";
    const sections = parseSections(input);
    expect(sections).toHaveLength(2);
    expect(sections[0].content).toBe("Line one\nLine two\nLine three");
  });

  it("trims whitespace from title and content", () => {
    const input = "##  Title  \n  Content line  ";
    const sections = parseSections(input);
    expect(sections[0].title).toBe("Title");
    expect(sections[0].content).toBe("Content line");
  });
});

describe("getSectionSummary", () => {
  it("returns full first line if within maxLen", () => {
    expect(getSectionSummary("Short line", 20)).toBe("Short line");
  });

  it("returns first line truncated with ellipsis when exceeding maxLen", () => {
    const content = "This is a very long first line that exceeds the limit";
    expect(getSectionSummary(content, 20)).toBe("This is a very long…");
  });

  it("skips blank lines and returns first non-empty line", () => {
    const content = "\n\n  \nActual first line\nSecond line";
    expect(getSectionSummary(content, 50)).toBe("Actual first line");
  });

  it("returns empty string for empty content", () => {
    expect(getSectionSummary("")).toBe("");
  });

  it("uses default maxLen of 100", () => {
    const content = "A".repeat(99);
    expect(getSectionSummary(content)).toBe(content);
    expect(getSectionSummary("A".repeat(101)).length).toBe(100); // 99 chars + "…"
  });
});
