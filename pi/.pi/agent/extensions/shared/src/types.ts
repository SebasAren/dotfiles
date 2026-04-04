/** Token and cost usage statistics from a subagent run. */
export interface UsageStats {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
	contextTokens: number;
	turns: number;
}

/** Result from a subagent subprocess (explore, librarian, wt-worktree). */
export interface SubagentResult {
	exitCode: number;
	output: string;
	stderr: string;
	usage: UsageStats;
	model?: string;
	errorMessage?: string;
}

/**
 * Merge two UsageStats by summing all fields.
 * Useful for accumulating usage across multiple subagent calls.
 */
export function extendUsage(base: UsageStats, extra: UsageStats): UsageStats {
	return {
		input: base.input + extra.input,
		output: base.output + extra.output,
		cacheRead: base.cacheRead + extra.cacheRead,
		cacheWrite: base.cacheWrite + extra.cacheWrite,
		cost: base.cost + extra.cost,
		contextTokens: base.contextTokens + extra.contextTokens,
		turns: base.turns + extra.turns,
	};
}
