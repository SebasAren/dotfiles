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

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { type ExtensionAPI, getMarkdownTheme } from "@mariozechner/pi-coding-agent";
import { Container, Markdown, Spacer, Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";

import {
	resolveRealCwd,
	formatTokens,
	parseSections,
	getSectionSummary,
	formatUsageLine,
	splitIntoSentences,
	formatAsBulletList,
	getPiInvocation,
	type SubagentResult,
	type UsageStats,
} from "@pi-ext/shared";



const EXPLORE_SYSTEM_PROMPT = `You are a codebase explorer. Your job is to investigate the codebase and return structured findings.

You have read-only tools (read, grep, find, ls, bash). Do NOT modify any files.

Strategy:
1. Use grep/find to locate relevant code
2. Read key sections (not entire files)
3. Identify types, interfaces, key functions
4. Note dependencies between files

Output format:

## Files Retrieved
List with exact line ranges:
1. \`path/to/file\` (lines 10-50) - Description of what's here

## Key Code
Critical types, interfaces, or functions with actual code snippets.

## Architecture
Brief explanation of how the pieces connect.

## Summary
Concise answer to the exploration query.`;



/** Parse `## Title` sections from subagent markdown output */


/** Get a one-line summary from section content */


/** Format usage stats as a dim string */


function getExploreModel(): string | undefined {
	const env = process.env.CHEAP_MODEL;
	if (env) return env;
	return undefined;
}





async function runExplore(
	cwd: string,
	query: string,
	signal: AbortSignal | undefined,
	onUpdate: ((text: string) => void) | undefined,
): Promise<SubagentResult> {
	const model = getExploreModel();
	const args: string[] = ["--mode", "json", "-p", "--no-session", "--no-extensions", "--no-skills", "--no-prompt-templates", "--tools", "read,grep,find,ls,bash"];
	if (model) args.push("--model", model);
	args.push(query);

	let tmpDir: string | null = null;
	let tmpPromptPath: string | null = null;

	const result: SubagentResult = {
		exitCode: 0,
		output: "",
		stderr: "",
		usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
	};

	const emitUpdate = () => {
		onUpdate?.(result.output || "(exploring...)");
	};

	try {
		// Write system prompt to temp file
		tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "pi-explore-"));
		tmpPromptPath = path.join(tmpDir, "system-prompt.md");
		await fs.promises.writeFile(tmpPromptPath, EXPLORE_SYSTEM_PROMPT, { encoding: "utf-8", mode: 0o600 });
		args.splice(args.indexOf("--no-session") + 1, 0, "--append-system-prompt", tmpPromptPath);

		let wasAborted = false;
		const TIMEOUT_MS = 120_000; // 2 minutes

		const exitCode = await new Promise<number>((resolve) => {
			const invocation = getPiInvocation(args);
			console.log(`[explore] spawning: ${invocation.command} ${invocation.args.join(" ")}`);
			console.log(`[explore] cwd: ${cwd}`);
			const proc = spawn(invocation.command, invocation.args, {
				cwd,
				shell: false,
				stdio: ["pipe", "pipe", "pipe"],
				env: { ...process.env, PI_REAL_CWD: cwd },
			});
			proc.stdin.end(); // Signal EOF so subprocess doesn't wait for input

			// Timeout: kill subprocess if it takes too long
			const timeout = setTimeout(() => {
				console.log(`[explore] timeout after ${TIMEOUT_MS}ms, killing subprocess`);
				proc.kill("SIGTERM");
				setTimeout(() => {
					if (!proc.killed) proc.kill("SIGKILL");
				}, 5000);
			}, TIMEOUT_MS);
			let buffer = "";

			const processLine = (line: string) => {
				if (!line.trim()) return;
				let event: any;
				try {
					event = JSON.parse(line);
				} catch {
					return;
				}

				if (event.type === "message_end" && event.message) {
					const msg = event.message;
					if (msg.role === "assistant") {
						result.usage.turns++;
						const usage = msg.usage;
						if (usage) {
							result.usage.input += usage.input || 0;
							result.usage.output += usage.output || 0;
							result.usage.cacheRead += usage.cacheRead || 0;
							result.usage.cacheWrite += usage.cacheWrite || 0;
							result.usage.cost += usage.cost?.total || 0;
							result.usage.contextTokens = usage.totalTokens || 0;
						}
						if (!result.model && msg.model) result.model = msg.model;
						if (msg.errorMessage) result.errorMessage = msg.errorMessage;

						// Extract text content
						for (const part of msg.content) {
							if (part.type === "text") {
								result.output += part.text;
							}
						}
						emitUpdate();
					}
				}
			};

			proc.stdout.on("data", (data) => {
				buffer += data.toString();
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";
				for (const line of lines) processLine(line);
			});

			proc.stderr.on("data", (data) => {
				const str = data.toString();
				result.stderr += str;
				console.log(`[explore] stderr: ${str.slice(0, 200)}`);
			});

			proc.on("close", (code) => {
				clearTimeout(timeout);
				if (buffer.trim()) processLine(buffer);
				console.log(`[explore] subprocess exited with code ${code}, output length: ${result.output.length}`);
				resolve(code ?? 0);
			});

			proc.on("error", () => {
				resolve(1);
			});

			if (signal) {
				const killProc = () => {
					wasAborted = true;
					proc.kill("SIGTERM");
					setTimeout(() => {
						if (!proc.killed) proc.kill("SIGKILL");
					}, 5000);
				};
				if (signal.aborted) killProc();
				else signal.addEventListener("abort", killProc, { once: true });
			}
		});

		result.exitCode = exitCode;
		if (wasAborted) throw new Error("Explore agent was aborted");
		return result;
	} finally {
		if (tmpPromptPath) {
			try { fs.unlinkSync(tmpPromptPath); } catch { /* ignore */ }
		}
		if (tmpDir) {
			try { fs.rmdirSync(tmpDir); } catch { /* ignore */ }
		}
	}
}

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
		],
		parameters: ExploreParams,

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const realCwd = resolveRealCwd(ctx.cwd);
			const cwd = params.directory ? path.resolve(realCwd, params.directory) : realCwd;
			const query = params.query;

			const result = await runExplore(
				cwd,
				query,
				signal,
				onUpdate
					? (text) => {
							onUpdate({
								content: [{ type: "text", text }],
								details: { model: getExploreModel(), query },
							});
						}
					: undefined,
			);

			const isError = result.exitCode !== 0 || !!result.errorMessage;
			if (isError) {
				const errorMsg = result.errorMessage || result.stderr || result.output || "(no output)";
				return {
					content: [{ type: "text", text: `Explore failed: ${errorMsg}` }],
					details: { model: getExploreModel(), query, usage: result.usage, success: false },
				};
			}

			return {
				content: [{ type: "text", text: result.output || "(no output)" }],
				details: {
					model: getExploreModel(),
					usedModel: result.model,
					query,
					usage: result.usage,
					success: true,
				},
			};
		},

		renderCall(args, theme, context) {
			const model = getExploreModel();
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
