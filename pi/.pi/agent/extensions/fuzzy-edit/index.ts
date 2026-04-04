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
import { Type } from "@sinclair/typebox";
import * as Diff from "diff";
import { readFile, writeFile, access, constants } from "node:fs/promises";
import { resolve } from "node:path";

// ── Schema (matches built-in edit tool) ──────────────────────────────────────

const replaceEditSchema = Type.Object(
	{
		oldText: Type.String({
			description:
				"Exact text for one targeted replacement. It must be unique in the original file and must not overlap with any other edits[].oldText in the same call.",
		}),
		newText: Type.String({ description: "Replacement text for this targeted edit." }),
	},
	{ additionalProperties: false },
);

const editSchema = Type.Object(
	{
		path: Type.String({ description: "Path to the file to edit (relative or absolute)" }),
		edits: Type.Array(replaceEditSchema, {
			description:
				"One or more targeted replacements. Each edit is matched against the original file, not incrementally. Do not include overlapping or nested edits.",
		}),
	},
	{ additionalProperties: false },
);

/** Normalize legacy single-edit format (oldText/newText) to edits array */
function prepareArguments(args: unknown): { path: string; edits: { oldText: string; newText: string }[] } {
	if (!args || typeof args !== "object") return args as any;
	const input = args as { path?: string; edits?: Array<{ oldText: string; newText: string }>; oldText?: unknown; newText?: unknown };
	if (typeof input.oldText !== "string" || typeof input.newText !== "string") return args as any;
	const edits = [...(input.edits ?? [])];
	edits.push({ oldText: input.oldText, newText: input.newText });
	const { oldText: _, newText: __, ...rest } = input;
	return { ...rest, edits } as { path: string; edits: { oldText: string; newText: string }[] };
}

// ── Whitespace-fuzzy matching ────────────────────────────────────────────────

type NormalizeFn = (line: string) => string;

/** Tier 2: tabs → spaces, trim trailing whitespace */
const tabNormalize: NormalizeFn = (line) => line.replace(/\t/g, "  ").trimEnd();

/** Tier 3: collapse all whitespace, trim both sides */
const contentNormalize: NormalizeFn = (line) => line.replace(/\s+/g, " ").trim();

interface FuzzyResult {
	content: string;
	found: boolean;
	fuzzy: boolean;
}

/**
 * Try to find and replace oldText in content with progressively relaxed
 * whitespace normalization. Returns the modified content and whether fuzzy
 * matching was used.
 */
function tabFuzzyReplace(content: string, oldText: string, newText: string): FuzzyResult {
	// Tier 0: exact match
	const exactIdx = content.indexOf(oldText);
	if (exactIdx !== -1) {
		return {
			content: content.slice(0, exactIdx) + newText + content.slice(exactIdx + oldText.length),
			found: true,
			fuzzy: false,
		};
	}

	// Tier 1: tab-to-space normalization
	const tier1 = lineFuzzyMatch(content, oldText, newText, tabNormalize);
	if (tier1.found) return tier1;

	// Tier 2: content-only matching
	return lineFuzzyMatch(content, oldText, newText, contentNormalize);
}

/**
 * Line-based fuzzy matching. Normalizes each line of both content and oldText,
 * finds the matching line range, and replaces those lines with newText lines.
 * Requires exactly one match (unique).
 */
function lineFuzzyMatch(
	content: string,
	oldText: string,
	newText: string,
	normalize: NormalizeFn,
): FuzzyResult {
	const contentLines = content.split("\n");
	const searchLines = oldText.split("\n");
	if (searchLines.length === 0) return { content, found: false, fuzzy: false };

	const normalizedSearch = searchLines.map(normalize);

	// Find all matching positions
	const matches: number[] = [];
	for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
		let match = true;
		for (let j = 0; j < searchLines.length; j++) {
			if (normalize(contentLines[i + j]) !== normalizedSearch[j]) {
				match = false;
				break;
			}
		}
		if (match) matches.push(i);
	}

	if (matches.length === 0) return { content, found: false, fuzzy: false };

	if (matches.length > 1) {
		throw new Error(
			`Fuzzy whitespace matching found ${matches.length} matches. ` +
				"Provide more surrounding context in oldText to make it unique.",
		);
	}

	// Apply the single match — replace matched lines with newText lines
	const startLine = matches[0];
	const newLines = newText.split("\n");
	const result = [
		...contentLines.slice(0, startLine),
		...newLines,
		...contentLines.slice(startLine + searchLines.length),
	];

	return { content: result.join("\n"), found: true, fuzzy: true };
}

