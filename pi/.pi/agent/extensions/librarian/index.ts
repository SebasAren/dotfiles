/**
 * Librarian Subagent — delegate documentation research to a separate model
 *
 * Spawns a `pi` subprocess with web_search (Exa) and context7 tools to research
 * external documentation. The model is configurable via:
 *   - Environment variable: CHEAP_MODEL (e.g. "xiaomi-mimo/mimo-v2-flash")
 *   - Falls back to the default model if not set
 *
 * The librarian agent uses web search and library docs tools and returns
 * structured findings without modifying any files.
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { type ExtensionAPI, getMarkdownTheme } from "@mariozechner/pi-coding-agent";
import { Container, Markdown, Spacer, Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";

function resolveRealCwd(cwd: string): string {
	// Bun virtualizes process.cwd() into /$bunfs/... which doesn't exist for subprocesses.
	// Try to resolve to a real filesystem path.
	try {
		const real = fs.realpathSync(cwd);
		if (fs.existsSync(real)) return real;
	} catch {
		// ignore
	}
	if (process.env.PWD && fs.existsSync(process.env.PWD)) return process.env.PWD;
	return process.cwd();
}

const LIBRARIAN_SYSTEM_PROMPT = `You are a documentation librarian. Your job is to research external documentation and return structured, actionable findings.

You have access to these tools:
- **web_search**: Search the web via Exa for current information, tutorials, guides, and documentation
- **context7_search**: Search for libraries in the Context7 database to find library IDs
- **context7_docs**: Fetch up-to-date documentation and code examples for a specific library

You do NOT have filesystem tools. Do NOT attempt to read, write, or edit files.

Research strategy:
1. If the query mentions a specific library, start with context7_search to find it
2. Use context7_docs to fetch relevant documentation snippets
3. Use web_search for supplementary information: tutorials, blog posts, changelogs, comparisons
4. If initial results are insufficient, refine your search and try again
5. Cross-reference multiple sources when possible

Output format:

## Sources
List all sources consulted:
1. \`Library/API name\` — brief description of what was found

## Documentation
The actual documentation content, organized by topic:
- Include relevant API signatures, types, and interfaces
- Include code examples where available
- Note version-specific information if found

## Key Findings
Concise summary answering the research query with specific details.

## Recommendations
If applicable, suggest best practices or patterns discovered from the documentation.`;

function formatTokens(count: number): string {
	if (count < 1000) return count.toString();
	if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
	if (count < 1000000) return `${Math.round(count / 1000)}k`;
	return `${(count / 1000000).toFixed(1)}M`;
}

function getLibrarianModel(): string | undefined {
	const env = process.env.CHEAP_MODEL;
	if (env) return env;
	return undefined;
}

function getPiInvocation(args: string[]): { command: string; args: string[] } {
	const currentScript = process.argv[1];
	if (currentScript && fs.existsSync(currentScript)) {
		return { command: process.execPath, args: [currentScript, ...args] };
	}
	const execName = path.basename(process.execPath).toLowerCase();
	const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
	if (!isGenericRuntime) {
		return { command: process.execPath, args };
	}
	return { command: "pi", args };
}

interface LibrarianResult {
	exitCode: number;
	output: string;
	stderr: string;
	usage: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
		cost: number;
		contextTokens: number;
		turns: number;
	};
	model?: string;
	errorMessage?: string;
}

async function runLibrarian(
	cwd: string,
	query: string,
	signal: AbortSignal | undefined,
	onUpdate: ((text: string) => void) | undefined,
): Promise<LibrarianResult> {
	const model = getLibrarianModel();
	// Note: we intentionally omit --no-extensions so that the exa-search and context7
	// extensions load, providing web_search, context7_search, and context7_docs tools.
	// We use --no-tools to skip built-in filesystem tools since the librarian only
	// needs external documentation tools.
	const args: string[] = [
		"--mode", "json", "-p", "--no-session",
		"--no-tools", "--no-skills", "--no-prompt-templates",
	];
	if (model) args.push("--model", model);
	args.push(query);

	let tmpDir: string | null = null;
	let tmpPromptPath: string | null = null;

	const result: LibrarianResult = {
		exitCode: 0,
		output: "",
		stderr: "",
		usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
	};

	const emitUpdate = () => {
		onUpdate?.(result.output || "(researching...)");
	};

	try {
		// Write system prompt to temp file
		tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "pi-librarian-"));
		tmpPromptPath = path.join(tmpDir, "system-prompt.md");
		await fs.promises.writeFile(tmpPromptPath, LIBRARIAN_SYSTEM_PROMPT, { encoding: "utf-8", mode: 0o600 });
		args.splice(args.indexOf("--no-session") + 1, 0, "--append-system-prompt", tmpPromptPath);

		let wasAborted = false;
		const TIMEOUT_MS = 180_000; // 3 minutes — documentation research can take longer

		const exitCode = await new Promise<number>((resolve) => {
			const invocation = getPiInvocation(args);
			console.log(`[librarian] spawning: ${invocation.command} ${invocation.args.join(" ")}`);
			console.log(`[librarian] cwd: ${cwd}`);
			const proc = spawn(invocation.command, invocation.args, {
				cwd,
				shell: false,
				stdio: ["pipe", "pipe", "pipe"],
			});
			proc.stdin.end(); // Signal EOF so subprocess doesn't wait for input

			// Timeout: kill subprocess if it takes too long
			const timeout = setTimeout(() => {
				console.log(`[librarian] timeout after ${TIMEOUT_MS}ms, killing subprocess`);
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
				console.log(`[librarian] stderr: ${str.slice(0, 200)}`);
			});

			proc.on("close", (code) => {
				clearTimeout(timeout);
				if (buffer.trim()) processLine(buffer);
				console.log(`[librarian] subprocess exited with code ${code}, output length: ${result.output.length}`);
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
		if (wasAborted) throw new Error("Librarian agent was aborted");
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

const LibrarianParams = Type.Object({
	query: Type.String({
		description: "What documentation or information to look for. Be specific about what you need.",
	}),
	library: Type.Optional(Type.String({
		description: "Specific library or framework name to search for (e.g., 'react', 'next.js', 'tanstack-query')",
	})),
	focus: Type.Optional(Type.String({
		description: "What to focus on: docs, examples, api, best-practices, or changelog",
	})),
});

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "librarian",
		label: "Librarian",
		description: [
			"Delegate documentation research to a subagent with access to web search (Exa) and library documentation (Context7).",
			"Useful for looking up APIs, finding examples, checking best practices, and reading external docs.",
			"The librarian agent can search the web and fetch up-to-date library documentation.",
			"You may call librarian up to 4 times in parallel to research different topics simultaneously.",
		].join(" "),
		promptSnippet: "Research external documentation using web search and Context7",
		promptGuidelines: [
			"Use librarian when you need up-to-date documentation, API references, or examples from external sources.",
			"Prefer librarian over web_search directly when you need the agent to synthesize findings from multiple sources.",
			"Call librarian up to 4 times in parallel when researching multiple independent topics or libraries.",
			"Requires EXA_API_KEY and/or CONTEXT7_API_KEY environment variables to be set.",
		],
		parameters: LibrarianParams,

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const realCwd = resolveRealCwd(ctx.cwd);
			// Build a focused query incorporating library and focus if provided
			let query = params.query;
			if (params.library) {
				query = `Research the ${params.library} library: ${query}`;
			}
			if (params.focus) {
				query += ` Focus on ${params.focus}.`;
			}

			const result = await runLibrarian(
				realCwd,
				query,
				signal,
				onUpdate
					? (text) => {
							onUpdate({
								content: [{ type: "text", text }],
								details: { model: getLibrarianModel(), query: params.query },
							});
						}
					: undefined,
			);

			const isError = result.exitCode !== 0 || !!result.errorMessage;
			if (isError) {
				const errorMsg = result.errorMessage || result.stderr || result.output || "(no output)";
				// Provide helpful error for missing API keys
				if (errorMsg.includes("EXA_API_KEY") || errorMsg.includes("CONTEXT7_API_KEY")) {
					return {
						content: [{
							type: "text",
							text: `Librarian requires API keys. Set environment variables:\n` +
								`  export EXA_API_KEY='your-key'          # For web search\n` +
								`  export CONTEXT7_API_KEY='your-key'     # For library docs\n` +
								`\nOriginal error: ${errorMsg}`,
						}],
						details: { model: getLibrarianModel(), query: params.query, usage: result.usage },
					};
				}
				return {
					content: [{ type: "text", text: `Librarian failed: ${errorMsg}` }],
					details: { model: getLibrarianModel(), query: params.query, usage: result.usage },
				};
			}

			return {
				content: [{ type: "text", text: result.output || "(no output)" }],
				details: {
					model: getLibrarianModel(),
					usedModel: result.model,
					query: params.query,
					library: params.library,
					focus: params.focus,
					usage: result.usage,
				},
			};
		},

		renderCall(args, theme, _context) {
			const model = getLibrarianModel();
			const preview = args.query.length > 80 ? `${args.query.slice(0, 80)}...` : args.query;
			let text =
				theme.fg("toolTitle", theme.bold("librarian ")) +
				(model ? theme.fg("muted", `[${model}] `) : "") +
				theme.fg("dim", preview);
			if (args.library) {
				text += `\n  ${theme.fg("accent", args.library)}`;
			}
			if (args.focus) {
				text += theme.fg("muted", ` · focus: ${args.focus}`);
			}
			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded }, theme, _context) {
			const details = result.details as {
				model?: string;
				usedModel?: string;
				query?: string;
				library?: string;
				focus?: string;
				usage?: { input: number; output: number; turns: number; cost: number; contextTokens: number };
			} | undefined;

			const text = result.content[0];
			const output = text?.type === "text" ? text.text : "(no output)";

			if (expanded) {
				const mdTheme = getMarkdownTheme();
				const container = new Container();
				container.addChild(new Text(theme.fg("toolTitle", theme.bold("librarian")), 0, 0));
				if (details?.query) {
					let header = theme.fg("muted", "Query: ") + theme.fg("dim", details.query);
					if (details.library) header += theme.fg("muted", ` · Library: `) + theme.fg("accent", details.library);
					if (details.focus) header += theme.fg("muted", ` · Focus: `) + theme.fg("dim", details.focus);
					container.addChild(new Text(header, 0, 0));
				}
				container.addChild(new Spacer(1));
				container.addChild(new Markdown(output.trim(), 0, 0, mdTheme));
				if (details?.usage) {
					const parts: string[] = [];
					if (details.usage.turns) parts.push(`${details.usage.turns} turn${details.usage.turns > 1 ? "s" : ""}`);
					if (details.usage.input) parts.push(`↑${formatTokens(details.usage.input)}`);
					if (details.usage.output) parts.push(`↓${formatTokens(details.usage.output)}`);
					if (details.usage.cost) parts.push(`$${details.usage.cost.toFixed(4)}`);
					if (details.usedModel) parts.push(details.usedModel);
					if (parts.length > 0) {
						container.addChild(new Spacer(1));
						container.addChild(new Text(theme.fg("dim", parts.join(" ")), 0, 0));
					}
				}
				return container;
			}

			// Collapsed: show first few lines
			const lines = output.split("\n");
			const preview = lines.slice(0, 5).join("\n");
			let rendered = preview;
			if (lines.length > 5) rendered += `\n${theme.fg("muted", `... ${lines.length - 5} more lines (Ctrl+O to expand)`)}`;
			if (details?.usage) {
				const parts: string[] = [];
				if (details.usage.turns) parts.push(`${details.usage.turns} turn${details.usage.turns > 1 ? "s" : ""}`);
				if (details.usage.cost) parts.push(`$${details.usage.cost.toFixed(4)}`);
				if (details.usedModel) parts.push(details.usedModel);
				if (parts.length > 0) rendered += `\n${theme.fg("dim", parts.join(" "))}`;
			}
			return new Text(rendered, 0, 0);
		},
	});

	// Register /librarian command for interactive use
	pi.registerCommand("librarian", {
		description: "Research external documentation interactively",
		handler: async (args, ctx) => {
			if (!args.trim()) {
				ctx.ui.notify("Usage: /librarian <query>  (e.g. /librarian how to use React Server Components)", "info");
				return;
			}
			pi.sendUserMessage(
				`Use the librarian tool to research: ${args}`,
				{ deliverAs: ctx.isIdle() ? undefined : "followUp" },
			);
		},
	});
}
