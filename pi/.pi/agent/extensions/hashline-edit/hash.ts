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
  const hasAlnum = /[a-zA-Z0-9]/.test(line);
  // Symbol-only lines (e.g. `}`, `)`) get line-number seeding to avoid collisions
  const key = hasAlnum ? line.replace(/\s+$/, "") : `${lineNum}:${line.replace(/\s+$/, "")}`;

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
    return `Line ${parsed.line} out of range (file has ${lines.length} lines). Re-read to get current anchors.`;
  }

  const actualHash = hashLine(lines[parsed.line - 1], parsed.line);
  if (actualHash !== parsed.hash) {
    return (
      `Hash mismatch at line ${parsed.line}: expected "${parsed.hash}", got "${actualHash}". ` +
      `File content changed since last read — re-read to get current anchors.`
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
