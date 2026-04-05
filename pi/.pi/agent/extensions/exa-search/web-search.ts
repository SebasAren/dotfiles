/**
 * Web search tool — schema, types, and execute logic.
 */

import Exa from "exa-js";
import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	truncateHead,
} from "@mariozechner/pi-coding-agent";

// ── Types ──────────────────────────────────────────────────────────────────

export interface SearchResult {
	title: string | null;
	url: string;
	score?: number;
	highlights?: string[];
	publishedDate?: string;
	author?: string;
}

export interface WebSearchDetails {
	query: string;
	resultCount: number;
	truncated: boolean;
	totalResults?: number;
	searchType?: string;
}

// ── Schema ─────────────────────────────────────────────────────────────────

import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";

export const WebSearchParams = Type.Object({
	query: Type.String({ description: "Search query" }),
	numResults: Type.Optional(
		Type.Number({
			description: "Number of results to return (default: 10, max: 20)",
			minimum: 1,
			maximum: 20,
		}),
	),
	type: Type.Optional(
		StringEnum(["auto", "keyword", "neural", "fast", "deep"], {
			description:
				"Search type: auto (balanced), keyword (exact match), neural (semantic), fast (realtime), deep (thorough research)",
		}),
	),
	includeDomains: Type.Optional(
		Type.Array(Type.String(), {
			description: "Only search these domains (e.g., ['github.com', 'arxiv.org'])",
		}),
	),
	excludeDomains: Type.Optional(
		Type.Array(Type.String(), {
			description: "Exclude these domains from results",
		}),
	),
	category: Type.Optional(
		StringEnum(
			[
				"company",
				"research paper",
				"news",
				"tweet",
				"personal site",
				"linkedin profile",
				"github",
				"financial report",
			],
			{
				description: "Filter by content category",
			},
		),
	),
	maxAgeHours: Type.Optional(
		Type.Number({
			description:
				"Max age of content in hours. Use 0 for always fresh, 24 for daily freshness, omit for default.",
		}),
	),
	includeContents: Type.Optional(
		Type.Boolean({
			description:
				"Whether to include page contents/highlights (default: true). Increases token usage.",
		}),
	),
	highlightsMaxChars: Type.Optional(
		Type.Number({
			description: "Max characters for highlights per result (default: 4000)",
		}),
	),
});

// ── Execute ────────────────────────────────────────────────────────────────

export async function executeWebSearch(
	params: {
		query: string;
		numResults?: number;
		type?: string;
		includeDomains?: string[];
		excludeDomains?: string[];
		category?: string;
		maxAgeHours?: number;
		includeContents?: boolean;
		highlightsMaxChars?: number;
	},
	exa: Exa,
	signal?: AbortSignal,
	onUpdate?: (update: { content: Array<{ type: string; text: string }>; details: WebSearchDetails }) => void,
) {
	const {
		query,
		numResults = 10,
		type = "auto",
		includeDomains,
		excludeDomains,
		category,
		maxAgeHours,
		includeContents = true,
		highlightsMaxChars = 4000,
	} = params;

	// Show initial progress
	onUpdate?.({
		content: [{ type: "text", text: `Searching: "${query}"...` }],
		details: { query, resultCount: 0, truncated: false },
	});

	try {
		// Build search options
		const searchOptions: Record<string, unknown> = {
			type,
			numResults: Math.min(numResults, 20),
		};

		if (includeDomains?.length) searchOptions.includeDomains = includeDomains;
		if (excludeDomains?.length) searchOptions.excludeDomains = excludeDomains;
		if (category) searchOptions.category = category;
		if (maxAgeHours !== undefined) searchOptions.maxAgeHours = maxAgeHours;

		// Decide whether to include contents
		let results: Array<{
			title: string | null;
			url: string;
			score?: number;
			highlights?: string[];
			publishedDate?: string;
			author?: string;
			text?: string;
		}>;

		if (includeContents) {
			// Use searchAndContents for highlights
			const response = await exa.searchAndContents(query, {
				...searchOptions,
				highlights: { numSentences: Math.ceil(highlightsMaxChars / 200), highlightsPerUrl: 3 },
			});
			results = response.results;
		} else {
			// Just search without contents (faster, fewer tokens)
			const response = await exa.search(query, searchOptions);
			results = response.results;
		}

		// Check for cancellation
		if (signal?.aborted) {
			return {
				content: [{ type: "text", text: "Search cancelled" }],
				details: { query, resultCount: 0, truncated: false },
			};
		}

		if (!results.length) {
			return {
				content: [{ type: "text", text: `No results found for: "${query}"` }],
				details: { query, resultCount: 0, truncated: false, searchType: type },
			};
		}

		// Format results
		const searchResults: SearchResult[] = results.map((r) => ({
			title: r.title || "Untitled",
			url: r.url,
			score: r.score,
			highlights: r.highlights,
			publishedDate: r.publishedDate,
			author: r.author,
		}));

		// Build output text
		let output = `## Search Results for: "${query}"\n\n`;

		for (let i = 0; i < searchResults.length; i++) {
			const result = searchResults[i];
			output += `### ${i + 1}. ${result.title}\n`;
			output += `URL: ${result.url}\n`;
			if (result.publishedDate) {
				output += `Published: ${result.publishedDate}\n`;
			}
			if (result.author) {
				output += `Author: ${result.author}\n`;
			}
			if (result.score !== undefined) {
				output += `Relevance: ${(result.score * 100).toFixed(1)}%\n`;
			}
			if (result.highlights?.length) {
				output += `\nHighlights:\n${result.highlights.join("\n")}\n`;
			}
			output += "\n";
		}

		// Apply truncation
		const truncation = truncateHead(output, {
			maxLines: DEFAULT_MAX_LINES,
			maxBytes: DEFAULT_MAX_BYTES,
		});

		let finalOutput = truncation.content;

		if (truncation.truncated) {
			finalOutput += `\n\n[Results truncated: showing partial results of ${searchResults.length} total.`;
			finalOutput += ` Use more specific query or reduce numResults for complete results.]`;
		}

		const details: WebSearchDetails = {
			query,
			resultCount: searchResults.length,
			truncated: truncation.truncated,
			totalResults: searchResults.length,
			searchType: type,
		};

		return {
			content: [{ type: "text", text: finalOutput }],
			details,
		};
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		throw new Error(`Exa search failed: ${errorMessage}`);
	}
}
