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

import { type ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

import {
	resolveRealCwd,
	getModel,
	runSubagent,
	type SubagentResult as SubagentResultType,
} from "@pi-ext/shared";

import { generateBranchName, createWorktree, mergeWorktree, removeWorktree, formatDuration } from "./wt-cli";
import { renderCall, renderResult } from "./render";

// Re-export for backward compatibility and test imports
export { generateBranchName, formatDuration } from "./wt-cli";

// ---------------------------------------------------------------------------
// Subagent configuration
// ---------------------------------------------------------------------------

/** Env var set on child processes to prevent recursive wt_worktree_task registration */
const CHILD_ENV_VAR = "WT_WORKTREE_CHILD";

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

// ---------------------------------------------------------------------------
// Tool types
// ---------------------------------------------------------------------------

export interface TaskDetails {
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
				const subagentResult = await runSubagent({
					cwd: worktreePath,
					query: `Task: ${params.task}`,
					systemPrompt: WORKER_SYSTEM_PROMPT,
					baseFlags: ["--no-session", "--no-prompt-templates"],
					timeoutMs: 600_000,
					signal,
					onUpdate: emitUpdate,
					env: { [CHILD_ENV_VAR]: "1" },
					debugLabel: "wt-worktree",
					...(params.model ? { model: params.model } : {}),
				});

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
			return renderCall(args, theme, context, args.model || getModel());
		},

		renderResult(result, state, theme, _context) {
			return renderResult(result, state, theme);
		},
	});
}
