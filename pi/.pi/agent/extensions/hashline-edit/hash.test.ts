import { describe, it, expect } from "bun:test";

import { hashLine, parseAnchor, validateAnchor, stripDisplayPrefix } from "./hash";

describe("hashLine", () => {
  it("returns a 2-character hash", () => {
    const h = hashLine("function hello() {", 1);
    expect(h).toHaveLength(2);
    expect(h).toMatch(/^[A-Z]{2}$/);
  });

  it("is deterministic — same input produces same hash", () => {
    const h1 = hashLine("  return 42;", 1);
    const h2 = hashLine("  return 42;", 1);
    expect(h1).toBe(h2);
  });

  it("varies with content", () => {
    const h1 = hashLine("function hello() {", 1);
    const h2 = hashLine("function world() {", 1);
    expect(h1).not.toBe(h2);
  });

  it("seeds symbol-only lines with line number (different lines get different hashes)", () => {
    const h1 = hashLine("}", 1);
    const h2 = hashLine("}", 2);
    expect(h1).not.toBe(h2);
  });

  it("same content on different lines still hashes the same if it has alphanumeric chars", () => {
    const h1 = hashLine("  return 42;", 1);
    const h2 = hashLine("  return 42;", 2);
    expect(h1).toBe(h2);
  });

  it("ignores trailing whitespace for hashing", () => {
    const h1 = hashLine("  return 42;", 1);
    const h2 = hashLine("  return 42;  ", 1);
    expect(h1).toBe(h2);
  });

  it("handles empty lines", () => {
    const h = hashLine("", 1);
    expect(h).toHaveLength(2);
  });
});

describe("parseAnchor", () => {
  it("parses a valid anchor", () => {
    expect(parseAnchor("11#KT")).toEqual({ line: 11, hash: "KT" });
  });

  it("parses single-char hash", () => {
    expect(parseAnchor("5#Z")).toEqual({ line: 5, hash: "Z" });
  });

  it("returns null for invalid formats", () => {
    expect(parseAnchor("")).toBeNull();
    expect(parseAnchor("11")).toBeNull();
    expect(parseAnchor("#KT")).toBeNull();
    expect(parseAnchor("11##KT")).toBeNull();
    expect(parseAnchor("abc#KT")).toBeNull();
    expect(parseAnchor("11#kt")).toBeNull(); // lowercase
    expect(parseAnchor("11#123")).toBeNull(); // digits
  });
});

describe("validateAnchor", () => {
  const content = "function hello() {\n  return 42;\n}\n";

  it("validates a correct anchor", () => {
    const lines = content.split("\n");
    if (lines[lines.length - 1] === "") lines.pop();
    const hash1 = hashLine(lines[0], 1);
    const result = validateAnchor(content, `1#${hash1}`);
    expect(typeof result).toBe("object");
    if (typeof result === "object") {
      expect(result.line).toBe(1);
    }
  });

  it("rejects invalid format", () => {
    const result = validateAnchor(content, "invalid");
    expect(typeof result).toBe("string");
    expect(result).toContain("Invalid hash anchor");
  });

  it("rejects out-of-range line number", () => {
    const result = validateAnchor(content, "999#KT");
    expect(typeof result).toBe("string");
    expect(result).toContain("out of range");
  });

  it("rejects hash mismatch", () => {
    const result = validateAnchor(content, "1#XX");
    expect(typeof result).toBe("string");
    expect(result).toContain("Hash mismatch");
  });
});

describe("stripDisplayPrefix", () => {
  it("extracts anchor from full display line", () => {
    expect(stripDisplayPrefix("11#KT:   return 42;")).toBe("11#KT");
  });

  it("returns plain anchor unchanged", () => {
    expect(stripDisplayPrefix("11#KT")).toBe("11#KT");
  });

  it("returns non-anchor text unchanged", () => {
    expect(stripDisplayPrefix("hello world")).toBe("hello world");
  });
});
