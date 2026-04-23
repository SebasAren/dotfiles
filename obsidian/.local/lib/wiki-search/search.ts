import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { spawnSync } from "node:child_process";
import { Bm25Index } from "./types.ts";
import { scoreBm25 } from "./bm25.ts";
import { cosineSimilarity, normalizeScores, getEmbeddings } from "./vector.ts";
import { RERANK_MODEL, RERANK_URL, MAX_CONTENT_CHARS } from "./constants.ts";

export function rg(args: string[]): string {
  const { stdout, status } = spawnSync("rg", args, {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 10_000,
  });
  return status === 0 ? stdout : "";
}

export function findCandidates(query: string, wikiDir: string): string[] {
  const out = rg(["-il", query, wikiDir]);
  return out.trim().split("\n").filter(Boolean).sort();
}

export function showContext(
  query: string,
  file: string,
  context: number,
): string {
  return rg(["-i", "-C", String(context), "--max-count", "3", query, file]);
}

export async function rerank(
  query: string,
  files: string[],
  topN: number,
  wikiDir: string,
): Promise<number[]> {
  const documents = files.map((f) => {
    const rel = relative(wikiDir, f);
    const content = readFileSync(f, "utf-8").slice(0, MAX_CONTENT_CHARS);
    return `${rel}: ${content}`;
  });

  const res = await fetch(RERANK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: RERANK_MODEL,
      query,
      documents,
      top_n: topN,
    }),
  });

  if (!res.ok) {
    console.error(`Rerank API error: ${res.status} ${res.statusText}`);
    return files.map((_, i) => i);
  }

  const data = (await res.json()) as {
    results: { index: number; relevance_score: number }[];
  };
  return data.results.map((r) => r.index);
}

export async function hybridSearch(
  query: string,
  bm25Index: Bm25Index,
  vectors: Record<string, number[]>,
  alpha: number,
  apiKey: string,
): Promise<Array<{ path: string; score: number }>> {
  const bm25Scores = normalizeScores(scoreBm25(query, bm25Index));

  // Embed query
  const queryEmb = await getEmbeddings([query], apiKey);
  const qvec = queryEmb[0]!;

  const vecScores = new Map<string, number>();
  for (const [path, vec] of Object.entries(vectors)) {
    vecScores.set(path, cosineSimilarity(qvec, vec));
  }
  const normVecScores = normalizeScores(vecScores);

  const combined = new Map<string, number>();
  const allIds = new Set([...bm25Scores.keys(), ...Object.keys(vectors)]);

  for (const id of allIds) {
    const b = bm25Scores.get(id) ?? 0;
    const v = normVecScores.get(id) ?? 0;
    combined.set(id, alpha * b + (1 - alpha) * v);
  }

  return Array.from(combined.entries())
    .map(([path, score]) => ({ path, score }))
    .sort((a, b) => b.score - a.score);
}
