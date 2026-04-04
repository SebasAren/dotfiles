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

import { execSync, spawn } from "node:child_process";
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

/**
 * Creates a normalized signature from tool args to detect near-duplicates.
 * Normalizes paths and trims long values.
 */
function argsSignature(args: Record<string, unknown>): string {
	const entries = Object.entries(args)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([k, v]) => {
			const s = typeof v === "string" ? v : JSON.stringify(v);
			// Normalize paths: strip trailing slashes, resolve ./ prefixes
			const normalized = s.replace(/\/+$/, "").replace(/^\.\//, "");
			// Truncate long values to avoid false negatives from minor differences
			return `${k}:${normalized.length > 100 ? normalized.slice(0, 100) + "..." : normalized}`;
		});
	return entries.join("|");
}

/**
 * Detects loops by tracking recent tool call signatures.
 * Returns a description of the loop if detected, or null otherwise.
 */
function detectLoop(
	toolHistory: Array<{ name: string; argsSignature: string }>,
	windowSize: number = 6,
): string | null {
	const recent = toolHistory.slice(-windowSize);
	if (recent.length < 3) return null;

	// Check for repeated subsequences of length 2+ (A,B,A,B pattern)
	for (let seqLen = 2; seqLen <= Math.floor(recent.length / 2); seqLen++) {
		const first = recent.slice(-seqLen * 2, -seqLen);
		const second = recent.slice(-seqLen);
		if (first.length === seqLen && second.length === seqLen) {
			let match = true;
			for (let i = 0; i < seqLen; i++) {
				if (first[i].name !== second[i].name || first[i].argsSignature !== second[i].argsSignature) {
					match = false;
					break;
				}
			}
			if (match) {
				const toolNames = second.map((t) => t.name).join(", ");
				return `Loop detected: ${seqLen}-tool sequence repeated (${toolNames})`;
			}
		}
	}

	// Check for 3+ identical consecutive calls
	const lastSig = recent[recent.length - 1];
	let identicalCount = 0;
	for (let i = recent.length - 1; i >= 0; i--) {
		if (recent[i].name === lastSig.name && recent[i].argsSignature === lastSig.argsSignature) {
			identicalCount++;
		} else {
			break;
		}
	}
	if (identicalCount >= 3) {
		return `Loop detected: ${lastSig.name} called ${identicalCount} times with same args`;
	}

	return null;
}

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

/** Pretty-printer script for tmux pane.
 *  Reads a growing JSONL file and renders tool calls + assistant text in real-time.
 *  Uses String.raw to preserve \x1b and \n as literal escape sequences in the output file. */
