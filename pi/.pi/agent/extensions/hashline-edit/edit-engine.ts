/**
 * Hash-anchored edit engine.
 *
 * Validates all hash anchors against the original file content, then applies
 * edits bottom-up so that earlier edits don't shift later line numbers.
 */

import { validateAnchor } from "./hash";
import { generateDiff } from "./diff";

export interface HashEdit {
  op: "replace" | "insert_after" | "insert_before";
  pos: string; // "LINE#HASH"
  end?: string; // "LINE#HASH" for range replace
  lines: string[];
}

export interface EditResult {
  content: string;
  diff: string;
  firstChangedLine?: number;
  stats: { applied: number; total: number };
}

interface ParsedEdit {
  op: string;
  startLine: number;
  endLine: number;
  newLines: string[];
}

/**
 * Strip hashline prefixes that models may accidentally include from read output.
 * Also strips diff format prefixes like "+ 1#KT: " or "-42#AB: ".
 * E.g. "11#KT:   return x;" → "  return x;"
 * E.g. "+ 11#KT:   return x;" → "  return x;"
 * E.g. "11#KT:   return x;" → "  return x;"
 */
function stripHashlinePrefix(line: string): string {
  const match = line.match(/^[+-]?\s*\d+#[A-Z]{1,2}: ?/);
  return match ? line.slice(match[0].length) : line;
}

/**
 * Detect likely-duplication patterns where the model has echoed the anchor
 * line's original content into `lines`, which would produce a duplicated line.
 *
 * Rejects with a clear message pointing the model at the right operation
 * rather than silently writing the duplicate.
 */
function detectDuplication(
  op: string,
  pos: string,
  end: string | undefined,
  newLines: string[],
  originalLines: string[],
  startLine: number,
  endLine: number,
): void {
  if (newLines.length === 0) return;

  const posContent = originalLines[startLine - 1];
  const first = newLines[0];
  const last = newLines[newLines.length - 1];

  if (op === "insert_after" && first === posContent) {
    throw new Error(
      `Likely duplication: insert_after ${pos} starts with the anchor line's existing content. ` +
        `insert_after adds lines AFTER the anchor without repeating it — remove the first line of ` +
        `"lines", or switch to "replace" if you meant to overwrite the anchor.`,
    );
  }

  if (op === "insert_before" && last === posContent) {
    throw new Error(
      `Likely duplication: insert_before ${pos} ends with the anchor line's existing content. ` +
        `insert_before adds lines BEFORE the anchor without repeating it — remove the last line of ` +
        `"lines", or switch to "replace" if you meant to overwrite the anchor.`,
    );
  }

  if (op === "replace" && end && endLine > startLine) {
    const endContent = originalLines[endLine - 1];
    if (first === posContent && last === endContent) {
      throw new Error(
        `Likely duplication: replace ${pos}..${end} both starts and ends with the original anchor ` +
          `lines. "replace" overwrites the entire range — do not include the original first/last ` +
          `lines in "lines". If you only want to change content between the endpoints, anchor on ` +
          `the lines you actually want to change.`,
      );
    }
  }
}

/**
 * Apply hash-anchored edits to file content.
 *
 * All anchors are validated against the original content before any
 * modifications are made. Edits are applied bottom-up so line indices
 * stay stable.
 */
export function applyHashlineEdits(content: string, edits: HashEdit[]): EditResult {
  // ── Phase 1: Validate all anchors against original content ──
  const originalLines = content.split("\n");
  if (originalLines.length > 0 && originalLines[originalLines.length - 1] === "")
    originalLines.pop();

  const parsedEdits: ParsedEdit[] = [];

  for (const edit of edits) {
    const op = edit.op || "replace";

    const posResult = validateAnchor(content, edit.pos);
    if (typeof posResult === "string") throw new Error(posResult);

    const startLine = posResult.line;
    let endLine = startLine;

    if (op === "replace" && edit.end) {
      const endResult = validateAnchor(content, edit.end);
      if (typeof endResult === "string") throw new Error(endResult);
      endLine = endResult.line;
      if (endLine < startLine) {
        throw new Error(`End line (${endLine}) must be >= start line (${startLine})`);
      }
    }

    const newLines = edit.lines.map(stripHashlinePrefix);
    detectDuplication(op, edit.pos, edit.end, newLines, originalLines, startLine, endLine);

    parsedEdits.push({ op, startLine, endLine, newLines });
  }

  // ── Phase 2: Sort bottom-up (stable sort preserves order for same position) ──
  const sorted = parsedEdits.map((e, i) => ({ ...e, origIdx: i }));
  sorted.sort((a, b) => b.startLine - a.startLine || a.origIdx - b.origIdx);

  // ── Phase 3: Apply edits ──
  const lines = [...originalLines];
  const hadTrailingNewline = content.endsWith("\n");

  for (const edit of sorted) {
    if (edit.op === "replace") {
      const startIdx = edit.startLine - 1;
      const count = edit.endLine - edit.startLine + 1;
      lines.splice(startIdx, count, ...edit.newLines);
    } else if (edit.op === "insert_after") {
      lines.splice(edit.startLine, 0, ...edit.newLines);
    } else if (edit.op === "insert_before") {
      lines.splice(edit.startLine - 1, 0, ...edit.newLines);
    }
  }

  const joined = lines.join("\n");
  const newContent = hadTrailingNewline && joined.length > 0 ? joined + "\n" : joined;

  if (content === newContent) {
    throw new Error("No changes made. The replacement produced identical content.");
  }

  const { diff, firstChangedLine } = generateDiff(content, newContent);

  return {
    content: newContent,
    diff,
    firstChangedLine,
    stats: { applied: edits.length, total: edits.length },
  };
}
