/**
 * Hash generation for hash-anchored line references.
 *
 * Each line gets a 2-character content hash from a custom 16-char alphabet.
 * Symbol-only lines (no alphanumeric content) are seeded with their line
 * number to avoid collisions on structural markers like `}`, `)`, `;`.
 */

import { createHash } from "node:crypto";

/** 16-character alphabet chosen for visual distinctness (no confusable chars). */
const ALPHABET = "ZPMQVRWSNKTXJBYH" as const;

export interface ParsedAnchor {
  line: number;
  hash: string;
}

/**
 * Generate a 2-character hash tag for a line of content.
 *
 * @param line     The raw line content
 * @param lineNum  1-based line number (used as seed for symbol-only lines)
 */
export function hashLine(line: string, lineNum: number): string {
  // Normalize: strip CR (handles CRLF files) and trailing whitespace. Keeps
  // the hash stable across line-ending conventions and trailing-space noise.
  const normalized = line.replace(/\r/g, "").replace(/\s+$/, "");
  const hasAlnum = /[a-zA-Z0-9]/.test(normalized);
  // Symbol-only lines (e.g. `}`, `)`) get line-number seeding to avoid collisions
  const key = hasAlnum ? normalized : `${lineNum}:${normalized}`;

  // SHA-256 → first 4 hex chars (16 bits) → map to 2-char alphabet
  const hex = createHash("sha256").update(key, "utf-8").digest("hex").slice(0, 4);
  const n = parseInt(hex, 16);
  return ALPHABET[(n >> 8) & 0xf] + ALPHABET[n & 0xf];
}

/**
 * Parse a hash anchor like "11#KT" into its components.
 * Returns null if the format doesn't match.
 */
export function parseAnchor(anchor: string): ParsedAnchor | null {
  const match = anchor.match(/^(\d+)#([A-Z]{1,2})$/);
  if (!match) return null;
  return { line: parseInt(match[1], 10), hash: match[2] };
}

/**
 * Format a window of fresh LINE#HASH: content anchors around a center line.
 * Used in error messages so the model can retry without a re-read.
 */
export function formatAnchorWindow(
  lines: string[],
  centerLine: number,
  window: number = 2,
): string {
  if (lines.length === 0) return "  (file is empty)";
  const start = Math.max(1, centerLine - window);
  const end = Math.min(lines.length, centerLine + window);
  const out: string[] = [];
  for (let n = start; n <= end; n++) {
    out.push(`  ${n}#${hashLine(lines[n - 1], n)}: ${lines[n - 1]}`);
  }
  return out.join("\n");
}

/**
 * Validate that a hash anchor matches the actual file content at that line.
 *
 * @returns The validated line number on success, or an error message string.
 */
export function validateAnchor(content: string, anchor: string): { line: number } | string {
  const parsed = parseAnchor(anchor);
  if (!parsed) {
    return `Invalid hash anchor format: "${anchor}" (expected LINE#HASH, e.g. "11#KT")`;
  }

  const lines = content.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

  if (parsed.line < 1) return `Line number must be >= 1, got ${parsed.line}`;
  if (parsed.line > lines.length) {
    const tailAnchors = formatAnchorWindow(lines, lines.length, 2);
    return (
      `Line ${parsed.line} out of range (file has ${lines.length} lines).\n\n` +
      `Current anchors near end of file:\n${tailAnchors}\n\n` +
      `Retry with an anchor that exists in the current file.`
    );
  }

  const actualHash = hashLine(lines[parsed.line - 1], parsed.line);
  if (actualHash !== parsed.hash) {
    const windowAnchors = formatAnchorWindow(lines, parsed.line, 2);
    return (
      `Hash mismatch at line ${parsed.line}: expected "${parsed.hash}", got "${actualHash}". ` +
      `File content changed since last read.\n\n` +
      `Current anchors near line ${parsed.line}:\n${windowAnchors}\n\n` +
      `If the content at line ${parsed.line} is still what you intended, retry with the new anchor; ` +
      `otherwise re-read the file.`
    );
  }

  return { line: parsed.line };
}

/**
 * Strip display prefix if the model accidentally includes the full tagged line
 * in the anchor field (e.g. "11#KT:   return 42;" → "11#KT").
 */
export function stripDisplayPrefix(text: string): string {
  const match = text.match(/^(\d+)#[A-Z]{1,2}/);
  return match ? match[0] : text;
}

/**
 * Compute a short snapshot ID (8 hex chars) identifying file content at read
 * time. Used to detect out-of-band file changes between read and edit.
 */
export function computeSnapshotId(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex").slice(0, 8);
}
