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
import { getMarkdownTheme, withFileMutationQueue } from "@mariozechner/pi-coding-agent";
import { Container, Markdown, Spacer, Text } from "@mariozechner/pi-tui";
import { readFile, writeFile, access, constants } from "node:fs/promises";
import { resolve } from "node:path";

import { hashLine } from "./hash";
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

      return {
        content: [{ type: "text" as const, text }],
        details: undefined,
      };
    },

    renderCall(args, theme, _context) {
      let text = theme.fg("toolTitle", theme.bold("read "));
      text += theme.fg("accent", args.path);
      if (args.offset || args.limit) {
        const parts: string[] = [];
        if (args.offset) parts.push(`offset=${args.offset}`);
        if (args.limit) parts.push(`limit=${args.limit}`);
        text += theme.fg("dim", ` (${parts.join(", ")})`);
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, state, theme, _context) {
      const { expanded, isPartial } = state;
      if (isPartial) return new Text(theme.fg("warning", "Reading..."), 0, 0);

      const content = result.content[0];

      if (content?.type === "image") {
        return new Text(theme.fg("success", "Image loaded"), 0, 0);
      }

      if (content?.type !== "text") {
        return new Text(theme.fg("error", "No content"), 0, 0);
      }

      const text = content.text;
      const cleaned = text.replace(/^\d+#[A-Z]{1,2}: /gm, "");
      const lines = cleaned.split("\n");
      const lineCount = lines.length;
      let rendered = theme.fg("success", `${lineCount} lines`);

      if (!expanded) {
        rendered += `\n  ${theme.fg("muted", "(Ctrl+O to expand)")}`;
        return new Text(rendered, 0, 0);
      }

      // Expanded: show file content with syntax highlighting via Markdown
      const container = new Container();
      container.addChild(
        new Text(`${theme.fg("success", "✓")} ${theme.fg("toolTitle", theme.bold("read"))}`, 0, 0),
      );
      container.addChild(new Spacer(1));

      // Show truncated preview (first 50 lines) with syntax highlighting
      const previewLines = lines.slice(0, 50);
      const previewText = previewLines.join("\n");
      const mdTheme = getMarkdownTheme();
      container.addChild(new Markdown(`\`\`\`\n${previewText}\n\`\`\`\``, 0, 0, mdTheme));

      if (lineCount > 50) {
        container.addChild(new Text(theme.fg("muted", `... ${lineCount - 50} more lines`), 0, 0));
      }

      return container;
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
      "For range replace, set both `pos` and `end` anchors.",
      "Multiple edits can be batched in one call — they are applied bottom-up.",
      "If a hash doesn't match the current file, the edit is rejected with a clear error.",
    ].join(" "),
    promptSnippet:
      "Make precise file edits using hash-anchored line references (LINE#HASH from read output)",
    promptGuidelines: [
      "Use edit for precise changes. Reference lines by their LINE#HASH anchors from the read output.",
      "When changing multiple locations in one file, use one edit call with multiple entries in edits[] instead of multiple edit calls.",
      "Each edits[] entry is validated against the original file — do not emit overlapping or nested edits.",
      "Keep edits as small as possible. Use `pos` for single-line changes, `pos` + `end` for ranges.",
      'edits must be a JSON array: `"edits": [{"pos": "11#KT", "lines": ["new code"]}]`.',
      "If a hash mismatch error occurs, re-read the file to get current anchors, then retry.",
    ],
    parameters: editSchema,
    prepareArguments,

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const editPath = (params.path ?? "").replace(/^@/, "");
      const resolvedCwd = (ctx as unknown as { cwd?: string }).cwd ?? cwd;
      const absolutePath = resolve(resolvedCwd, editPath);

      const edits = params.edits;
      if (!edits || edits.length === 0) {
        throw new Error("edits must contain at least one edit.");
      }

      return withFileMutationQueue(absolutePath, async () => {
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

        // Apply hashline edits
        const result = applyHashlineEdits(
          content,
          edits.map((e: any) => ({
            op: e.op || "replace",
            pos: e.pos,
            end: e.end,
            lines: e.lines,
          })) as HashEdit[],
        );

        await writeFile(absolutePath, result.content, "utf-8");

        return {
          content: [
            {
              type: "text" as const,
              text: `Applied ${result.stats.applied} hashline edit(s) in ${editPath}.`,
            },
          ],
          details: {
            diff: result.diff,
            firstChangedLine: result.firstChangedLine,
          } satisfies EditToolDetails,
        };
      });
    },

    renderCall(args, theme, _context) {
      let text = theme.fg("toolTitle", theme.bold("edit "));
      text += theme.fg("accent", args.path);
      const editCount = args.edits?.length ?? 0;
      text += theme.fg("dim", ` (${editCount} edit${editCount !== 1 ? "s" : ""})`);
      return new Text(text, 0, 0);
    },

    renderResult(result, state, theme, _context) {
      const { expanded, isPartial } = state;
      if (isPartial) return new Text(theme.fg("warning", "Editing..."), 0, 0);

      const details = result.details as EditToolDetails | undefined;
      const content = result.content[0];

      if (content?.type === "text" && content.text.startsWith("Error")) {
        return new Text(theme.fg("error", content.text.split("\n")[0]), 0, 0);
      }

      if (!details?.diff) {
        return new Text(theme.fg("success", "Applied"), 0, 0);
      }

      // Count additions and removals from the diff
      const diffLines = details.diff.split("\n");
      let additions = 0;
      let removals = 0;
      for (const line of diffLines) {
        if (line.startsWith("+") && !line.startsWith("+++")) additions++;
        if (line.startsWith("-") && !line.startsWith("---")) removals++;
      }

      let text = theme.fg("success", `+${additions}`);
      text += theme.fg("dim", " / ");
      text += theme.fg("error", `-${removals}`);

      if (!expanded) {
        text += `\n  ${theme.fg("muted", "(Ctrl+O to expand)")}`;
        return new Text(text, 0, 0);
      }

      // Expanded: show diff with colored lines
      const container = new Container();
      container.addChild(
        new Text(`${theme.fg("success", "✓")} ${theme.fg("toolTitle", theme.bold("edit"))}`, 0, 0),
      );
      container.addChild(new Spacer(1));

      for (const line of diffLines.slice(0, 50)) {
        if (line.startsWith("+") && !line.startsWith("+++")) {
          container.addChild(new Text(theme.fg("toolDiffAdded", line), 0, 0));
        } else if (line.startsWith("-") && !line.startsWith("---")) {
          container.addChild(new Text(theme.fg("toolDiffRemoved", line), 0, 0));
        } else if (line.startsWith("@@")) {
          container.addChild(new Text(theme.fg("syntaxKeyword", line), 0, 0));
        } else if (line === "--- original" || line === "+++ modified") {
          container.addChild(new Text(theme.fg("muted", line), 0, 0));
        } else {
          container.addChild(new Text(theme.fg("toolDiffContext", line), 0, 0));
        }
      }

      if (diffLines.length > 50) {
        container.addChild(
          new Text(theme.fg("muted", `... ${diffLines.length - 50} more diff lines`), 0, 0),
        );
      }

      return container;
    },
  });
}