// ── Diff generation ──────────────────────────────────────────────────────────

/**
 * Generate a line-numbered diff matching the built-in edit tool's format.
 * Format: `+N line`, `-N line`, ` N line` where N is zero-padded line number.
 */
function generateDiff(
	oldContent: string,
	newContent: string,
): { diff: string; firstChangedLine?: number } {
	const maxLineNum = Math.max(oldContent.split("\n").length, newContent.split("\n").length);
	const width = String(maxLineNum).length;
	const parts = Diff.diffLines(oldContent, newContent);
	const output: string[] = [];
	let oldLine = 1;
	let newLine = 1;
	let firstChangedLine: number | undefined;
	const contextLines = 4;
	let lastWasChange = false;

	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];
		const raw = part.value.split("\n");
		if (raw[raw.length - 1] === "") raw.pop();

		if (part.added || part.removed) {
			if (firstChangedLine === undefined && part.added) {
				firstChangedLine = newLine;
			}
			for (const line of raw) {
				if (part.added) {
					output.push(`+${String(newLine).padStart(width, " ")} ${line}`);
					newLine++;
				} else {
					output.push(`-${String(oldLine).padStart(width, " ")} ${line}`);
					oldLine++;
				}
			}
			lastWasChange = true;
		} else {
			// Context lines — show limited context around changes
			const nextIsChange = i < parts.length - 1 && (parts[i + 1].added || parts[i + 1].removed);
			const hasLeading = lastWasChange;
			const hasTrailing = nextIsChange;

			if (hasLeading && hasTrailing) {
				if (raw.length <= contextLines * 2) {
					for (const line of raw) {
						output.push(` ${String(oldLine).padStart(width, " ")} ${line}`);
						oldLine++;
						newLine++;
					}
				} else {
					const leading = raw.slice(0, contextLines);
					const trailing = raw.slice(raw.length - contextLines);
					for (const line of leading) {
						output.push(` ${String(oldLine).padStart(width, " ")} ${line}`);
						oldLine++;
						newLine++;
					}
					output.push(` ${"".padStart(width, " ")} ...`);
					const skipped = raw.length - leading.length - trailing.length;
					oldLine += skipped;
					newLine += skipped;
					for (const line of trailing) {
						output.push(` ${String(oldLine).padStart(width, " ")} ${line}`);
						oldLine++;
						newLine++;
					}
				}
			} else if (hasLeading) {
				const shown = raw.slice(0, contextLines);
				for (const line of shown) {
					output.push(` ${String(oldLine).padStart(width, " ")} ${line}`);
					oldLine++;
					newLine++;
				}
				const skipped = raw.length - shown.length;
				if (skipped > 0) {
					output.push(` ${"".padStart(width, " ")} ...`);
					oldLine += skipped;
					newLine += skipped;
				}
			} else if (hasTrailing) {
				const skipped = Math.max(0, raw.length - contextLines);
				if (skipped > 0) {
					output.push(` ${"".padStart(width, " ")} ...`);
					oldLine += skipped;
					newLine += skipped;
				}
				for (const line of raw.slice(skipped)) {
					output.push(` ${String(oldLine).padStart(width, " ")} ${line}`);
					oldLine++;
					newLine++;
				}
			} else {
				// No adjacent changes — skip these context lines
				oldLine += raw.length;
				newLine += raw.length;
			}
			lastWasChange = false;
		}
	}

	return { diff: output.join("\n"), firstChangedLine };
}

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
