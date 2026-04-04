/**
 * WT Worktree Task — delegate implementation to a subagent in an isolated git worktree
 *
 * Creates a new worktree via `wt switch --create`, spawns a pi subagent to
 * implement the requested changes, then merges the worktree back with `wt merge`.
 *
 * The full lifecycle:
 *   1. Create worktree branch via `wt switch --create <branch>`
 *   2. Discover worktree path via `wt list --format=json`
 *   3. Spawn pi subprocess in worktree directory with implementation prompt
 *   4. On success, run `wt merge` to squash-merge into the default branch
 *   5. Return summary to the calling agent
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
	getPiInvocation,
	type SubagentResult as SubagentResultType,
} from "@pi-ext/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Env var set on child processes to prevent recursive wt_worktree_task registration */
const CHILD_ENV_VAR = "WT_WORKTREE_CHILD";

const TIMEOUT_MS = 600_000; // 10 minutes default for implementation tasks

function generateBranchName(task: string): string {
	const slug = task
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 5)
		.join("-");
	const suffix = Date.now().toString(36);
	return `agent/${slug || "task"}-${suffix}`;
}

function formatDuration(ms: number): string {
	const s = Math.round(ms / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	const rem = s % 60;
	return `${m}m${rem}s`;
}

function getSubagentModel(): string | undefined {
	return process.env.CHEAP_MODEL || undefined;
}

// ---------------------------------------------------------------------------
// wt CLI helpers
// ---------------------------------------------------------------------------

interface WtWorktreeInfo {
	branch: string;
	path: string;
	is_current: boolean;
}

async function execCommand(
	command: string,
	args: string[],
	cwd: string,
	signal?: AbortSignal,
	timeout?: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	return new Promise((resolve, reject) => {
		const proc = spawn(command, args, { cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });

		let stdout = "";
		let stderr = "";
		let settled = false;

		const timer = timeout
			? setTimeout(() => {
					settled = true;
					proc.kill("SIGTERM");
					setTimeout(() => {
						if (!proc.killed) proc.kill("SIGKILL");
					}, 5000);
					resolve({ stdout, stderr: stderr + "\nTimed out", exitCode: -1 });
				}, timeout)
			: null;

		proc.stdout.on("data", (d) => (stdout += d.toString()));
		proc.stderr.on("data", (d) => (stderr += d.toString()));
		proc.on("close", (code) => {
			if (settled) return;
			clearTimeout(timer!);
			resolve({ stdout, stderr, exitCode: code ?? 0 });
		});
		proc.on("error", (err) => {
			if (settled) return;
			clearTimeout(timer!);
			reject(err);
		});

		if (signal) {
			const kill = () => {
				settled = true;
				proc.kill("SIGTERM");
				setTimeout(() => {
					if (!proc.killed) proc.kill("SIGKILL");
				}, 5000);
			};
			if (signal.aborted) kill();
			else signal.addEventListener("abort", kill, { once: true });
		}
	});
}

async function createWorktree(
	branch: string,
	cwd: string,
	signal?: AbortSignal,
): Promise<string> {
	const { stdout, stderr, exitCode } = await execCommand("wt", ["switch", "--create", branch], cwd, signal, 30_000);
	if (exitCode !== 0) {
		throw new Error(`wt switch --create failed (exit ${exitCode}): ${stderr || stdout}`);
	}

	// Discover the worktree path via wt list --format=json
	const listResult = await execCommand("wt", ["list", "--format=json"], cwd, signal, 10_000);
	if (listResult.exitCode !== 0) {
		throw new Error(`wt list failed (exit ${listResult.exitCode}): ${listResult.stderr}`);
	}

	const worktrees: WtWorktreeInfo[] = JSON.parse(listResult.stdout);
	const wt = worktrees.find((w) => w.branch === branch);
	if (!wt) {
		throw new Error(`Created worktree for branch "${branch}" not found in wt list output`);
	}

	return wt.path;
}

async function mergeWorktree(
	worktreePath: string,
	targetBranch: string | undefined,
	noSquash: boolean,
	noVerify: boolean,
	signal?: AbortSignal,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	const args: string[] = ["merge"];
	if (targetBranch) args.push(targetBranch);
	if (noSquash) args.push("--no-squash");
	if (noVerify) args.push("--no-verify");
	args.push("-y"); // Skip approval prompts

	return execCommand("wt", args, worktreePath, signal, 120_000);
}

async function removeWorktree(
	worktreePath: string,
	signal?: AbortSignal,
): Promise<void> {
	const { exitCode, stderr } = await execCommand("wt", ["remove", "--force"], worktreePath, signal, 30_000);
	if (exitCode !== 0) {
		console.log(`[wt-worktree] warning: wt remove failed (exit ${exitCode}): ${stderr}`);
	}
}

// ---------------------------------------------------------------------------
// Subagent runner
// ---------------------------------------------------------------------------

const WORKER_SYSTEM_PROMPT = `You are an implementation agent working in an isolated git worktree. Your task is to implement the changes described below.

Guidelines:
- Make all necessary file changes to complete the task
- Use all available tools — you have extensions and skills available
- Do NOT run git commit — the merge pipeline will handle committing
- Do NOT use the wt_worktree_task tool — you are already inside a worktree task
- Write clean, well-structured code following the project's conventions
- If you encounter errors, fix them before finishing
- When done, provide a clear, concise summary of all changes made as a markdown bullet list

Your changes will be automatically merged back to the default branch after you finish.`;

type SubagentResult = SubagentResultType;

async function runSubagent(
	worktreePath: string,
	task: string,
	model: string | undefined,
	signal: AbortSignal | undefined,
	onUpdate: ((text: string) => void) | undefined,
): Promise<SubagentResult> {
	const resolvedModel = model || getSubagentModel();

	const args: string[] = ["--mode", "json", "-p", "--no-session", "--no-prompt-templates"];
	if (resolvedModel) args.push("--model", resolvedModel);

	let tmpDir: string | null = null;
	let tmpPromptPath: string | null = null;

	const result: SubagentResult = {
		exitCode: 0,
		output: "",
		stderr: "",
		usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
	};

	const emitUpdate = () => {
		onUpdate?.(result.output || "(implementing...)");
	};

	try {
		tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "pi-wt-worktree-"));
		tmpPromptPath = path.join(tmpDir, "system-prompt.md");
		await fs.promises.writeFile(tmpPromptPath, WORKER_SYSTEM_PROMPT, { encoding: "utf-8", mode: 0o600 });
		args.push("--append-system-prompt", tmpPromptPath);
		args.push(`Task: ${task}`);

		let wasAborted = false;

		const exitCode = await new Promise<number>((resolve) => {
			const invocation = getPiInvocation(args);
			console.log(`[wt-worktree] spawning subagent in ${worktreePath}`);
			const proc = spawn(invocation.command, invocation.args, {
				cwd: worktreePath,
				shell: false,
				stdio: ["pipe", "pipe", "pipe"],
				env: { ...process.env, [CHILD_ENV_VAR]: "1" },
			});
			proc.stdin.end();

			const timeout = setTimeout(() => {
				console.log(`[wt-worktree] timeout after ${TIMEOUT_MS}ms`);
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
				result.stderr += data.toString();
			});

			proc.on("close", (code) => {
				clearTimeout(timeout);
				if (buffer.trim()) processLine(buffer);
				console.log(`[wt-worktree] subagent exited with code ${code}`);
				resolve(code ?? 0);
			});

			proc.on("error", () => resolve(1));

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
		if (wasAborted) throw new Error("Subagent was aborted");
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

// ---------------------------------------------------------------------------
// Tool types
// ---------------------------------------------------------------------------

interface TaskDetails {
	branch: string;
	worktreePath: string;
	subagentResult: SubagentResult;
	mergeResult?: { stdout: string; stderr: string; exitCode: number };
	durationMs: number;
	autoMerge: boolean;
}

const TaskParams = Type.Object({
	task: Type.String({ description: "Description of the change to implement in the new worktree" }),
	branch: Type.Optional(Type.String({ description: "Branch name for the worktree (auto-generated if omitted)" })),
	model: Type.Optional(Type.String({ description: "Model for the subagent (defaults to CHEAP_MODEL env var)" })),
	target_branch: Type.Optional(Type.String({ description: "Target branch to merge into (defaults to default branch)" })),
	auto_merge: Type.Optional(Type.Boolean({ description: "Auto-merge after completion. Default: true.", default: true })),
	no_squash: Type.Optional(Type.Boolean({ description: "Preserve individual commits instead of squash-merging. Default: false.", default: false })),
	no_verify: Type.Optional(Type.Boolean({ description: "Skip pre-merge hooks (e.g. tests, lints). Default: false.", default: false })),
});

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
	// Prevent recursive registration in child subagent processes
	if (process.env[CHILD_ENV_VAR] === "1") {
		console.log(`[wt-worktree] child process detected, skipping tool registration`);
		return;
	}

	pi.registerTool({
		name: "wt_worktree_task",
		label: "WT Worktree Task",
		description: [
			"Delegate an implementation task to a subagent in an isolated git worktree.",
			"Creates a new worktree via `wt switch --create`, runs a pi subagent to implement changes,",
			"then merges the worktree back with `wt merge` (squash-merge by default).",
			"The subagent has access to all extensions and skills — only this tool is excluded to prevent recursion.",
			"The subagent uses CHEAP_MODEL by default — set the model parameter to override.",
			"Requires the worktrunk (wt) CLI to be installed and the repo to be wt-enabled.",
		].join(" "),
		promptSnippet: "Delegate implementation to a subagent in an isolated git worktree",
		promptGuidelines: [
			"Use wt_worktree_task to delegate isolated implementation tasks — the subagent works in its own worktree and auto-merges back.",
			"Prefer wt_worktree_task for self-contained changes that don't require interactive review before merging.",
			"The subagent has access to extensions (explore, librarian, etc.) and skills — only the wt_worktree_task tool itself is excluded to prevent recursion.",
			"Provide a clear, specific task description — the subagent has no conversation context beyond the task.",
		],
		parameters: TaskParams,

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const startTime = Date.now();
			const realCwd = resolveRealCwd(ctx.cwd);
			const branch = params.branch || generateBranchName(params.task);
			const autoMerge = params.auto_merge ?? true;
			const noSquash = params.no_squash ?? false;
			const noVerify = params.no_verify ?? false;

			const emitUpdate = (text: string) => {
				onUpdate?.({
					content: [{ type: "text", text }],
					details: { branch, phase: "implementing" },
				});
			};

			let worktreePath: string | undefined;

			try {
				// Step 1: Create worktree
				onUpdate?.({
					content: [{ type: "text", text: `Creating worktree ${branch}...` }],
					details: { branch, phase: "creating" },
				});

				worktreePath = await createWorktree(branch, realCwd, signal);
				console.log(`[wt-worktree] created worktree at ${worktreePath}`);

				// Step 2: Run subagent
				const subagentResult = await runSubagent(worktreePath, params.task, params.model, signal, emitUpdate);

				const durationMs = Date.now() - startTime;

				if (subagentResult.exitCode !== 0) {
					const errorMsg = subagentResult.errorMessage || subagentResult.stderr || subagentResult.output || "(no output)";
					return {
						content: [
							{
								type: "text",
								text: `Subagent failed (exit ${subagentResult.exitCode}): ${errorMsg}\n\nWorktree "${branch}" left at ${worktreePath} for inspection.`,
							},
						],
						details: {
							branch,
							worktreePath,
							subagentResult,
							durationMs,
							autoMerge: false,
						} satisfies TaskDetails,
					};
				}

				// Step 3: Merge (if auto_merge)
				let mergeResult: TaskDetails["mergeResult"];

				if (autoMerge) {
					onUpdate?.({
						content: [{ type: "text", text: `Merging ${branch} back...` }],
						details: { branch, phase: "merging" },
					});

					mergeResult = await mergeWorktree(worktreePath, params.target_branch, noSquash, noVerify, signal);

					if (mergeResult.exitCode !== 0) {
						return {
							content: [
								{
									type: "text",
									text: [
										`Subagent completed but merge failed (exit ${mergeResult.exitCode}).`,
										"",
										`Worktree "${branch}" left at ${worktreePath} for manual resolution.`,
										"",
										"Subagent output:",
										subagentResult.output || "(no output)",
										"",
										"Merge stderr:",
										mergeResult.stderr || "(none)",
									].join("\n"),
								},
							],
							details: {
								branch,
								worktreePath,
								subagentResult,
								mergeResult,
								durationMs,
								autoMerge: true,
							} satisfies TaskDetails,
						};
					}
				}

				const output = subagentResult.output || "(no output)";
				const merged = autoMerge ? "Merged and cleaned up." : `Worktree "${branch}" kept at ${worktreePath}.`;

				return {
					content: [{ type: "text", text: `${output}\n\n${merged}` }],
					details: {
						branch,
						worktreePath,
						subagentResult,
						mergeResult,
						durationMs,
						autoMerge,
					} satisfies TaskDetails,
				};
			} catch (err: any) {
				return {
					content: [
						{
							type: "text",
							text: `Worktree task failed: ${err.message || err}`,
						},
					],
					details: {
						branch,
						worktreePath: worktreePath || "(not created)",
						subagentResult: {
							exitCode: -1,
							output: "",
							stderr: err.message || String(err),
							usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
						},
						durationMs: Date.now() - startTime,
						autoMerge: false,
					} satisfies TaskDetails,
				};
			}
		},

		renderCall(args, theme, context) {
			const branch = args.branch || "(auto)";
			const model = args.model || getSubagentModel() || "default";
			const preview = args.task.length > 80 ? `${args.task.slice(0, 80)}...` : args.task;
			let content =
				theme.fg("toolTitle", theme.bold("wt_worktree_task ")) +
				theme.fg("accent", branch) +
				theme.fg("muted", ` [${model}]`);
			content += `\n  ${theme.fg("dim", preview)}`;
			if (!args.auto_merge && args.auto_merge !== undefined) {
				content += `\n  ${theme.fg("warning", "no auto-merge")}`;
			}
			// Reuse existing component if available to avoid duplicate renders
			const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
			text.setText(content);
			return text;
		},

		renderResult(result, { expanded }, theme, _context) {
			const details = result.details as TaskDetails | undefined;
			const text = result.content[0];
			const output = text?.type === "text" ? text.text : "(no output)";

			const isError = result.isError;
			const icon = isError ? theme.fg("error", "✗") : theme.fg("success", "✓");

			const sub = details?.subagentResult;
			const merge = details?.mergeResult;
			const phase = !sub ? "setup" : sub.exitCode !== 0 ? "implement" : merge && merge.exitCode !== 0 ? "merge" : "done";

			if (expanded) {
				const mdTheme = getMarkdownTheme();
				const container = new Container();

				// Header
				let header = `${icon} ${theme.fg("toolTitle", theme.bold("wt_worktree_task"))}`;
				if (details?.branch) header += ` ${theme.fg("accent", details.branch)}`;
				container.addChild(new Text(header, 0, 0));

				// Phase indicator
				const phaseLabel = { setup: "Setup", implement: "Implementation", merge: "Merge", done: "Complete" }[phase];
				container.addChild(new Text(theme.fg("muted", `Phase: ${phaseLabel}`), 0, 0));

				if (details?.worktreePath) {
					const home = os.homedir();
					const shortPath = details.worktreePath.startsWith(home)
						? `~${details.worktreePath.slice(home.length)}`
						: details.worktreePath;
					container.addChild(new Text(theme.fg("muted", `Worktree: ${shortPath}`), 0, 0));
				}

				container.addChild(new Spacer(1));

				// Subagent output
				if (output) {
					container.addChild(new Markdown(output.trim(), 0, 0, mdTheme));
				}

				// Usage
				if (sub?.usage) {
					const parts: string[] = [];
					if (sub.usage.turns) parts.push(`${sub.usage.turns} turn${sub.usage.turns > 1 ? "s" : ""}`);
					if (sub.usage.input) parts.push(`↑${formatTokens(sub.usage.input)}`);
					if (sub.usage.output) parts.push(`↓${formatTokens(sub.usage.output)}`);
					if (sub.usage.cost) parts.push(`$${sub.usage.cost.toFixed(4)}`);
					if (sub.model) parts.push(sub.model);
					if (details?.durationMs) parts.push(formatDuration(details.durationMs));
					if (parts.length > 0) {
						container.addChild(new Spacer(1));
						container.addChild(new Text(theme.fg("dim", parts.join(" ")), 0, 0));
					}
				}

				// Merge output
				if (merge) {
					container.addChild(new Spacer(1));
					const mergeIcon = merge.exitCode === 0 ? theme.fg("success", "✓") : theme.fg("error", "✗");
					container.addChild(new Text(`${mergeIcon} ${theme.fg("muted", "wt merge")}`, 0, 0));
					if (merge.stdout.trim()) {
						container.addChild(new Text(theme.fg("dim", merge.stdout.trim().split("\n").slice(-5).join("\n")), 0, 0));
					}
					if (merge.exitCode !== 0 && merge.stderr.trim()) {
						container.addChild(new Text(theme.fg("error", merge.stderr.trim().split("\n").slice(-3).join("\n")), 0, 0));
					}
				}

				return container;
			}

			// Collapsed
			const previewLines = output.split("\n").slice(0, 4).join("\n");
			let rendered = `${icon} ${theme.fg("toolTitle", theme.bold("wt_worktree_task"))}`;
			if (details?.branch) rendered += ` ${theme.fg("accent", details.branch)}`;

			if (isError) {
				rendered += `\n${theme.fg("error", previewLines)}`;
			} else {
				rendered += `\n${theme.fg("dim", previewLines)}`;
			}

			// Usage summary
			const usageParts: string[] = [];
			if (sub?.usage?.turns) usageParts.push(`${sub.usage.turns}t`);
			if (sub?.usage?.cost) usageParts.push(`$${sub.usage.cost.toFixed(4)}`);
			if (sub?.model) usageParts.push(sub.model);
			if (details?.durationMs) usageParts.push(formatDuration(details.durationMs));
			if (usageParts.length > 0) {
				rendered += `\n${theme.fg("dim", usageParts.join(" "))}`;
			}

			rendered += `\n${theme.fg("muted", "(Ctrl+O to expand)")}`;
			return new Text(rendered, 0, 0);
		},
	});
}
