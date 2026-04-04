/**
 * Explore Subagent — delegate codebase exploration to a separate model
 *
 * Spawns a `pi` subprocess with read-only tools to investigate the codebase.
 * The model is configurable via:
 *   - Environment variable: CHEAP_MODEL (e.g. "xiaomi-mimo/mimo-v2-flash")
 *   - Falls back to the default model if not set
 *
 * The explore agent uses read-only tools and returns structured findings
 * without modifying any files.
 */

import * as path from "node:path";
import { type ExtensionAPI, getMarkdownTheme } from "@mariozechner/pi-coding-agent";
import { Container, Markdown, Spacer, Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";

import {
	resolveRealCwd,
	parseSections,
	getSectionSummary,
	formatUsageLine,
	splitIntoSentences,
	runSubagent,
	getModel,
} from "@pi-ext/shared";

const EXPLORE_SYSTEM_PROMPT = `You are a codebase explorer. You MUST stay strictly on-topic.

## ABSOLUTE RULES
1. NEVER read files unrelated to the query keywords.
2. NEVER list directory contents out of curiosity — only grep/find for query terms.
3. NEVER follow tangents. If a file contains a mention of something unrelated, ignore it.
4. NEVER read config files (package.json, tsconfig.json, README, .env) unless the query explicitly asks about configuration.
5. Maximum 10 tool calls total. Stop and summarize once you have enough information.
6. If you cannot find relevant files after 3 grep/find attempts, report that and STOP. Do NOT broaden the search.

## STRATEGY (follow this order exactly)
1. Extract the 2-4 most specific keywords from the query.
2. Run grep -r with those exact keywords to locate relevant files.
3. Read ONLY matching files or sections.
4. If imports point to other directly-relevant files, follow them. Otherwise, do NOT.
5. Summarize your findings.

## OUTPUT FORMAT
Produce exactly these sections:

## Files Retrieved
Numbered list with line ranges: 1. \`path/to/file\` (lines X-Y) — one-line description

## Key Code
Only the code snippets directly relevant to the query.

## Summary
2-5 sentence answer to the query. Nothing else.`;

/** Base CLI flags for the explore subagent */
const EXPLORE_BASE_FLAGS = [
	"--no-session",
	"--no-extensions",
	"--no-skills",
	"--no-prompt-templates",
	"--tools", "read,grep,find,ls,bash",
];

const ExploreParams = Type.Object({
	query: Type.String({ description: "What to explore in the codebase. Be specific about what you're looking for." }),
	directory: Type.Optional(Type.String({ description: "Directory to explore (defaults to current working directory)" })),
	thoroughness: Type.Optional(
		Type.String({ description: "How thorough to be: quick, medium (default), or thorough" }),
	),
});

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "explore",
		label: "Explore",
		description: [
			"Delegate codebase exploration to a subagent running on a separate (cheaper/faster) model.",
			"Useful for reconnaissance: finding files, tracing dependencies, understanding architecture.",
			"The explore agent is read-only — it cannot modify files.",
			"Configure the model via CHEAP_MODEL env var (e.g. 'xiaomi-mimo/mimo-v2-flash').",
			"You may call explore up to 4 times in parallel to investigate different aspects of the codebase simultaneously.",
		].join(" "),
		promptSnippet: "Explore the codebase to find files, trace dependencies, or understand architecture",
		promptGuidelines: [
			"Use explore for codebase reconnaissance — finding relevant files, tracing imports, understanding structure.",
			"Prefer explore over multiple read/grep calls when you need to broadly investigate an unfamiliar area.",
			"Call explore up to 4 times in parallel when investigating multiple independent aspects of the codebase (e.g. different modules, different concerns).",
			"Write specific, keyword-rich queries. Bad: 'explore the codebase'. Good: 'tmux wt worktrunk integration pane_current_path'.",
			"Provide a directory hint when you know where to look. Use the directory parameter to scope the search (e.g. 'tmux/.config/tmux/scripts/').",
		],
		parameters: ExploreParams,

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const realCwd = resolveRealCwd(ctx.cwd);
			const cwd = params.directory ? path.resolve(realCwd, params.directory) : realCwd;

			// Build query with thoroughness hint
			const thoroughness = params.thoroughness || "medium";
			const toolBudget = thoroughness === "quick" ? 5 : thoroughness === "thorough" ? 20 : 10;
			let query = params.query;
			query += `\n\n[Constraints: thoroughness=${thoroughness}, max ${toolBudget} tool calls, stay strictly on-topic]`;
			if (params.directory) {
				query += `\n[Scope: only look in ${params.directory}]`;
			}

			const result = await runSubagent({
				cwd,
				query,
				systemPrompt: EXPLORE_SYSTEM_PROMPT,
				baseFlags: EXPLORE_BASE_FLAGS,
				signal,
				onUpdate: onUpdate
					? (text) => {
							onUpdate({
								content: [{ type: "text", text }],
								details: { model: getModel(), query },
							});
						}
					: undefined,
				loopDetection: true,
				maxToolCalls: 30,
				tmux: { label: "explore" },
				tmpPrefix: "pi-explore-",
			});

			const isError = result.exitCode !== 0 || !!result.errorMessage;
			if (isError) {
				const errorMsg = result.errorMessage || result.stderr || result.output || "(no output)";
				return {
					content: [{ type: "text", text: `Explore failed: ${errorMsg}` }],
					details: { model: getModel(), query, usage: result.usage, success: false },
				};
			}

			return {
				content: [{ type: "text", text: result.output || "(no output)" }],
				details: {
					model: getModel(),
					usedModel: result.model,
					query,
					usage: result.usage,
					success: true,
				},
			};
		},

		renderCall(args, theme, context) {
			const model = getModel();
			const preview = args.query.length > 80 ? `${args.query.slice(0, 80)}...` : args.query;
			let content =
				theme.fg("toolTitle", theme.bold("explore ")) +
				(model ? theme.fg("muted", `[${model}] `) : "") +
				theme.fg("dim", preview);
			if (args.directory) {
				content += `\n  ${theme.fg("muted", `in ${args.directory}`)}`;
			}
			// Reuse existing component if available to avoid duplicate renders
			const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
			text.setText(content);
			return text;
		},

		renderResult(result, { expanded, isPartial }, theme, _context) {
			const details = result.details as {
				model?: string;
				usedModel?: string;
				query?: string;
				success?: boolean;
				usage?: { input: number; output: number; turns: number; cost: number; contextTokens: number };
			} | undefined;

			const text = result.content[0];
			const output = text?.type === "text" ? text.text : "(no output)";
			const isError = details?.success === false;
			const icon = isError ? theme.fg("error", "✗") : theme.fg("success", "✓");
			const sections = parseSections(output);

			// Streaming/partial: show progress with parsed sections so far
			if (isPartial) {
				if (sections.length === 0) {
					return new Text(theme.fg("warning", "⏳ exploring..."), 0, 0);
				}
				let content = theme.fg("warning", "⏳ ") + theme.fg("toolTitle", theme.bold("explore"));
				for (const section of sections) {
					const summary = getSectionSummary(section.content);
					content += `\n  ${theme.fg("muted", `${section.title}:`)} ${theme.fg("dim", summary)}`;
				}
				return new Text(content, 0, 0);
			}

			const mdTheme = getMarkdownTheme();

			if (expanded) {
				const container = new Container();
				container.addChild(new Text(`${icon} ${theme.fg("toolTitle", theme.bold("explore"))}`, 0, 0));
				if (details?.query) {
					container.addChild(new Text(theme.fg("muted", "Query: ") + theme.fg("dim", details.query), 0, 0));
				}

				if (isError) {
					container.addChild(new Spacer(1));
					container.addChild(new Text(theme.fg("error", output), 0, 0));
				} else if (sections.length > 0) {
					for (const section of sections) {
						container.addChild(new Spacer(1));
						container.addChild(new Text(theme.fg("muted", `─── ${section.title} ───`), 0, 0));
						if (section.content) {
							container.addChild(new Markdown(section.content, 0, 0, mdTheme));
						}
					}
				} else {
					container.addChild(new Spacer(1));
					container.addChild(new Markdown(output.trim(), 0, 0, mdTheme));
				}

				if (details?.usage) {
					const usageLine = formatUsageLine(details.usage, details.usedModel);
					if (usageLine) {
						container.addChild(new Spacer(1));
						container.addChild(new Text(theme.fg("dim", usageLine), 0, 0));
					}
				}
				return container;
			}

			// Collapsed: structured section summaries
			let rendered = `${icon} ${theme.fg("toolTitle", theme.bold("explore"))}`;

			if (isError) {
				const errorPreview = output.length > 120 ? `${output.slice(0, 120)}...` : output;
				rendered += `\n  ${theme.fg("error", errorPreview)}`;
			} else if (sections.length > 0) {
				for (const section of sections) {
					const summary = getSectionSummary(section.content);
					rendered += `\n  ${theme.fg("muted", `${section.title}:`)} ${theme.fg("dim", summary)}`;
				}
			} else {
				// Fallback for unstructured output - use shared sentence parser
				const sentences = splitIntoSentences(output);

				if (sentences.length === 0) {
					const preview = output.length > 150 ? `${output.slice(0, 150)}...` : output;
					rendered += `\n  ${theme.fg("dim", preview)}`;
				} else {
					const maxItems = Math.min(sentences.length, 4);
					for (let i = 0; i < maxItems; i++) {
						rendered += `\n  ${theme.fg("muted", "•")} ${theme.fg("dim", sentences[i].text)}`;
					}
					if (sentences.length > 4) {
						rendered += `\n  ${theme.fg("muted", `... +${sentences.length - 4} more`)}`;
					}
				}
			}

			if (details?.usage) {
				const usageLine = formatUsageLine(details.usage, details.usedModel);
				if (usageLine) rendered += `\n  ${theme.fg("dim", usageLine)}`;
			}
			rendered += `\n  ${theme.fg("muted", "(Ctrl+O to expand)")}`;
			return new Text(rendered, 0, 0);
		},
	});

	// Register /explore command for interactive use
	pi.registerCommand("explore", {
		description: "Run explore subagent interactively",
		handler: async (args, ctx) => {
			if (!args.trim()) {
				ctx.ui.notify("Usage: /explore <query>", "info");
				return;
			}
			// Send as a prompt that triggers the explore tool
			pi.sendUserMessage(
				`Use the explore tool to investigate: ${args}`,
				{ deliverAs: ctx.isIdle() ? undefined : "followUp" },
			);
		},
	});
}
