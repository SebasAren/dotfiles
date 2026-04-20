/**
 * Schema definitions for the hashline read and edit tools.
 */

import { Type } from "@sinclair/typebox";

import { stripDisplayPrefix } from "./hash";

// ── Read tool schema ────────────────────────────────────────────────────────

export const readSchema = Type.Object(
  {
    path: Type.String({ description: "Path to the file to read (relative or absolute)" }),
    offset: Type.Optional(
      Type.Number({ description: "Line number to start reading from (1-indexed)" }),
    ),
    limit: Type.Optional(Type.Number({ description: "Maximum number of lines to read" })),
  },
  { additionalProperties: false },
);

// ── Edit tool schema ────────────────────────────────────────────────────────

const hashEditSchema = Type.Object(
  {
    op: Type.Optional(
      Type.Union([
        Type.Literal("replace"),
        Type.Literal("insert_after"),
        Type.Literal("insert_before"),
      ]),
    ),
    pos: Type.String({
      description:
        'Hash anchor in format LINE#HASH (e.g. "11#KT"). Reference the tag from the read output.',
    }),
    end: Type.Optional(
      Type.String({
        description: "End anchor for range replace (inclusive). Must be at or after pos.",
      }),
    ),
    lines: Type.Array(Type.String(), {
      description:
        "New content ONLY — not a diff. For `replace`, these lines overwrite the anchored range (do not copy the original line's text here). For `insert_after`/`insert_before`, these are the lines to insert without repeating the anchor line.",
    }),
  },
  { additionalProperties: false },
);

export const editSchema = Type.Object(
  {
    path: Type.String({ description: "Path to the file to edit (relative or absolute)" }),
    edits: Type.Array(hashEditSchema, {
      description:
        "Hash-anchored edits. Each edit targets lines by their LINE#HASH anchors from the read output. Edits are applied bottom-up and must not overlap.",
    }),
  },
  { additionalProperties: false },
);

// ── Argument normalization ──────────────────────────────────────────────────

/** Normalize edit tool arguments before schema validation. */
export function prepareArguments(args: unknown): {
  path: string;
  edits: Array<{
    op?: "replace" | "insert_after" | "insert_before";
    pos: string;
    end?: string;
    lines: string[];
  }>;
} {
  if (!args || typeof args !== "object") return args as any;
  const input = args as Record<string, unknown>;

  // Parse JSON-stringified edits
  let rawEdits: unknown = input.edits;
  if (typeof rawEdits === "string") {
    try {
      rawEdits = JSON.parse(rawEdits);
    } catch {
      // Let schema validation produce the error
    }
  }

  // Normalize to array of edits with display-prefix stripping
  const normalizeEdit = (e: unknown): Record<string, unknown> => {
    if (!e || typeof e !== "object") return {} as Record<string, unknown>;
    const rec = { ...((e as Record<string, unknown>) ?? {}) };
    if (rec.pos) rec.pos = stripDisplayPrefix(String(rec.pos));
    if (rec.end) rec.end = stripDisplayPrefix(String(rec.end));
    return rec;
  };

  let edits: Array<Record<string, unknown>>;

  if (Array.isArray(rawEdits)) {
    edits = rawEdits.map(normalizeEdit);
  } else if (input.pos !== undefined) {
    // Single edit at root level — wrap in array
    edits = [normalizeEdit({ pos: input.pos, end: input.end, lines: input.lines, op: input.op })];
  } else if (typeof rawEdits === "object" && rawEdits !== null && !Array.isArray(rawEdits)) {
    // edits is a single object — wrap in array
    edits = [normalizeEdit(rawEdits)];
  } else {
    edits = [];
  }

  // Build clean output (only path + edits, no leftover fields)
  const { edits: _e, pos: _p, end: _en, lines: _l, op: _op, ...rest } = input;
  return { ...rest, edits } as { path: string; edits: any[] };
}
