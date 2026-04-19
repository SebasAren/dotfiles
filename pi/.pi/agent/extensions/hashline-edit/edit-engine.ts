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
 * E.g. "11#KT:   return x;" → "  return x;"
 */
function stripHashlinePrefix(line: string): string {
  const match = line.match(/^\d+#[A-Z]{1,2}: ?/);
  return match ? line.slice(match[0].length) : line;
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

    parsedEdits.push({ op, startLine, endLine, newLines: edit.lines.map(stripHashlinePrefix) });
  }

  // ── Phase 2: Sort bottom-up (stable sort preserves order for same position) ──
  const sorted = parsedEdits.map((e, i) => ({ ...e, origIdx: i }));
  sorted.sort((a, b) => b.startLine - a.startLine || a.origIdx - b.origIdx);

  // ── Phase 3: Apply edits ──
  const lines = content.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

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

  const newContent = lines.join("\n");

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
