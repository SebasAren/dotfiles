/**
 * Format a token count as a human-readable string.
 *
 * - < 1000 → raw number (e.g. "500")
 * - 1000–9999 → one decimal + "k" (e.g. "1.5k")
 * - 10000–999999 → rounded whole + "k" (e.g. "500k")
 * - ≥ 1000000 → one decimal + "M" (e.g. "1.5M")
 */
export function formatTokens(count: number): string {
	if (count < 1000) return count.toString();
	if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
	if (count < 1000000) return `${Math.round(count / 1000)}k`;
	return `${(count / 1000000).toFixed(1)}M`;
}

/**
 * Format usage stats as a compact string.
 *
 * Example: "4 turns ↑5k ↓2k $0.0300 codestral"
 */
export function formatUsageLine(
	usage: { input: number; output: number; turns: number; cost: number },
	usedModel?: string,
): string {
	const parts: string[] = [];
	if (usage.turns) parts.push(`${usage.turns} turn${usage.turns > 1 ? "s" : ""}`);
	if (usage.input) parts.push(`↑${formatTokens(usage.input)}`);
	if (usage.output) parts.push(`↓${formatTokens(usage.output)}`);
	if (usage.cost) parts.push(`$${usage.cost.toFixed(4)}`);
	if (usedModel) parts.push(usedModel);
	return parts.join(" ");
}
