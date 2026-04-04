/**
 * Get the model to use for subagent subprocesses.
 * Reads from CHEAP_MODEL environment variable.
 * Falls back to the default model if not set.
 */
export function getModel(): string | undefined {
	const env = process.env.CHEAP_MODEL;
	if (env) return env;
	return undefined;
}
