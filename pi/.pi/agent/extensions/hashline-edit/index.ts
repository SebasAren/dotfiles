/**
 * Hashline Edit Extension — hash-anchored read and edit tools
 *
 * Overrides the built-in read and edit tools. The read tool tags every line
 * with a LINE#HASH anchor. The edit tool references those anchors instead of
 * reproducing old text, eliminating whitespace mismatches and stale-line
 * corruption.
 *
 * Inspired by Can Bölük's "The Harness Problem" and the pi-hashline-edit
 * extension by RimuruW.
 */

import type { ExtensionAPI, EditToolDetails } from "@mariozechner/pi-coding-agent";
import {
  getLanguageFromPath,
  highlightCode,
  keyHint,
  renderDiff,
  withFileMutationQueue,
} from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { readFile, writeFile, access, constants } from "node:fs/promises";
import { resolve } from "node:path";

import { computeSnapshotId, hashLine } from "./hash";
import { editSchema, readSchema, prepareArguments } from "./schema";
import { applyHashlineEdits } from "./edit-engine";
import type { HashEdit } from "./edit-engine";

// ── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_MAX_LINES = 2000;
const DEFAULT_MAX_BYTES = 50_000;
const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i;

// ── Extension registration ──────────────────────────────────────────────────

export default function hashlineEditExtension(pi: ExtensionAPI) {
  const cwd = process.cwd();

  // ── Register hashline read tool ─────────────────────────────────────────

  pi.registerTool({
    name: "read",
    label: "read",
    description: [
      "Read the contents of a file. Supports text files and images (jpg, png, gif, webp).",
      "For text files, each line is tagged with a LINE#HASH anchor (e.g. `11#KT: content`).",
      "When editing files, reference lines by their hash anchors instead of reproducing old text.",
      "Output is truncated to 2000 lines or 50KB (whichever is hit first). Use offset/limit for large files.",
    ].join(" "),
    promptSnippet: "Read the contents of a file with hash-anchored line references",
    promptGuidelines: [
      "Every line comes back tagged: `LINE#HASH: content` (e.g. `11#KT:   return 42;`).",
      'When editing, reference lines by anchor: `pos: "11#KT"` — no need to reproduce old text.',
      "The read output ends with `[snapshot: XXXXXXXX]` — pass this `snapshotId` to the edit tool to catch out-of-band file changes.",
      "Use offset/limit for large files. When you need the full file, continue with offset until complete.",
    ],
    parameters: readSchema,
    prepareArguments: (args: unknown) => args as any,

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const filePath = (params.path ?? "").replace(/^@/, "");
      const resolvedCwd = (ctx as unknown as { cwd?: string }).cwd ?? cwd;
      const absolutePath = resolve(resolvedCwd, filePath);

      // Check file access
      try {
        await access(absolutePath, constants.R_OK);
      } catch {
        throw new Error(`File not found: ${filePath}`);
      }

      // Image files — read as raw buffer (pi handles display)
      if (IMAGE_EXTENSIONS.test(filePath)) {
        const buffer = await readFile(absolutePath);
        const base64 = buffer.toString("base64");
        const ext = filePath.split(".").pop()?.toLowerCase() ?? "png";
        const mime = ext === "svg" ? "image/svg+xml" : `image/${ext === "jpg" ? "jpeg" : ext}`;
        return {
          content: [
            {
              type: "image" as const,
              data: base64,
              mimeType: mime,
            },
          ],
          details: undefined,
        };
      }

      // Read text file
      const buffer = await readFile(absolutePath);
      const rawContent = buffer.toString("utf-8");
      const content = rawContent.replace(/^\uFEFF/, ""); // strip BOM

      const lines = content.split("\n");
      if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

      if (lines.length === 0) {
        return {
          content: [{ type: "text" as const, text: "(empty file)" }],
          details: undefined,
        };
      }

      // Pagination
      const offset = params.offset ? Math.max(0, params.offset - 1) : 0;
      const maxLines = params.limit ?? DEFAULT_MAX_LINES;

      const startIdx = Math.min(offset, lines.length);
      const endIdx = Math.min(startIdx + maxLines, lines.length);

      // Generate hash-tagged output with byte budget
      const taggedLines: string[] = [];
      let byteCount = 0;
      let byteTruncated = false;

      for (let i = startIdx; i < endIdx; i++) {
        const lineNum = i + 1;
        const hash = hashLine(lines[i], lineNum);
        const taggedLine = `${lineNum}#${hash}: ${lines[i]}`;
        const lineBytes = Buffer.byteLength(taggedLine + "\n", "utf-8");

        if (byteCount + lineBytes > DEFAULT_MAX_BYTES && taggedLines.length > 0) {
          byteTruncated = true;
          break;
        }

        taggedLines.push(taggedLine);
        byteCount += lineBytes;
      }

      const truncated = endIdx < lines.length || byteTruncated;
      let text = taggedLines.join("\n");

      if (truncated) {
        const shown = startIdx + taggedLines.length;
        const nextOffset = shown + 1;
        text += `\n\n[Output truncated: lines ${startIdx + 1}–${shown} of ${lines.length}. Read more with offset=${nextOffset}.]`;
      }

      text += `\n\n[snapshot: ${computeSnapshotId(content)}]`;

      return {
        content: [{ type: "text" as const, text }],
        details: undefined,
      };
    },
    renderCall(args, theme, context) {
      const text =
        context.lastComponent instanceof Text ? context.lastComponent : new Text("", 0, 0);
      const path = args?.path ?? "";
      let pathDisplay = path ? theme.fg("accent", path) : theme.fg("toolOutput", "...");
      if (args?.offset !== undefined || args?.limit !== undefined) {
        const startLine = args.offset ?? 1;
        const endLine = args.limit !== undefined ? startLine + args.limit - 1 : "";
        pathDisplay += theme.fg("warning", `:${startLine}${endLine ? `-${endLine}` : ""}`);
      }
      text.setText(`${theme.fg("toolTitle", theme.bold("read"))} ${pathDisplay}`);
      return text;
    },

    renderResult(result, state, theme, context) {
      const text =
        context.lastComponent instanceof Text ? context.lastComponent : new Text("", 0, 0);
      const { expanded, isPartial } = state;

      if (isPartial) {
        text.setText(theme.fg("warning", "\nReading..."));
        return text;
      }

      const content = result.content[0];

      if (content?.type === "image") {
        text.setText("");
        return text;
      }

      if (content?.type !== "text") {
        text.setText(theme.fg("error", "\n[No content]"));
        return text;
      }

      // Strip hash anchors (LINE#HASH: ) and the [snapshot: ...] footer for display
      const raw = content.text;
      const cleaned = raw
        .replace(/^\d+#[A-Z]{1,2}: /gm, "")
        .replace(/\n*\[snapshot: [0-9a-f]{8}\]\s*$/, "");

      // Split content from trailing `[Output truncated: ...]` notice
      const allLines = cleaned.split("\n");
      const noticeIdx = allLines.findIndex((l) => l.startsWith("[Output truncated"));
      const fileLines = noticeIdx >= 0 ? allLines.slice(0, noticeIdx) : allLines;
      while (fileLines.length > 0 && fileLines[fileLines.length - 1] === "") {
        fileLines.pop();
      }

      const path = (context.args as { path?: string } | undefined)?.path ?? "";
      const lang = path ? getLanguageFromPath(path) : undefined;
      const bodyText = fileLines.join("\n").replace(/\t/g, "   ");
      const rendered = lang ? highlightCode(bodyText, lang) : bodyText.split("\n");

      const maxLines = expanded ? rendered.length : 10;
      const displayLines = rendered.slice(0, maxLines);
      const remaining = rendered.length - maxLines;

      let output = `\n${displayLines
        .map((line) => (lang ? line : theme.fg("toolOutput", line)))
        .join("\n")}`;

      if (remaining > 0) {
        output += `${theme.fg("muted", `\n... (${remaining} more lines,`)} ${keyHint("app.tools.expand", "to expand")})`;
      }

      if (noticeIdx >= 0) {
        const notice = allLines.slice(noticeIdx).join("\n").trim();
        if (notice) output += `\n${theme.fg("warning", notice)}`;
      }

      text.setText(output);
      return text;
    },
  });

  // ── Register hashline edit tool ─────────────────────────────────────────

  pi.registerTool({
    name: "edit",
    label: "edit",
    description: [
      "Make precise file edits using hash-anchored line references.",
      'Each edit references a LINE#HASH anchor from the read output (e.g. `pos: "11#KT"`).',
      "Operations: replace (default), insert_after, insert_before.",
      "`replace` OVERWRITES the anchored line(s) — `lines` must contain only the new content, never the original line.",
      "`insert_after`/`insert_before` adds `lines` adjacent to the anchor WITHOUT repeating the anchor line.",
      "For range replace, set both `pos` and `end` anchors; `lines` replaces everything from pos through end inclusive.",
      "Multiple edits can be batched in one call — they are applied bottom-up.",
      "If a hash doesn't match the current file, the edit is rejected with a clear error.",
    ].join(" "),
    promptSnippet:
      "Make precise file edits using hash-anchored line references (LINE#HASH from read output)",
    promptGuidelines: [
      "Use edit for precise changes. Reference lines by their LINE#HASH anchors from the read output.",
      "`replace` overwrites — `lines` is the NEW content only. Do NOT copy the anchor line's current text into `lines` (that creates duplicates).",
      "`insert_after`/`insert_before` — `lines` contains ONLY the new lines to insert. Do NOT include the anchor line itself in `lines`.",
      "To add a line next to an existing one, use insert_after/insert_before, not replace with [original, new].",
      "When changing multiple locations in one file, use one edit call with multiple entries in edits[] instead of multiple edit calls.",
      "Each edits[] entry is validated against the original file — do not emit overlapping or nested edits.",
      "Keep edits as small as possible. Use `pos` for single-line changes, `pos` + `end` for ranges only when EVERY line in the range is being overwritten.",
      "If you want to keep the line at `pos` or `end` unchanged, do NOT include it in `lines` — use insert_after/insert_before on that endpoint, or narrow the range by one line.",
      'edits must be a JSON array: `"edits": [{"pos": "11#KT", "lines": ["new code"]}]`.',
      "If a hash mismatch error occurs, the error includes fresh anchors around the failed line — retry with those instead of re-reading when possible.",
      "The edit response returns fresh anchors for the lines you just edited — use them to chain follow-up edits without re-reading the file.",
      "Pass the `snapshotId` from the most recent read's footer to detect out-of-band file changes before applying the edit.",
    ],
    parameters: editSchema,
    prepareArguments,

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const editPath = (params.path ?? "").replace(/^@/, "");
      const resolvedCwd = (ctx as unknown as { cwd?: string }).cwd ?? cwd;
      const absolutePath = resolve(resolvedCwd, editPath);

      const edits = params.edits;
      if (!edits || edits.length === 0) {
        return {
          content: [{ type: "text" as const, text: "Error: edits must contain at least one edit." }],
          details: undefined,
        };
      }

      try {
      return await withFileMutationQueue(absolutePath, async () => {
        // Check file access
        try {
          await access(absolutePath, constants.R_OK | constants.W_OK);
        } catch {
          throw new Error(`File not found: ${editPath}`);
        }

        // Read file
        const buffer = await readFile(absolutePath);
        const rawContent = buffer.toString("utf-8");
        const content = rawContent.replace(/^\uFEFF/, "");

        // Optional snapshot verification — catches out-of-band changes that
        // still happen to leave the edit's anchors valid.
        if (params.snapshotId) {
          const currentSnapshot = computeSnapshotId(content);
          if (currentSnapshot !== params.snapshotId) {
            throw new Error(
              `File has changed since snapshot ${params.snapshotId} (current snapshot: ${currentSnapshot}). ` +
                `Re-read the file to get fresh anchors and a current snapshot ID.`,
            );
          }
        }

        // Apply hashline edits
        const result = applyHashlineEdits(content, edits as HashEdit[]);

        await writeFile(absolutePath, result.content, "utf-8");

        let responseText = `Applied ${result.stats.applied} hashline edit(s) in ${editPath}.`;
        if (result.notices.length > 0) {
          responseText += `\n\n${result.notices.join("\n")}`;
        }
        if (result.updatedAnchors.length > 0) {
          responseText +=
            `\n\nFresh anchors for the edited lines (use these for follow-up edits without re-reading):\n` +
            result.updatedAnchors.join("\n");
        }

        return {
          content: [{ type: "text" as const, text: responseText }],
          details: {
            diff: result.diff,
            firstChangedLine: result.firstChangedLine,
          } satisfies EditToolDetails,
        };
      });
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          details: undefined,
        };
      }
    },

    renderCall(args, theme, context) {
      const text =
        context.lastComponent instanceof Text ? context.lastComponent : new Text("", 0, 0);
      const path = args?.path ?? "";
      const pathDisplay = path ? theme.fg("accent", path) : theme.fg("toolOutput", "...");
      text.setText(`${theme.fg("toolTitle", theme.bold("edit"))} ${pathDisplay}`);
      return text;
    },

    renderResult(result, state, theme, context) {
      const text =
        context.lastComponent instanceof Text ? context.lastComponent : new Text("", 0, 0);
      const { isPartial } = state;

      if (isPartial) {
        text.setText(theme.fg("warning", "\nEditing..."));
        return text;
      }

      const details = result.details as EditToolDetails | undefined;
      const content = result.content[0];

      if (content?.type === "text" && content.text.startsWith("Error")) {
        text.setText(`\n${theme.fg("error", content.text)}`);
        return text;
      }

      if (!details?.diff) {
        text.setText("");
        return text;
      }

      const path = (context.args as { path?: string } | undefined)?.path;
      text.setText(`\n${renderDiff(details.diff, { filePath: path })}`);
      return text;
    },
  });
}