const EXPLORE_PP_SCRIPT = String.raw`#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const tmpDir = process.argv[2] || "";
const R = "\x1b[0m", B = "\x1b[1m", D = "\x1b[2m", C = "\x1b[36m", G = "\x1b[32m";

let query = "";
try { query = fs.readFileSync(path.join(tmpDir, "query.txt"), "utf8").trim(); } catch {}
if (query) {
  const firstLine = query.split("\n")[0];
  const preview = firstLine.length > 80 ? firstLine.slice(0, 80) + "..." : firstLine;
  process.stdout.write(B + C + "\u25b6 explore" + R + " " + D + preview + R + "\n");
  process.stdout.write(D + "\u2500".repeat(50) + R + "\n\n");
}

const outputPath = path.join(tmpDir, "explore-output.jsonl");
let fd = -1;
let offset = 0;
let toolCount = 0;

function poll() {
  try {
    if (fd === -1) fd = fs.openSync(outputPath, "r");
    const stat = fs.fstatSync(fd);
    if (stat.size > offset) {
      const buf = Buffer.alloc(stat.size - offset);
      fs.readSync(fd, buf, 0, buf.length, offset);
      offset += buf.length;
      const newContent = buf.toString("utf8");
      for (const line of newContent.split("\n")) {
        if (!line.trim()) continue;
        let e;
        try { e = JSON.parse(line); } catch { continue; }
        if (e.type === "tool_execution_start") {
          toolCount++;
          const name = e.toolName || "?";
          let detail = "";
          if (e.args && e.args.query) detail = String(e.args.query).slice(0, 60);
          else if (e.args && e.args.path) detail = e.args.path;
          else if (e.args && e.args.command) detail = String(e.args.command).slice(0, 50);
          else if (e.args && e.args.pattern) detail = String(e.args.pattern).slice(0, 50);
          process.stdout.write(D + "[" + toolCount + "]" + R + " " + C + name + R + (detail ? ": " + D + detail + R : "") + "\n");
        } else if (e.type === "message_end" && e.message && e.message.role === "assistant") {
          for (const p of (e.message.content || [])) {
            if (p.type === "text" && p.text) process.stdout.write("\n" + p.text + "\n");
          }
        } else if (e.type === "explore_done") {
          process.stdout.write("\n" + D + "\u2500".repeat(50) + R + "\n");
          process.stdout.write(G + B + "\u2713 explore complete" + R + " (" + toolCount + " tool calls)\n");
          if (fd !== -1) fs.closeSync(fd);
          process.exit(0);
        }
      }
    }
  } catch (e) {
    if (e.code === "ENOENT") { process.exit(0); }
  }
  setTimeout(poll, 150);
}
poll();
`;

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
	let tmuxOutputPath: string | null = null;

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

		// --- Tmux pane: tee JSONL to a file, pretty-print in a split pane ---

		if (process.env.TMUX) {
			try {
				// Write query for pane header
				await fs.promises.writeFile(path.join(tmpDir, "query.txt"), query, "utf8");

				// Write pretty-printer script
				const ppScriptPath = path.join(tmpDir, "explore-pp.js");
				await fs.promises.writeFile(ppScriptPath, EXPLORE_PP_SCRIPT, { mode: 0o755 });

				// Create empty output file
				tmuxOutputPath = path.join(tmpDir, "explore-output.jsonl");
				await fs.promises.writeFile(tmuxOutputPath, "", "utf8");

				// Split tmux pane running the pretty-printer
				execSync(
					`tmux split-window -h -l 35% "node '${ppScriptPath}' '${tmpDir}'; rm -rf '${tmpDir}'"`,
				{ stdio: "ignore" },
			);
			} catch (err) {
				// tmux pane setup failed, continuing without pane
				tmuxOutputPath = null;
			}
		}

		let wasAborted = false;
		let loopDetected = false;
		const TIMEOUT_MS = 120_000; // 2 minutes
		const MAX_TOOL_CALLS = 30;
		const toolHistory: Array<{ name: string; argsSignature: string }> = [];

		const exitCode = await new Promise<number>((resolve) => {
			const invocation = getPiInvocation(args);
			const proc = spawn(invocation.command, invocation.args, {
				cwd,
				shell: false,
				stdio: ["pipe", "pipe", "pipe"],
				env: { ...process.env, PI_REAL_CWD: cwd },
			});
			proc.stdin.end(); // Signal EOF so subprocess doesn't wait for input

			// Helper to kill the subprocess with a reason
			const killProc = (reason: string) => {
				proc.kill("SIGTERM");
				setTimeout(() => {
					if (!proc.killed) proc.kill("SIGKILL");
				}, 5000);
			};

			// Timeout: kill subprocess if it takes too long
			const timeout = setTimeout(() => {
				killProc(`timeout after ${TIMEOUT_MS}ms`);
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

				// Track tool calls for loop detection
				if (event.type === "tool_execution_start" && event.toolName) {
					const args = event.args || {};
					toolHistory.push({
						name: event.toolName,
						argsSignature: argsSignature(args),
					});

					// Hard limit on total tool calls
					if (toolHistory.length > MAX_TOOL_CALLS) {
						loopDetected = true;
						result.output += `\n\n[Explore stopped: exceeded ${MAX_TOOL_CALLS} tool calls]`;
						emitUpdate();
						killProc(`exceeded ${MAX_TOOL_CALLS} tool calls`);
						return;
					}

					// Pattern-based loop detection
					const loopMsg = detectLoop(toolHistory);
					if (loopMsg) {
						loopDetected = true;
						result.output += `\n\n[Explore stopped: ${loopMsg}]`;
						emitUpdate();
						killProc(loopMsg);
						return;
					}
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
				const chunk = data.toString();
				if (tmuxOutputPath) {
					try { fs.appendFileSync(tmuxOutputPath, chunk); } catch { /* ignore */ }
				}
				buffer += chunk;
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";
				for (const line of lines) processLine(line);
			});

			proc.stderr.on("data", (data) => {
				result.stderr += data.toString();
			});

			proc.on("close", (code) => {
				clearTimeout(timeout);
				if (buffer.trim()) processLine(buffer);
				resolve(code ?? 0);
			});

			proc.on("error", () => {
				resolve(1);
			});

			if (signal) {
				const abortKill = () => {
					wasAborted = true;
					killProc("aborted");
				};
				if (signal.aborted) abortKill();
				else signal.addEventListener("abort", abortKill, { once: true });
			}
		});

		result.exitCode = loopDetected ? 0 : exitCode;
		if (wasAborted) throw new Error("Explore agent was aborted");
		return result;
	} finally {
		if (tmpPromptPath) {
			try { fs.unlinkSync(tmpPromptPath); } catch { /* ignore */ }
		}
		if (tmuxOutputPath) {
			// Signal the tmux pretty-printer to stop; its shell command cleans up tmpDir
			try { fs.appendFileSync(tmuxOutputPath, JSON.stringify({ type: "explore_done" }) + "\n"); } catch { /* ignore */ }
		} else if (tmpDir) {
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