/**
 * Wiki Search Extension
 *
 * Provides semantic and hybrid search over the personal wiki at ~/Documents/wiki/.
 * Wraps the wiki-search CLI tool (BM25 + vector embeddings + rerank).
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { spawnSync } from "node:child_process";

import { renderSearchCall, renderSearchResult } from "./render";

// ── Types ──────────────────────────────────────────────────────────────────

export interface WikiSearchDetails {
  query: string;
  resultCount: number;
  reranked: boolean;
  semantic: boolean;
  wikiDir: string;
  paths: string[];
}

// ── Schema ─────────────────────────────────────────────────────────────────

export const WikiSearchParams = Type.Object({
  query: Type.String({
    description:
      "Search query. Use specific wiki terminology (e.g. 'agent swarm' not 'multi-agent AI').",
  }),
  top: Type.Optional(
    Type.Number({
      description: "Number of results to return (default: 5)",
      minimum: 1,
      maximum: 20,
    }),
  ),
  context: Type.Optional(
    Type.Number({
      description: "Context lines around matches (default: 3)",
      minimum: 0,
      maximum: 10,
    }),
  ),
  semantic: Type.Optional(
    Type.Boolean({
      description:
        "Use vector-only semantic search instead of hybrid BM25+vector. Slower but better for conceptual queries.",
    }),
  ),
  no_rerank: Type.Optional(
    Type.Boolean({
      description: "Skip Cohere reranking. Faster but lower result quality.",
    }),
  ),
});

// ── Execute ────────────────────────────────────────────────────────────────

export async function executeWikiSearch(
  params: {
    query: string;
    top?: number;
    context?: number;
    semantic?: boolean;
    no_rerank?: boolean;
  },
  binaryPath = "wiki-search",
) {
  const { query, top = 5, context = 3, semantic = false, no_rerank = false } = params;

  const args = [query, "--top", String(top), "--context", String(context)];
  if (semantic) args.push("--semantic");
  if (no_rerank) args.push("--no-rerank");

  const result = spawnSync(binaryPath, args, {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024, // 10 MB
    timeout: 30_000,
    env: { ...process.env },
  });

  if (result.error) {
    throw new Error(`wiki-search failed to spawn: ${result.error.message}`);
  }

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";

  if (result.status !== 0) {
    const msg = stderr.trim() || stdout.trim() || `exit code ${result.status}`;
    throw new Error(`wiki-search failed: ${msg}`);
  }

  const wikiDir = `${process.env.HOME}/Documents/wiki/wiki`;

  // Parse relative paths from result headers like "─── entities/humanlayer.md (score: 0.956) ───"
  const paths: string[] = [];
  for (const line of stdout.split("\n")) {
    const m = line.match(/^─── ([^\s(]+)/);
    if (m) {
      paths.push(`${wikiDir}/${m[1]}`);
    }
  }

  const details: WikiSearchDetails = {
    query,
    resultCount: paths.length,
    reranked: !no_rerank,
    semantic: semantic || false,
    wikiDir,
    paths,
  };

  return {
    content: [{ type: "text" as const, text: stdout }],
    details,
  };
}

// ── Extension entry point ──────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "wiki_search",
    label: "Wiki Search",
    description:
      "Search the personal wiki at ~/Documents/wiki/ using hybrid BM25 + vector search with Cohere reranking. " +
      "Returns the most relevant wiki pages with matching context. " +
      "Great for finding concepts, entities, sources, and synthesis pages.",
    promptSnippet: "Search the wiki for relevant pages",
    promptGuidelines: [
      "Use this tool when answering questions about topics that might be in the wiki",
      "Use specific wiki terminology — the wiki has its own vocabulary (e.g. 'agent swarm', 'spec-driven development')",
      "Use --semantic for broad conceptual queries where exact keywords might not match",
      "Use --no-rerank only when speed is critical and you need many rough results",
      "Follow [[wiki links]] in results for multi-hop discovery",
    ],
    parameters: WikiSearchParams,

    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      return executeWikiSearch(params as any);
    },

    renderCall(args, theme, context) {
      return renderSearchCall(args as any, theme, context);
    },

    renderResult(result, state, theme, _context) {
      return renderSearchResult(result as any, state, theme);
    },
  });

  // Quick command: /search-wiki <query>
  pi.registerCommand("search-wiki", {
    description: "Search the personal wiki",
    handler: async (args, ctx) => {
      if (!args) {
        ctx.ui.notify("Usage: /search-wiki <query>", "warning");
        return;
      }
      pi.sendUserMessage(`Search the wiki for: ${args}`, { deliverAs: "followUp" });
    },
  });
}
