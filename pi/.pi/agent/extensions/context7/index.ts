/**
 * Context7 API Extension
 *
 * Provides library documentation lookup using Context7 API.
 * Tools:
 * - context7_search: Search for libraries by name and query
 * - context7_docs: Get documentation for a specific library ID
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import {
  Context7,
  Context7Error,
  type Library,
  type Documentation,
} from "@upstash/context7-sdk";

// Search parameters schema
const SearchParams = Type.Object({
  libraryName: Type.String({ description: "Library name to search for (e.g., 'react', 'next.js')" }),
  query: Type.String({ description: "Your question or task (used for relevance ranking)" }),
});

// Get docs parameters schema
const DocsParams = Type.Object({
  libraryId: Type.String({ description: "Context7-compatible library ID (e.g., '/facebook/react', '/vercel/next.js')" }),
  query: Type.String({ description: "Your question or task (used for relevance ranking)" }),
  type: Type.Optional(StringEnum(["json", "txt"] as const, { description: "Response type: 'json' or 'txt' (default: 'txt')" })),
});

interface SearchDetails {
  query: string;
  libraryName: string;
  resultCount: number;
}

interface DocsDetails {
  libraryId: string;
  query: string;
  snippetCount: number;
}

// Lazy-initialized SDK client — created only when API key is available
let _client: Context7 | null = null;

function getClient(): Context7 {
  if (!_client) {
    _client = new Context7();
  }
  return _client;
}

export default function (pi: ExtensionAPI) {
  // Get API key from environment (captured at init for warning)
  const apiKey = process.env.CONTEXT7_API_KEY;
  if (!apiKey) {
    console.warn(
      "[context7] CONTEXT7_API_KEY not set. Context7 tools will not work. Get your API key at context7.com/dashboard",
    );
  }

  // Tool 1: Search libraries
  pi.registerTool({
    name: "context7_search",
    label: "Context7 Library Search",
    description:
      "Search for libraries in the Context7 database. Returns matching libraries with IDs, descriptions, and trust scores. " +
      "Use this to find the correct library ID before fetching documentation.",
    promptSnippet: "Search Context7 for library documentation",
    promptGuidelines: [
      "Use this tool to find library IDs when you need up-to-date documentation",
      "Provide a library name (e.g., 'react', 'next.js') and a query describing what you need",
      "Returns library IDs that can be used with context7_docs tool",
    ],
    parameters: SearchParams,

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      if (!apiKey) {
        throw new Error(
          "CONTEXT7_API_KEY not set. Get your API key at context7.com/dashboard and set it via: export CONTEXT7_API_KEY='your-key'",
        );
      }

      const { libraryName, query } = params;

      // Show initial progress
      onUpdate?.({
        content: [{ type: "text", text: `Searching Context7 for "${libraryName}"...` }],
        details: { query, libraryName, resultCount: 0 },
      });

      try {
        const client = getClient();
        const libraries: Library[] = await client.searchLibrary(query, libraryName);

        // Check for cancellation
        if (signal?.aborted) {
          return {
            content: [{ type: "text", text: "Search cancelled" }],
            details: { query, libraryName, resultCount: 0 },
          };
        }

        if (!libraries.length) {
          return {
            content: [{ type: "text", text: `No libraries found matching "${libraryName}". Try a different search term.` }],
            details: { query, libraryName, resultCount: 0 },
          };
        }

        // Format results
        let output = `## Context7 Library Search Results for "${libraryName}"\n\n`;

        for (let i = 0; i < libraries.length; i++) {
          const lib = libraries[i];
          output += `### ${i + 1}. ${lib.name}\n`;
          output += `- **ID**: \`${lib.id}\`\n`;
          output += `- **Description**: ${lib.description}\n`;
          output += `- **Snippets**: ${lib.totalSnippets}\n`;
          output += `- **Trust Score**: ${(lib.trustScore * 100).toFixed(1)}%\n`;
          if (lib.versions?.length) {
            output += `- **Versions**: ${lib.versions.slice(0, 5).join(", ")}${lib.versions.length > 5 ? "..." : ""}\n`;
          }
          output += "\n";
        }

        output += `\nUse the library ID with the \`context7_docs\` tool to fetch documentation.`;

        const details: SearchDetails = {
          query,
          libraryName,
          resultCount: libraries.length,
        };

        return {
          content: [{ type: "text", text: output }],
          details,
        };
      } catch (error: unknown) {
        if (error instanceof Context7Error) {
          throw new Error(`Context7 search failed: ${error.message}`);
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Context7 search failed: ${errorMessage}`);
      }
    },

    // Custom rendering of the tool call
    renderCall(args, theme, _context) {
      let text = theme.fg("toolTitle", theme.bold("context7_search "));
      text += theme.fg("accent", `"${args.libraryName}"`);
      text += theme.fg("dim", ` for "${args.query}"`);
      return new Text(text, 0, 0);
    },

    // Custom rendering of the tool result
    renderResult(result, { expanded, isPartial }, theme, _context) {
      if (isPartial) {
        return new Text(theme.fg("warning", "Searching Context7..."), 0, 0);
      }

      const details = result.details as SearchDetails | undefined;

      if (!details) {
        const content = result.content[0];
        if (content?.type === "text") {
          return new Text(theme.fg("error", content.text.slice(0, 100)), 0, 0);
        }
        return new Text(theme.fg("error", "Context7 search failed"), 0, 0);
      }

      if (details.resultCount === 0) {
        return new Text(
          theme.fg("dim", `No libraries found for "${details.libraryName}"`),
          0,
          0,
        );
      }

      let text = theme.fg("success", `${details.resultCount} libraries`);
      text += theme.fg("dim", ` for "${details.libraryName}"`);

      if (expanded) {
        const content = result.content[0];
        if (content?.type === "text") {
          const lines = content.text.split("\n");
          const relevantLines = lines.filter(
            (line) => line.startsWith("### ") || line.startsWith("- **ID**:"),
          );
          for (const line of relevantLines.slice(0, 20)) {
            if (line.startsWith("### ")) {
              text += `\n${theme.fg("accent", line)}`;
            } else {
              text += `\n${theme.fg("dim", line)}`;
            }
          }
          if (relevantLines.length > 20) {
            text += `\n${theme.fg("muted", "... (more results)")}`;
          }
        }
      }

      return new Text(text, 0, 0);
    },
  });

  // Tool 2: Get documentation
  pi.registerTool({
    name: "context7_docs",
    label: "Context7 Documentation",
    description:
      "Fetch up-to-date documentation and code examples for a specific library using its Context7 library ID. " +
      "Returns relevant snippets ranked by the query. You must first use context7_search to obtain a valid library ID.",
    promptSnippet: "Fetch library documentation from Context7",
    promptGuidelines: [
      "Use this tool after obtaining a library ID from context7_search",
      "Provide a library ID (e.g., '/facebook/react') and a query describing what you need",
      "Returns documentation snippets and code examples",
    ],
    parameters: DocsParams,

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      if (!apiKey) {
        throw new Error(
          "CONTEXT7_API_KEY not set. Get your API key at context7.com/dashboard and set it via: export CONTEXT7_API_KEY='your-key'",
        );
      }

      const { libraryId, query, type = "txt" } = params;

      // Show initial progress
      onUpdate?.({
        content: [{ type: "text", text: `Fetching documentation for ${libraryId}...` }],
        details: { libraryId, query, snippetCount: 0 },
      });

      try {
        const client = getClient();
        let output: string;
        let snippetCount = 0;

        if (type === "txt") {
          output = await client.getContext(query, libraryId, { type: "txt" });
          // Estimate snippet count by counting code blocks
          snippetCount = (output.match(/```/g) || []).length / 2;
        } else {
          const docs: Documentation[] = await client.getContext(query, libraryId);
          snippetCount = docs.length;

          if (snippetCount === 0) {
            return {
              content: [{ type: "text", text: `No documentation found for library "${libraryId}" with query "${query}".` }],
              details: { libraryId, query, snippetCount: 0 },
            };
          }

          // Format JSON response
          output = `## Context7 Documentation for ${libraryId}\n\n`;
          output += `**Query**: ${query}\n\n`;

          for (let i = 0; i < docs.length; i++) {
            const doc = docs[i];
            output += `### ${doc.title || `Snippet ${i + 1}`}\n`;
            if (doc.source) {
              output += `**Source**: ${doc.source}\n`;
            }
            output += `${doc.content}\n\n`;
          }
        }

        // Check for cancellation
        if (signal?.aborted) {
          return {
            content: [{ type: "text", text: "Documentation fetch cancelled" }],
            details: { libraryId, query, snippetCount: 0 },
          };
        }

        const details: DocsDetails = {
          libraryId,
          query,
          snippetCount,
        };

        return {
          content: [{ type: "text", text: output }],
          details,
        };
      } catch (error: unknown) {
        if (error instanceof Context7Error) {
          throw new Error(`Context7 documentation fetch failed: ${error.message}`);
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Context7 documentation fetch failed: ${errorMessage}`);
      }
    },

    // Custom rendering of the tool call
    renderCall(args, theme, _context) {
      let text = theme.fg("toolTitle", theme.bold("context7_docs "));
      text += theme.fg("accent", `${args.libraryId}`);
      text += theme.fg("dim", ` for "${args.query}"`);
      return new Text(text, 0, 0);
    },

    // Custom rendering of the tool result
    renderResult(result, { expanded, isPartial }, theme, _context) {
      if (isPartial) {
        return new Text(theme.fg("warning", "Fetching documentation..."), 0, 0);
      }

      const details = result.details as DocsDetails | undefined;

      if (!details) {
        const content = result.content[0];
        if (content?.type === "text") {
          return new Text(theme.fg("error", content.text.slice(0, 100)), 0, 0);
        }
        return new Text(theme.fg("error", "Context7 docs failed"), 0, 0);
      }

      if (details.snippetCount === 0) {
        return new Text(
          theme.fg("dim", `No docs for "${details.libraryId}"`),
          0,
          0,
        );
      }

      let text = theme.fg("success", `${details.snippetCount} snippets`);
      text += theme.fg("dim", ` for ${details.libraryId}`);

      if (expanded) {
        const content = result.content[0];
        if (content?.type === "text") {
          const lines = content.text.split("\n");
          const relevantLines = lines.filter(
            (line) => line.startsWith("### ") || line.startsWith("```"),
          );
          for (const line of relevantLines.slice(0, 15)) {
            if (line.startsWith("### ")) {
              text += `\n${theme.fg("accent", line)}`;
            } else if (line.startsWith("```")) {
              text += `\n${theme.fg("muted", line)}`;
            }
          }
          if (relevantLines.length > 15) {
            text += `\n${theme.fg("muted", "... (more snippets)")}`;
          }
        }
      }

      return new Text(text, 0, 0);
    },
  });

  // Register a quick command for documentation lookup
  pi.registerCommand("context7", {
    description: "Quick Context7 documentation lookup (library query)",
    handler: async (args, ctx) => {
      if (!args) {
        ctx.ui.notify("Usage: /context7 <library> <query>", "warning");
        return;
      }
      const parts = args.split(/\s+/);
      if (parts.length < 2) {
        ctx.ui.notify("Usage: /context7 <library> <query>", "warning");
        return;
      }
      const library = parts[0];
      const query = parts.slice(1).join(" ");
      pi.sendUserMessage(`Search Context7 for library "${library}" and get docs about: ${query}`, { deliverAs: "followUp" });
    },
  });
}
