/**
 * Exa Web Search Extension
 *
 * Provides web search capabilities using the Exa API.
 * Search type: auto (balanced relevance and speed)
 * Content: highlights (compact, token-efficient)
 */

import Exa from "exa-js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	formatSize,
	truncateHead,
} from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";

// Search parameters schema
const WebSearchParams = Type.Object({
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

interface SearchResult {
	title: string | null;
	url: string;
	score?: number;
	highlights?: string[];
	publishedDate?: string;
	author?: string;
}

interface WebSearchDetails {
	query: string;
	resultCount: number;
	truncated: boolean;
	totalResults?: number;
	searchType?: string;
}

// Fetch parameters schema
const WebFetchParams = Type.Object({
	urls: Type.Array(Type.String(), {
		description: "URLs to fetch parsed content from (1-5 URLs)",
		minItems: 1,
		maxItems: 5,
	}),
	format: Type.Optional(
		StringEnum(["text", "highlights", "summary"], {
			description:
				"Content format: text (full parsed page), highlights (key excerpts), summary (LLM-generated abstract). Default: text",
		}),
	),
	query: Type.Optional(
		Type.String({
			description:
				"Query to focus content extraction. Used by 'highlights' and 'summary' modes to find relevant passages.",
		}),
	),
	maxCharacters: Type.Optional(
		Type.Number({
			description: "Max characters per URL (default: 10000). Controls token usage and cost.",
		}),
	),
});

interface WebFetchDetails {
	urls: string[];
	format: string;
	successCount: number;
	errorCount: number;
	truncated: boolean;
}

export default function (pi: ExtensionAPI) {
	// Get API key from environment
	const apiKey = process.env.EXA_API_KEY;
	if (!apiKey) {
		console.warn(
			"[exa-search] EXA_API_KEY not set. Web search tool will not work. Set it via: export EXA_API_KEY='your-key'",
		);
	}

	const exa = apiKey ? new Exa(apiKey) : null;

	pi.registerTool({
		name: "web_search",
		label: "Web Search",
		description:
			"Search the web using Exa. Returns relevant results with titles, URLs, and highlights. " +
			"Great for finding current information, documentation, news, and research.",
		promptSnippet: "Search the web for current information using Exa",
		promptGuidelines: [
			"Use this tool when you need current information not in your training data",
			"Use for finding documentation, tutorials, API references, and best practices",
			"Use to verify facts or get the latest news and developments",
			"Use 'category' filter when searching for specific content types (news, research papers, etc.)",
		],
		parameters: WebSearchParams,

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			if (!exa) {
				throw new Error(
					"EXA_API_KEY not set. Please set it via: export EXA_API_KEY='your-key'",
				);
			}

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
		},

		// Custom rendering of the tool call
		renderCall(args, theme, context) {
			let content = theme.fg("toolTitle", theme.bold("web_search "));
			content += theme.fg("accent", `"${args.query}"`);
			if (args.type && args.type !== "auto") {
				content += theme.fg("muted", ` [${args.type}]`);
			}
			if (args.category) {
				content += theme.fg("dim", ` (${args.category})`);
			}
			// Reuse existing component if available to avoid duplicate renders
			const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
			text.setText(content);
			return text;
		},

		// Custom rendering of the tool result
		renderResult(result, { expanded, isPartial }, theme, _context) {
			// Handle streaming/partial results
			if (isPartial) {
				return new Text(theme.fg("warning", "Searching the web..."), 0, 0);
			}

			const details = result.details as WebSearchDetails | undefined;

			// Error state
			if (!details) {
				const content = result.content[0];
				if (content?.type === "text") {
					return new Text(theme.fg("error", content.text.slice(0, 100)), 0, 0);
				}
				return new Text(theme.fg("error", "Search failed"), 0, 0);
			}

			// No results
			if (details.resultCount === 0) {
				return new Text(
					theme.fg("dim", `No results for "${details.query}"`),
					0,
					0,
				);
			}

			// Build compact display
			let text = theme.fg("success", `${details.resultCount} results`);
			text += theme.fg("dim", ` for "${details.query}"`);

			if (details.truncated) {
				text += theme.fg("warning", " (truncated)");
			}

			// In expanded view, show result titles and URLs
			if (expanded) {
				const content = result.content[0];
				if (content?.type === "text") {
					const lines = content.text.split("\n");
					// Extract just the titles and URLs (lines starting with ### or URL:)
					const relevantLines = lines.filter(
						(line) =>
							line.startsWith("### ") ||
							line.startsWith("URL: ") ||
							line.startsWith("Published: "),
					);
					for (const line of relevantLines.slice(0, 30)) {
						if (line.startsWith("### ")) {
							text += `\n${theme.fg("accent", line)}`;
						} else if (line.startsWith("URL: ")) {
							text += `\n${theme.fg("dim", line)}`;
						} else {
							text += `\n${theme.fg("muted", line)}`;
						}
					}
					if (relevantLines.length > 30) {
						text += `\n${theme.fg("muted", "... (more results)")}`;
					}
				}
			}

			return new Text(text, 0, 0);
		},
	});

	// ── web_fetch tool ──────────────────────────────────────────────────────

	pi.registerTool({
		name: "web_fetch",
		label: "Web Fetch",
		description:
			"Fetch and parse web page content from URLs. Returns clean, LLM-ready content " +
			"(text, highlights, or summary). Use after web_search to read specific pages in detail, " +
			"or to fetch a known documentation URL directly.",
		promptSnippet: "Fetch and parse web page content from URLs",
		promptGuidelines: [
			"Use web_fetch after web_search to read the full content of relevant results",
			"Use web_fetch when you need detailed page content, not just search highlights",
			"Use 'highlights' format with a query for the most token-efficient extraction",
			"Use 'summary' format for quick overviews of long pages",
		],
		parameters: WebFetchParams,

		async execute(_toolCallId, params, signal, onUpdate, _ctx) {
			if (!exa) {
				throw new Error(
					"EXA_API_KEY not set. Please set it via: export EXA_API_KEY='your-key'",
				);
			}

			const {
				urls,
				format = "text",
				query,
				maxCharacters = 10000,
			} = params;

			const urlList = urls.slice(0, 5);
			onUpdate?.({
				content: [{ type: "text", text: `Fetching ${urlList.length} page(s)...` }],
				details: { urls: urlList, format, successCount: 0, errorCount: 0, truncated: false },
			});

			try {
				// Build content options based on format — cast to avoid generic inference issues
				// since format is dynamic and TypeScript can't resolve ContentsResultComponent
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const contentOptions: any = {};

				if (format === "text") {
					contentOptions.text = { maxCharacters };
				} else if (format === "highlights") {
					contentOptions.highlights = {
						query: query ?? "",
						numSentences: Math.ceil(maxCharacters / 200),
						highlightsPerUrl: 5,
					};
				} else if (format === "summary") {
					contentOptions.summary = {
						query: query ?? "",
					};
				}

				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const response: any = await exa.getContents(urlList, contentOptions);

				if (signal?.aborted) {
					return {
						content: [{ type: "text", text: "Fetch cancelled" }],
						details: { urls: urlList, format, successCount: 0, errorCount: 0, truncated: false },
					};
				}

				// Build error map from statuses — Status type lacks error field in types but API returns it
				const errorMap = new Map<string, string>();
				if (response.statuses) {
					for (const s of response.statuses) {
						if (s.status === "error") {
							errorMap.set(s.id, s.error?.tag || "unknown error");
						}
					}
				}

				// Format output
				let output = "";
				let successCount = 0;
				let errorCount = 0;

				for (const result of response.results) {
					const error = errorMap.get(result.id);
					if (error) {
						errorCount++;
						output += `## ${result.title ?? "Untitled"}\n`;
						output += `URL: ${result.url}\n`;
						output += `**Error: ${error}**\n\n`;
						continue;
					}

					successCount++;
					output += `## ${result.title ?? "Untitled"}\n`;
					output += `URL: ${result.url}\n`;
					if (result.publishedDate) output += `Published: ${result.publishedDate}\n`;
					if (result.author) output += `Author: ${result.author}\n`;
					output += "\n";

					if (format === "text" && result.text) {
						output += result.text;
					} else if (format === "highlights" && result.highlights?.length) {
						output += result.highlights.join("\n\n");
					} else if (format === "summary" && result.summary) {
						output += result.summary;
					} else {
						output += "(no content available)";
					}
					output += "\n\n";
				}

				// Apply truncation
				const truncation = truncateHead(output, {
					maxLines: DEFAULT_MAX_LINES,
					maxBytes: DEFAULT_MAX_BYTES,
				});

				let finalOutput = truncation.content;
				if (truncation.truncated) {
					finalOutput += `\n\n[Content truncated. Reduce maxCharacters or fetch fewer URLs for complete results.]`;
				}

				return {
					content: [{ type: "text", text: finalOutput }],
					details: {
						urls: urlList,
						format,
						successCount,
						errorCount,
						truncated: truncation.truncated,
					} satisfies WebFetchDetails,
				};
			} catch (error: unknown) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				throw new Error(`Exa getContents failed: ${errorMessage}`);
			}
		},

		renderCall(args, theme, context) {
			const urlCount = args.urls?.length ?? 0;
			const first = args.urls?.[0] ?? "";
			const display =
				urlCount === 1
					? first.length > 60
						? `${first.slice(0, 57)}...`
						: first
					: `${urlCount} URLs`;
			let content =
				theme.fg("toolTitle", theme.bold("web_fetch ")) +
				theme.fg("accent", display);
			if (args.format && args.format !== "text") {
				content += theme.fg("muted", ` [${args.format}]`);
			}
			const text =
				(context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
			text.setText(content);
			return text;
		},

		renderResult(result, { expanded, isPartial }, theme, _context) {
			if (isPartial) {
				return new Text(theme.fg("warning", "Fetching pages..."), 0, 0);
			}

			const details = result.details as WebFetchDetails | undefined;

			if (!details) {
				const content = result.content[0];
				if (content?.type === "text") {
					return new Text(theme.fg("error", content.text.slice(0, 100)), 0, 0);
				}
				return new Text(theme.fg("error", "Fetch failed"), 0, 0);
			}

			const icon =
				details.errorCount > 0 && details.successCount === 0
					? theme.fg("error", "✗")
					: theme.fg("success", "✓");

			let text = `${icon} ${theme.fg("toolTitle", theme.bold("web_fetch"))}`;
			text += theme.fg(
				"dim",
				` ${details.successCount}/${details.urls.length} fetched`,
			);
			if (details.errorCount > 0) {
				text += theme.fg("error", ` (${details.errorCount} failed)`);
			}
			if (details.truncated) {
				text += theme.fg("warning", " (truncated)");
			}

			if (expanded) {
				const content = result.content[0];
				if (content?.type === "text") {
					const lines = content.text.split("\n");
					const relevantLines = lines.filter(
						(line) =>
							line.startsWith("## ") || line.startsWith("URL: "),
					);
					for (const line of relevantLines) {
						if (line.startsWith("## ")) {
							text += `\n${theme.fg("accent", line)}`;
						} else {
							text += `\n${theme.fg("dim", line)}`;
						}
					}
				}
			}

			return new Text(text, 0, 0);
		},
	});

	// Register a quick search command
	pi.registerCommand("search", {
		description: "Quick web search using Exa",
		handler: async (args, ctx) => {
			if (!args) {
				ctx.ui.notify("Usage: /search <query>", "warning");
				return;
			}
			pi.sendUserMessage(`Search the web for: ${args}`, { deliverAs: "followUp" });
		},
	});
}
