import { describe, it, expect } from "bun:test";

import { parseInlineArray, parseFrontmatter } from "./parser";

describe("parseInlineArray", () => {
  it("parses a JSON array of strings", () => {
    expect(parseInlineArray('["a", "b", "c"]')).toEqual(["a", "b", "c"]);
  });

  it("returns null for non-array input", () => {
    expect(parseInlineArray("not an array")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseInlineArray("")).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(parseInlineArray('["a", "b"')).toBeNull();
  });

  it("filters non-string values", () => {
    expect(parseInlineArray('["a", 1, true, "b"]')).toEqual(["a", "b"]);
  });

  it("returns empty array for empty JSON array", () => {
    expect(parseInlineArray("[]")).toEqual([]);
  });

  it("handles whitespace around brackets", () => {
    expect(parseInlineArray('  ["a", "b"]  ')).toEqual(["a", "b"]);
  });
});

describe("parseFrontmatter", () => {
  it("parses simple key-value pairs", () => {
    const result = parseFrontmatter("---\ndescription: Test rule\n---\nBody content");
    expect(result.frontmatter.description).toBe("Test rule");
    expect(result.body).toBe("Body content");
  });

  it("parses multi-line array values", () => {
    const result = parseFrontmatter('---\npaths:\n  - "*.ts"\n  - "*.tsx"\n---\nBody');
    expect(result.frontmatter.paths).toEqual(["*.ts", "*.tsx"]);
  });

  it("parses inline array values", () => {
    const result = parseFrontmatter('---\nglobs: ["*.ts", "*.tsx"]\n---\nBody');
    expect(result.frontmatter.globs).toEqual(["*.ts", "*.tsx"]);
  });

  it("returns empty frontmatter when no frontmatter present", () => {
    const result = parseFrontmatter("Just body content");
    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe("Just body content");
  });

  it("handles quoted values", () => {
    const result = parseFrontmatter('---\ndescription: "My rule"\n---\nBody');
    expect(result.frontmatter.description).toBe("My rule");
  });

  it("handles single-quoted values", () => {
    const result = parseFrontmatter("---\ndescription: 'My rule'\n---\nBody");
    expect(result.frontmatter.description).toBe("My rule");
  });

  it("handles empty array (multi-line)", () => {
    const result = parseFrontmatter("---\npaths:\n---\nBody");
    expect(result.frontmatter.paths).toEqual([]);
  });

  it("handles key without value", () => {
    const result = parseFrontmatter("---\npaths:\n---\nBody");
    expect(result.frontmatter.paths).toEqual([]);
  });

  it("handles multiple frontmatter fields", () => {
    const result = parseFrontmatter(
      '---\ndescription: TypeScript rules\nglobs: ["*.ts"]\n---\nBody',
    );
    expect(result.frontmatter.description).toBe("TypeScript rules");
    expect(result.frontmatter.globs).toEqual(["*.ts"]);
  });

  it("preserves body with markdown content", () => {
    const body = "# Header\n\nSome **bold** text\n- list item";
    const result = parseFrontmatter(`---\ndescription: Test\n---\n${body}`);
    expect(result.body).toBe(body);
  });

  it("handles CRLF line endings", () => {
    const result = parseFrontmatter("---\r\ndescription: Test\r\n---\r\nBody");
    expect(result.frontmatter.description).toBe("Test");
    expect(result.body).toBe("Body");
  });
});
