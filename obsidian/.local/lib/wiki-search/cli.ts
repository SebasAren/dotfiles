import { parseArgs } from "node:util";
import { relative } from "node:path";
import { WIKI_DIR, RERANK_MODEL } from "./constants.ts";
import { Bm25Index } from "./types.ts";
import { scoreBm25 } from "./bm25.ts";
import { cacheIsStale, loadJson, buildCache } from "./cache.ts";
import { findCandidates, showContext, rerank, hybridSearch } from "./search.ts";

export async function main(
  args: string[],
  env: Record<string, string | undefined>,
): Promise<string> {
  const { positionals, values } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      context: { type: "string", default: "3" },
      top: { type: "string", default: "5" },
      "no-rerank": { type: "boolean", default: false },
      rebuild: { type: "boolean", default: false },
      alpha: { type: "string", default: "0.6" },
      semantic: { type: "boolean", default: false },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help || (positionals.length === 0 && !values.rebuild)) {
    return `wiki-search - Search the LLM wiki with hybrid BM25 + vector reranking

Usage: wiki-search <query> [--context N] [--top N] [--no-rerank] [--rebuild] [--alpha N] [--semantic]

Options:
  --context N    lines of context around each match (default: 3)
  --top N        number of reranked results to return (default: 5)
  --no-rerank    skip Cohere reranking
  --rebuild      rebuild BM25 + vector cache
  --alpha N      BM25 weight in hybrid score 0..1 (default: 0.6)
  --semantic     vector-only search (alpha = 0)

Requires OPENROUTER_API_KEY for embeddings and reranking.
Falls back to BM25-only if key is unset.`;
  }

  const query = positionals.join(" ");
  const contextLines = parseInt(values.context!, 10);
  const topN = parseInt(values.top!, 10);
  const shouldRerank = !values["no-rerank"];
  const wikiDir = env.WIKI_DIR ?? WIKI_DIR;
  const apiKey = env.OPENROUTER_API_KEY;
  const semanticOnly = values.semantic;
  let alpha = parseFloat(values.alpha!);
  if (semanticOnly) alpha = 0;
  if (Number.isNaN(alpha) || alpha < 0 || alpha > 1) alpha = 0.6;

  // ── Rebuild cache ──
  if (values.rebuild) {
    if (!apiKey) {
      return "Error: OPENROUTER_API_KEY required for --rebuild";
    }
    const msgs: string[] = [];
    await buildCache(wikiDir, apiKey, (m) => msgs.push(m));
    return msgs.join("\n");
  }

  // ── Check cache ──
  const bm25Index = loadJson<Bm25Index>("bm25-index.json");
  const vectors = loadJson<Record<string, number[]>>("vectors.json");
  const hasCache = bm25Index !== null;
  const hasVectors = vectors !== null && apiKey;
  const cacheStale = hasCache ? cacheIsStale(wikiDir) : true;

  // ── Fallback to legacy ripgrep + rerank when no cache ──
  if (!hasCache) {
    const candidates = findCandidates(query, wikiDir);
    if (candidates.length === 0) {
      return `No matching pages found for: ${query}`;
    }

    const lines: string[] = [];
    lines.push(`=== ${candidates.length} matching page(s) ===`);

    let ordered = candidates;
    if (shouldRerank && apiKey) {
      try {
        const indices = await rerank(query, candidates, topN, wikiDir);
        ordered = indices.map((i) => candidates[i]);
        lines.push(`=== Reranked by relevance (${RERANK_MODEL}) ===`);
      } catch (err) {
        lines.push(`=== Rerank failed, using rg order ===`);
      }
    }

    lines.push("");
    for (const f of ordered) {
      const rel = relative(wikiDir, f);
      lines.push(`─── ${rel} ───`);
      lines.push(showContext(query, f, contextLines));
    }
    return lines.join("\n");
  }

  if (cacheStale) {
    return `Search index is stale. Run: wiki-search --rebuild`;
  }

  // ── Search ──
  let candidates: string[];
  let scored: Array<{ path: string; score: number }>;

  if (hasVectors) {
    scored = await hybridSearch(query, bm25Index!, vectors!, alpha, apiKey);
    candidates = scored.map((s) => s.path);
  } else {
    scored = Array.from(scoreBm25(query, bm25Index!))
      .map(([path, score]) => ({ path, score }))
      .sort((a, b) => b.score - a.score);
    candidates = scored.map((s) => s.path);
  }

  if (candidates.length === 0) {
    return `No matching pages found for: ${query}`;
  }

  const lines: string[] = [];
  lines.push(`=== ${candidates.length} matching page(s) ===`);

  if (hasVectors) {
    lines.push(
      `=== Hybrid search (BM25 ${alpha.toFixed(1)}, vector ${(1 - alpha).toFixed(1)}) ===`,
    );
  } else {
    lines.push(`=== BM25 search (no API key) ===`);
  }

  let ordered = candidates;

  if (shouldRerank && apiKey) {
    try {
      const indices = await rerank(query, candidates, topN, wikiDir);
      ordered = indices.map((i) => candidates[i]);
      lines.push(`=== Reranked by relevance (${RERANK_MODEL}) ===`);
    } catch (err) {
      lines.push(`=== Rerank failed, using hybrid order ===`);
    }
  }

  lines.push("");

  const limit = Math.min(topN, ordered.length);
  for (let i = 0; i < limit; i++) {
    const f = ordered[i]!;
    const rel = relative(wikiDir, f);
    const scoreEntry = scored.find((s) => s.path === f);
    const scoreStr = scoreEntry
      ? ` (score: ${scoreEntry.score.toFixed(3)})`
      : "";
    lines.push(`─── ${rel}${scoreStr} ───`);
    lines.push(showContext(query, f, contextLines));
  }

  return lines.join("\n");
}
