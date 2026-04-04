/**
 * Parse markdown output into `## Title` sections.
 *
 * Each section has a `title` (the heading text) and `content` (everything
 * after the heading, trimmed). Sections without body content get an empty
 * string.
 */
export function parseSections(output: string): { title: string; content: string }[] {
	const sections: { title: string; content: string }[] = [];
	const parts = output.split(/^## /m);
	for (const part of parts) {
		const newlineIdx = part.indexOf("\n");
		if (newlineIdx === -1) {
			const title = part.trim();
			if (title) sections.push({ title, content: "" });
			continue;
		}
		const title = part.slice(0, newlineIdx).trim();
		const content = part.slice(newlineIdx + 1).trim();
		if (title) sections.push({ title, content });
	}
	return sections;
}

/**
 * Get a one-line summary from section content.
 *
 * Returns the first non-blank line, truncated to `maxLen` characters with "…"
 * if it exceeds the limit.
 */
export function getSectionSummary(content: string, maxLen = 100): string {
	const firstLine = content.split("\n").find((l) => l.trim())?.trim() ?? "";
	if (firstLine.length <= maxLen) return firstLine;
	return firstLine.slice(0, maxLen - 1) + "…";
}
