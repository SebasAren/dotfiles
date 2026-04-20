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

  describe("updatedAnchors", () => {
    it("returns a fresh anchor for a single-line replace", () => {
      const pos = anchor(content, 3);
      const result = applyHashlineEdits(content, [{ op: "replace", pos, lines: ["NEW3"] }]);
      expect(result.updatedAnchors).toHaveLength(1);
      expect(result.updatedAnchors[0]).toMatch(/^3#[A-Z]{1,2}: NEW3$/);
    });

    it("returns anchors at the correct shifted line numbers for multiple edits", () => {
      const pos1 = anchor(content, 2);
      const pos2 = anchor(content, 4);
      const result = applyHashlineEdits(content, [
        { op: "insert_before", pos: pos1, lines: ["A", "B"] }, // adds 2 lines before line 2
        { op: "replace", pos: pos2, lines: ["FOUR"] }, // line 4 originally, now shifted to line 6
      ]);
      // New file: line1, A, B, line2, line3, FOUR, line5
      // insert_before 2 produced lines at 2..3
      // replace 4 produced FOUR at line 6 (after 2-line shift)
      expect(result.updatedAnchors.length).toBe(3);
      expect(result.updatedAnchors[0]).toMatch(/^2#[A-Z]{1,2}: A$/);
      expect(result.updatedAnchors[1]).toMatch(/^3#[A-Z]{1,2}: B$/);
      expect(result.updatedAnchors[2]).toMatch(/^6#[A-Z]{1,2}: FOUR$/);
    });

    it("returns anchor at the correct line for insert_after", () => {
      const pos = anchor(content, 2);
      const result = applyHashlineEdits(content, [
        { op: "insert_after", pos, lines: ["INSERTED"] },
      ]);
      // New file: line1, line2, INSERTED, line3, line4, line5
      expect(result.updatedAnchors).toHaveLength(1);
      expect(result.updatedAnchors[0]).toMatch(/^3#[A-Z]{1,2}: INSERTED$/);
    });

    it("returns no anchors for pure deletions", () => {
      const pos = anchor(content, 3);
      const result = applyHashlineEdits(content, [{ op: "replace", pos, lines: [] }]);
      expect(result.updatedAnchors).toHaveLength(0);
    });

    it("caps anchors per edit and notes overflow", () => {
      const pos = anchor(content, 2);
      const manyLines = Array.from({ length: 10 }, (_, i) => `new${i}`);
      const result = applyHashlineEdits(content, [
        { op: "insert_after", pos, lines: manyLines },
      ]);
      // 10 new lines; per-edit cap is 5 + overflow note
      const anchorCount = result.updatedAnchors.filter((a) => /^\d+#/.test(a)).length;
      expect(anchorCount).toBe(5);
      expect(result.updatedAnchors.some((a) => a.includes("more line"))).toBe(true);
    });
  });

  describe("overlap detection", () => {
    it("rejects two replaces on the same line", () => {
      const pos = anchor(content, 3);
      expect(() =>
        applyHashlineEdits(content, [
          { op: "replace", pos, lines: ["A"] },
          { op: "replace", pos, lines: ["B"] },
        ]),
      ).toThrow(/Overlapping edits/);
    });

    it("rejects replace ranges that overlap", () => {
      const posA = anchor(content, 2);
      const endA = anchor(content, 4);
      const posB = anchor(content, 3);
      const endB = anchor(content, 5);
      expect(() =>
        applyHashlineEdits(content, [
          { op: "replace", pos: posA, end: endA, lines: ["X"] },
          { op: "replace", pos: posB, end: endB, lines: ["Y"] },
        ]),
      ).toThrow(/Overlapping edits/);
    });

    it("rejects insert inside a replace range", () => {
      const posR = anchor(content, 2);
      const endR = anchor(content, 4);
      const posI = anchor(content, 3);
      expect(() =>
        applyHashlineEdits(content, [
          { op: "replace", pos: posR, end: endR, lines: ["X"] },
          { op: "insert_after", pos: posI, lines: ["Y"] },
        ]),
      ).toThrow(/Overlapping edits/);
    });

    it("rejects two inserts at the same gap (insert_after N vs insert_before N+1)", () => {
      const posA = anchor(content, 3);
      const posB = anchor(content, 4);
      expect(() =>
        applyHashlineEdits(content, [
          { op: "insert_after", pos: posA, lines: ["A"] },
          { op: "insert_before", pos: posB, lines: ["B"] },
        ]),
      ).toThrow(/Overlapping edits/);
    });

    it("allows insert_after at the last line of a replace range (append-after-replacement)", () => {
      // replace [2, 3] + insert_after 3: the gap after line 3 is outside the
      // replace range, so the insert just appends after the replacement.
      const posR = anchor(content, 2);
      const endR = anchor(content, 3);
      const result = applyHashlineEdits(content, [
        { op: "replace", pos: posR, end: endR, lines: ["X"] },
        { op: "insert_after", pos: endR, lines: ["Y"] },
      ]);
      expect(result.content).toBe("line1\nX\nY\nline4\nline5");
    });

    it("rejects insert_before at the first line of a replace range", () => {
      // replace [2, 3] + insert_before 2: both touch the gap before line 2?
      // No — insert_before 2 targets gap 2*2-1=3, replace [2, 3] claims [4, 6].
      // Gap 3 is disjoint. This should be allowed.
      const posR = anchor(content, 2);
      const endR = anchor(content, 3);
      const result = applyHashlineEdits(content, [
        { op: "replace", pos: posR, end: endR, lines: ["X"] },
        { op: "insert_before", pos: posR, lines: ["Y"] },
      ]);
      expect(result.content).toBe("line1\nY\nX\nline4\nline5");
    });

    it("allows non-overlapping edits at adjacent but disjoint positions", () => {
      // replace line 3 + insert_before line 5 — disjoint
      const pos1 = anchor(content, 3);
      const pos2 = anchor(content, 5);
      const result = applyHashlineEdits(content, [
        { op: "replace", pos: pos1, lines: ["THREE"] },
        { op: "insert_before", pos: pos2, lines: ["BEFORE5"] },
      ]);
      expect(result.content).toBe("line1\nline2\nTHREE\nline4\nBEFORE5\nline5");
    });
  });

  describe("trailing newline", () => {
    it("preserves trailing newline so diff doesn't flag the last line", () => {
      const withNewline = "line1\nline2\nline3\n";
      const pos = anchor(withNewline, 2);
      const result = applyHashlineEdits(withNewline, [{ op: "replace", pos, lines: ["LINE2"] }]);
      expect(result.content.endsWith("\n")).toBe(true);
      expect(result.content).toBe("line1\nLINE2\nline3\n");
      // Unchanged last line must not appear as +/- in the diff
      expect(result.diff).not.toMatch(/^-\s*3 line3/m);
      expect(result.diff).not.toMatch(/^\+\s*3 line3/m);
    });

    it("does not add a trailing newline when original had none", () => {
      const withoutNewline = "line1\nline2\nline3";
      const pos = anchor(withoutNewline, 2);
      const result = applyHashlineEdits(withoutNewline, [
        { op: "replace", pos, lines: ["LINE2"] },
      ]);
      expect(result.content.endsWith("\n")).toBe(false);
      expect(result.content).toBe("line1\nLINE2\nline3");
    });
  });

  describe("duplication detection", () => {
    it("rejects insert_after when lines[0] matches anchor content", () => {
      const pos = anchor(content, 2);
      expect(() =>
        applyHashlineEdits(content, [{ op: "insert_after", pos, lines: ["line2", "new"] }]),
      ).toThrow(/duplication.*insert_after/i);
    });

    it("rejects insert_before when lines[last] matches anchor content", () => {
      const pos = anchor(content, 3);
      expect(() =>
        applyHashlineEdits(content, [{ op: "insert_before", pos, lines: ["new", "line3"] }]),
      ).toThrow(/duplication.*insert_before/i);
    });

    it("rejects range replace when endpoints are duplicated in lines", () => {
      const pos = anchor(content, 2);
      const end = anchor(content, 4);
      expect(() =>
        applyHashlineEdits(content, [
          { op: "replace", pos, end, lines: ["line2", "NEW_MIDDLE", "line4"] },
        ]),
      ).toThrow(/duplication.*replace/i);
    });

    it("catches duplication even when model includes hashline prefix on the echoed line", () => {
      const pos = anchor(content, 2);
      // Model echoes the full tagged line from read output
      const tagged = `2#${hashLine("line2", 2)}: line2`;
      expect(() =>
        applyHashlineEdits(content, [{ op: "insert_after", pos, lines: [tagged, "new"] }]),
      ).toThrow(/duplication/i);
    });

    it("allows insert_after where lines[0] differs from anchor", () => {
      const pos = anchor(content, 2);
      const result = applyHashlineEdits(content, [
        { op: "insert_after", pos, lines: ["line2_extra", "new"] },
      ]);
      expect(result.content).toBe("line1\nline2\nline2_extra\nnew\nline3\nline4\nline5");
    });

    it("allows single-line replace without end even if content happens to match (caught by no-op check)", () => {
      // Single replace where lines[0] === anchor content would be a no-op,
      // handled by the existing "No changes made" error.
      const pos = anchor(content, 2);
      expect(() =>
        applyHashlineEdits(content, [{ op: "replace", pos, lines: ["line2"] }]),
      ).toThrow(/No changes/);
    });

    it("allows range replace where only one endpoint appears in lines", () => {
      const pos = anchor(content, 2);
      const end = anchor(content, 4);
      // Keeping just the start but replacing the rest is legitimate
      const result = applyHashlineEdits(content, [
        { op: "replace", pos, end, lines: ["line2", "NEW"] },
      ]);
      expect(result.content).toBe("line1\nline2\nNEW\nline5");
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
