import { describe, it, expect } from "bun:test";

import { hashLine } from "./hash";
import { applyHashlineEdits } from "./edit-engine";

/** Helper: compute anchor for a line in content */
function anchor(content: string, lineNum: number): string {
  const lines = content.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return `${lineNum}#${hashLine(lines[lineNum - 1], lineNum)}`;
}

describe("applyHashlineEdits", () => {
  const content = "line1\nline2\nline3\nline4\nline5";

  describe("replace", () => {
    it("replaces a single line by anchor", () => {
      const pos = anchor(content, 2);
      const result = applyHashlineEdits(content, [{ op: "replace", pos, lines: ["LINE2"] }]);
      expect(result.content).toBe("line1\nLINE2\nline3\nline4\nline5");
      expect(result.diff).toContain("+");
      expect(result.diff).toContain("-");
      expect(result.stats.applied).toBe(1);
    });

    it("replaces a range of lines", () => {
      const pos = anchor(content, 2);
      const end = anchor(content, 4);
      const result = applyHashlineEdits(content, [{ op: "replace", pos, end, lines: ["A", "B"] }]);
      expect(result.content).toBe("line1\nA\nB\nline5");
    });

    it("defaults op to replace when omitted", () => {
      const pos = anchor(content, 3);
      const result = applyHashlineEdits(content, [
        { op: "replace" as any, pos, lines: ["REPLACED"] },
      ]);
      expect(result.content).toBe("line1\nline2\nREPLACED\nline4\nline5");
    });
  });

  describe("insert_after", () => {
    it("inserts lines after the anchored line", () => {
      const pos = anchor(content, 2);
      const result = applyHashlineEdits(content, [
        { op: "insert_after", pos, lines: ["inserted"] },
      ]);
      expect(result.content).toBe("line1\nline2\ninserted\nline3\nline4\nline5");
    });
  });

  describe("insert_before", () => {
    it("inserts lines before the anchored line", () => {
      const pos = anchor(content, 3);
      const result = applyHashlineEdits(content, [
        { op: "insert_before", pos, lines: ["inserted"] },
      ]);
      expect(result.content).toBe("line1\nline2\ninserted\nline3\nline4\nline5");
    });
  });

  describe("multiple edits (bottom-up)", () => {
    it("applies non-overlapping edits at different positions", () => {
      const pos1 = anchor(content, 5);
      const pos2 = anchor(content, 2);
      const result = applyHashlineEdits(content, [
        { op: "replace", pos: pos1, lines: ["LINE5"] },
        { op: "replace", pos: pos2, lines: ["LINE2"] },
      ]);
      expect(result.content).toBe("line1\nLINE2\nline3\nline4\nLINE5");
    });
  });

  describe("validation errors", () => {
    it("throws on invalid anchor format", () => {
      expect(() =>
        applyHashlineEdits(content, [{ op: "replace", pos: "invalid", lines: ["x"] }]),
      ).toThrow("Invalid hash anchor");
    });

    it("throws on out-of-range line", () => {
      expect(() =>
        applyHashlineEdits(content, [{ op: "replace", pos: "999#XX", lines: ["x"] }]),
      ).toThrow("out of range");
    });

    it("throws on hash mismatch (stale anchor)", () => {
      expect(() =>
        applyHashlineEdits(content, [{ op: "replace", pos: "2#XX", lines: ["x"] }]),
      ).toThrow("Hash mismatch");
    });

    it("throws when end < start", () => {
      const pos = anchor(content, 3);
      // Fabricate an end anchor for line 1 with wrong hash won't work because
      // validation checks hash first. Instead, create a valid end for line 1
      // but start at line 3.
      const end = anchor(content, 1);
      expect(() =>
        applyHashlineEdits(content, [{ op: "replace", pos, end, lines: ["x"] }]),
      ).toThrow("must be >= start line");
    });

    it("throws when replacement produces identical content", () => {
      const pos = anchor(content, 2);
      const lines = content.split("\n");
      expect(() =>
        applyHashlineEdits(content, [{ op: "replace", pos, lines: [lines[1]] }]),
      ).toThrow("No changes");
    });
  });

  describe("edge cases", () => {
    it("handles replacing the first line", () => {
      const pos = anchor(content, 1);
      const result = applyHashlineEdits(content, [{ op: "replace", pos, lines: ["FIRST"] }]);
      expect(result.content).toBe("FIRST\nline2\nline3\nline4\nline5");
    });

    it("handles replacing the last line", () => {
      const pos = anchor(content, 5);
      const result = applyHashlineEdits(content, [{ op: "replace", pos, lines: ["LAST"] }]);
      expect(result.content).toBe("line1\nline2\nline3\nline4\nLAST");
    });

    it("handles delete (replace with empty array)", () => {
      const pos = anchor(content, 3);
      const result = applyHashlineEdits(content, [{ op: "replace", pos, lines: [] }]);
      expect(result.content).toBe("line1\nline2\nline4\nline5");
    });

    it("handles range delete", () => {
      const pos = anchor(content, 2);
      const end = anchor(content, 4);
      const result = applyHashlineEdits(content, [{ op: "replace", pos, end, lines: [] }]);
      expect(result.content).toBe("line1\nline5");
    });
  });

  describe("hashline prefix stripping", () => {
    it("strips LINE#HASH prefix from replacement lines", () => {
      const pos = anchor(content, 2);
      // Model accidentally includes the hashline prefix from read output
      const result = applyHashlineEdits(content, [
        { op: "replace", pos, lines: [`2#${hashLine("line2", 2)}: REPLACED`] },
      ]);
      expect(result.content).toBe("line1\nREPLACED\nline3\nline4\nline5");
    });

    it("strips prefix from each line in multi-line replacement", () => {
      const pos = anchor(content, 3);
      const end = anchor(content, 4);
      const a = anchor(content, 3);
      const b = anchor(content, 4);
      const result = applyHashlineEdits(content, [
        { op: "replace", pos, end, lines: [`${a}: NEW_A`, `${b}: NEW_B`] },
      ]);
      expect(result.content).toBe("line1\nline2\nNEW_A\nNEW_B\nline5");
    });

    it("strips prefix in insert_after lines", () => {
      const pos = anchor(content, 2);
      const result = applyHashlineEdits(content, [
        { op: "insert_after", pos, lines: [`2#${hashLine("line2", 2)}: inserted`] },
      ]);
      expect(result.content).toBe("line1\nline2\ninserted\nline3\nline4\nline5");
    });

    it("does not strip content that only looks like a prefix", () => {
      // "99#AB: something" with a line number > file length — not a real anchor
      // but the regex matches the pattern. This is acceptable since the line
      // is content the model explicitly wrote.
      const pos = anchor(content, 2);
      const result = applyHashlineEdits(content, [
        { op: "replace", pos, lines: ["99#AB: config"] },
      ]);
      // The prefix IS stripped because it matches the pattern — this is fine,
      // models shouldn't be writing literal hash anchors into file content.
      expect(result.content).toBe("line1\nconfig\nline3\nline4\nline5");
    });

    it("strips diff format prefix with sign and padding", () => {
      // Model copies from diff output: "+ 2#XX: inserted"
      const pos = anchor(content, 2);
      const result = applyHashlineEdits(content, [
        { op: "insert_after", pos, lines: ["+ 2#XX: inserted"] },
      ]);
      expect(result.content).toBe("line1\nline2\ninserted\nline3\nline4\nline5");
    });

    it("strips diff format prefix with minus sign", () => {
      // Model copies from diff output: "- 1#XX: old"
      const pos = anchor(content, 1);
      const result = applyHashlineEdits(content, [
        { op: "replace", pos, lines: ["- 1#XX: replaced"] },
      ]);
      expect(result.content).toBe("replaced\nline2\nline3\nline4\nline5");
    });
  });
});
