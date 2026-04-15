/**
 * Fuzzy Edit Extension — tab-aware whitespace fallback for the edit tool
 *
 * Wraps the built-in edit tool. When the built-in tool fails to find oldText,
 * this extension retries with progressively relaxed whitespace matching:
 *
 *   1. Exact match (built-in tool, includes Unicode/trailing whitespace fuzzy)
 *   2. Tab-to-space normalization (preserves indentation structure)
 *   3. Content-only matching (strips all leading/trailing whitespace per line)
 *
 * This handles the most common edit failures: tab vs space indentation,
 * wrong indentation depth, and trailing whitespace differences.
 */

import type { ExtensionAPI, EditToolDetails } from "@mariozechner/pi-coding-agent";
import { createEditTool, withFileMutationQueue } from "@mariozechner/pi-coding-agent";
import { readFile, writeFile, access, constants } from "node:fs/promises";
import { resolve } from "node:path";

import { editSchema, prepareArguments } from "./schema";
import { tabFuzzyReplace } from "./fuzzy-match";
import { generateDiff } from "./diff";

// ── Extension registration ───────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  const cwd = process.cwd();
  const originalEdit = createEditTool(cwd);

  pi.registerTool({
    name: "edit",
    label: "edit",
    description: originalEdit.description,
    parameters: editSchema,
    promptSnippet:
      "Make precise file edits with exact text replacement, including multiple disjoint edits in one call",
    promptGuidelines: [
      "Use edit for precise changes (edits[].oldText must match exactly)",
      "When changing multiple separate locations in one file, use one edit call with multiple entries in edits[] instead of multiple edit calls",
      "Each edits[].oldText is matched against the original file, not after earlier edits are applied. Do not emit overlapping or nested edits. Merge nearby changes into one edit.",
      "Keep edits[].oldText as small as possible while still being unique in the file. Do not pad with large unchanged regions.",
      'edits must be a JSON array of objects, not a string. Pass edits as an actual array: "edits": [{"oldText": ..., "newText": ...}] — never "edits": "[...]"',
    ],
    prepareArguments,

    async execute(toolCallId, params, signal, onUpdate, ctx) {
      // ── Step 1: Try original edit (exact + built-in Unicode fuzzy) ──
      try {
        return await originalEdit.execute(toolCallId, params, signal, onUpdate);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes("Could not find")) {
          throw err; // Re-throw non-matching errors (file not found, permissions, etc.)
        }
      }

      // ── Step 2: Tab-aware fuzzy matching fallback ──
      const editPath = (params.path ?? "").replace(/^@/, "");
      const resolvedCwd = (ctx as unknown as { cwd?: string }).cwd ?? cwd;
      const absolutePath = resolve(resolvedCwd, editPath);
      const edits = params.edits;

      if (!edits || edits.length === 0) {
        throw new Error("edits must contain at least one replacement.");
      }

      return withFileMutationQueue(absolutePath, async () => {
        // Check file access
        try {
          await access(absolutePath, constants.R_OK | constants.W_OK);
        } catch {
          throw new Error(`File not found: ${editPath}`);
        }

        // Read file, strip BOM
        const buffer = await readFile(absolutePath);
        const rawContent = buffer.toString("utf-8");
        const content = rawContent.replace(/^\uFEFF/, "");

        let modified = content;
        let anyFuzzy = false;

        // Apply each edit with fuzzy whitespace matching
        for (const edit of edits) {
          if (!edit.oldText) {
            throw new Error(`oldText must not be empty in ${editPath}.`);
          }
          const result = tabFuzzyReplace(modified, edit.oldText, edit.newText);
          if (!result.found) {
            throw new Error(
              `Could not find oldText in ${editPath} (tried exact, tab-normalized, and content-only matching). ` +
                "The oldText must match including all non-whitespace content.",
            );
          }
          modified = result.content;
          if (result.fuzzy) anyFuzzy = true;
        }

        if (content === modified) {
          throw new Error(
            `No changes made to ${editPath}. The replacement produced identical content.`,
          );
        }

        await writeFile(absolutePath, modified, "utf-8");

        const diffResult = generateDiff(content, modified);
        return {
          content: [
            {
              type: "text" as const,
              text: anyFuzzy
                ? `Applied ${edits.length} edit(s) via tab-aware fuzzy matching in ${editPath}.`
                : `Applied ${edits.length} edit(s) in ${editPath}.`,
            },
          ],
          details: {
            diff: diffResult.diff,
            firstChangedLine: diffResult.firstChangedLine,
          } satisfies EditToolDetails,
        };
      });
    },

    // No custom rendering — built-in edit renderer is inherited automatically
  });
}
