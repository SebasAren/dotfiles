/**
 * Hash-anchored edit engine.
 *
 * Validates all hash anchors against the original file content, then applies
 * edits bottom-up so that earlier edits don't shift later line numbers.
 *
 * Duplication patterns (model echoing anchor content into `lines`) are
 * auto-corrected — the duplicated line is silently stripped rather than
 * rejecting the edit.
 */

import { hashLine, validateAnchor } from "./hash";
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
  /** Fresh LINE#HASH: content entries for lines this edit produced, so the
   * model can chain further edits without re-reading. */
  updatedAnchors: string[];
  /** Notices about auto-corrections applied during editing. */
  notices: string[];
}

interface ParsedEdit {
  op: string;
  startLine: number;
  endLine: number;
  newLines: string[];
}

const UPDATED_ANCHORS_PER_EDIT_CAP = 5;
const UPDATED_ANCHORS_TOTAL_CAP = 20;

/**
 * Strip hashline prefixes that models may accidentally include from read output.
 * Also strips diff format prefixes like "+ 1#KT: " or "-42#AB: ".
 * E.g. "11#KT:   return x;" → "  return x;"
 * E.g. "+ 11#KT:   return x;" → "  return x;"
 */
function stripHashlinePrefix(line: string): string {
  const match = line.match(/^[+-]?\s*\d+#[A-Z]{1,2}: ?/);
  return match ? line.slice(match[0].length) : line;
}

/**
 * Auto-correct duplication patterns where the model has echoed the anchor
 * line's original content into `lines`. Strips the duplicated line(s) in place
 * and returns any notices about what was corrected.
 */
function autoCorrectDuplication(
  op: string,
  newLines: string[],
  originalLines: string[],
  startLine: number,
  endLine: number,
): string[] {
  if (newLines.length === 0) return [];

  const notices: string[] = [];
  const posContent = originalLines[startLine - 1];

  // insert_after: strip echoed anchor from start
  if (op === "insert_after" && newLines[0] === posContent) {
    newLines.shift();
    notices.push("Auto-corrected: removed anchor content echoed at start of insert_after lines.");
  }

  // insert_before: strip echoed anchor from end
  if (op === "insert_before" && newLines[newLines.length - 1] === posContent) {
    newLines.pop();
    notices.push("Auto-corrected: removed anchor content echoed at end of insert_before lines.");
  }

  // replace with range
  if (op === "replace" && endLine > startLine) {
    const endContent = originalLines[endLine - 1];
    const rangeCount = endLine - startLine + 1;
    const first = newLines[0];
    const last = newLines[newLines.length - 1];

    // Both endpoints echoed
    if (first === posContent && last === endContent) {
      newLines.shift();
      newLines.pop();
      notices.push(
        "Auto-corrected: removed original first/last lines echoed in range replace.",
      );
    }
    // Asymmetric echo when replacement grows the range
    else if (newLines.length > rangeCount) {
      if (last === endContent) {
        newLines.pop();
        notices.push(
          "Auto-corrected: removed echoed end line from growing range replace.",
        );
      } else if (first === posContent) {
        newLines.shift();
        notices.push(
          "Auto-corrected: removed echoed start line from growing range replace.",
        );
      }
    }
  }

  return notices;
}

/**
 * Compute the half-integer position range this edit claims. Lines map to even
 * positions (line N → 2N), gaps between lines map to odd positions (gap after
 * line N → 2N+1). A `replace [a, b]` claims [2a, 2b]; `insert_after a` claims
 * a single gap position 2a+1; `insert_before a` claims 2a-1.
 */
function editClaim(edit: ParsedEdit): { start: number; end: number } {
  if (edit.op === "replace") return { start: 2 * edit.startLine, end: 2 * edit.endLine };
  if (edit.op === "insert_after") {
    const p = 2 * edit.startLine + 1;
    return { start: p, end: p };
  }
  // insert_before
  const p = 2 * edit.startLine - 1;
  return { start: p, end: p };
}

function describeEdit(edit: ParsedEdit): string {
  if (edit.op === "replace") {
    return edit.startLine === edit.endLine
      ? `replace line ${edit.startLine}`
      : `replace lines ${edit.startLine}..${edit.endLine}`;
  }
  return `${edit.op} line ${edit.startLine}`;
}

/**
 * Apply hash-anchored edits to file content.
 *
 * All anchors are validated against the original content before any
 * modifications are made. Edits are applied bottom-up so line indices
 * stay stable.
 *
 * Duplication patterns (model echoing anchor content) are auto-corrected
 * rather than rejected — the duplicated line is stripped and a notice is
 * returned.
 */
export function applyHashlineEdits(content: string, edits: HashEdit[]): EditResult {
  // ── Phase 1: Validate all anchors against original content ──
  const originalLines = content.split("\n");
  if (originalLines.length > 0 && originalLines[originalLines.length - 1] === "")
    originalLines.pop();

  const parsedEdits: ParsedEdit[] = [];
  const notices: string[] = [];

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
    const dupNotices = autoCorrectDuplication(
      op,
      newLines,
      originalLines,
      startLine,
      endLine,
    );
    notices.push(...dupNotices);

    parsedEdits.push({ op, startLine, endLine, newLines });
  }

  // ── Phase 1.5: Detect overlapping/adjacent edits ──
  for (let i = 0; i < parsedEdits.length; i++) {
    for (let j = i + 1; j < parsedEdits.length; j++) {
      const a = editClaim(parsedEdits[i]);
      const b = editClaim(parsedEdits[j]);
      if (a.start <= b.end && b.start <= a.end) {
        throw new Error(
          `Overlapping edits: "${describeEdit(parsedEdits[i])}" and ` +
            `"${describeEdit(parsedEdits[j])}" target the same lines or gap. ` +
            `Combine them into a single edit, or choose non-overlapping anchors.`,
        );
      }
    }
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
  const updatedAnchors = computeUpdatedAnchors(parsedEdits, lines);

  return {
    content: newContent,
    diff,
    firstChangedLine,
    stats: { applied: edits.length, total: edits.length },
    updatedAnchors,
    notices,
  };
}

/**
 * Compute fresh LINE#HASH: content entries for the lines each edit produced in
 * the final file. Walks edits in ascending original-startLine order while
 * accumulating cumulative line delta, which gives each edit's final position.
 */
function computeUpdatedAnchors(parsedEdits: ParsedEdit[], finalLines: string[]): string[] {
  const sorted = parsedEdits
    .map((e, i) => ({ ...e, origIdx: i }))
    .sort((a, b) => a.startLine - b.startLine || a.origIdx - b.origIdx);

  const out: string[] = [];
  let delta = 0;

  for (const edit of sorted) {
    const removedCount = edit.op === "replace" ? edit.endLine - edit.startLine + 1 : 0;
    const addedCount = edit.newLines.length;

    let newStartLine: number;
    if (edit.op === "insert_after") {
      newStartLine = edit.startLine + delta + 1;
    } else {
      // replace or insert_before: first inserted line lands at the anchor's shifted position
      newStartLine = edit.startLine + delta;
    }

    if (addedCount > 0) {
      const shown = Math.min(addedCount, UPDATED_ANCHORS_PER_EDIT_CAP);
      for (let i = 0; i < shown && out.length < UPDATED_ANCHORS_TOTAL_CAP; i++) {
        const lineNum = newStartLine + i;
        const lineContent = finalLines[lineNum - 1] ?? "";
        out.push(`${lineNum}#${hashLine(lineContent, lineNum)}: ${lineContent}`);
      }
      if (addedCount > shown && out.length < UPDATED_ANCHORS_TOTAL_CAP) {
        out.push(
          `  (${addedCount - shown} more line(s) from this edit — re-read for full anchors)`,
        );
      }
    }

    delta += addedCount - removedCount;

    if (out.length >= UPDATED_ANCHORS_TOTAL_CAP) break;
  }

  return out;
}
