import { describe, it, expect } from "bun:test";
import * as Diff from "diff";

describe("diff API contract", () => {
  it("diffLines returns parts with added/removed/value booleans", () => {
    const parts = Diff.diffLines("a\nb", "a\nc");
    expect(parts.length).toBeGreaterThanOrEqual(1);

    for (const part of parts) {
      expect(part).toHaveProperty("value");
      expect(typeof part.value).toBe("string");
      // added and removed are always present (v8+ guarantee)
      expect(part).toHaveProperty("added");
      expect(part).toHaveProperty("removed");
    }

    const removed = parts.find((p) => p.removed);
    const added = parts.find((p) => p.added);
    expect(removed?.value).toContain("b");
    expect(added?.value).toContain("c");
  });

  it("diffLines handles empty strings", () => {
    const parts = Diff.diffLines("", "a");
    expect(parts.length).toBe(1);
    expect(parts[0].added).toBe(true);
    expect(parts[0].value).toBe("a");
  });
});
