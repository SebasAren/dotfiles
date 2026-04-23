import { Bm25Doc, Bm25Index } from "./types.ts";
import { tokenize } from "./text.ts";
import { BM25_K1, BM25_B } from "./constants.ts";

export function buildBm25Index(
  docs: { id: string; text: string }[],
): Bm25Index {
  const indexed: Bm25Doc[] = docs.map((d) => {
    const terms = tokenize(d.text);
    const tf: Record<string, number> = {};
    for (const t of terms) tf[t] = (tf[t] ?? 0) + 1;
    return { id: d.id, terms, tf, len: terms.length };
  });

  const N = indexed.length;
  const totalLen = indexed.reduce((s, d) => s + d.len, 0);
  const avgdl = totalLen / N || 1;

  const df: Record<string, number> = {};
  for (const d of indexed) {
    const seen = new Set(d.terms);
    for (const t of seen) df[t] = (df[t] ?? 0) + 1;
  }

  const idf: Record<string, number> = {};
  for (const [t, freq] of Object.entries(df)) {
    idf[t] = Math.log((N - freq + 0.5) / (freq + 0.5) + 1);
  }

  return { docs: indexed, avgdl, idf, N };
}

export function scoreBm25(
  query: string,
  index: Bm25Index,
): Map<string, number> {
  const qterms = tokenize(query);
  const scores = new Map<string, number>();

  for (const doc of index.docs) {
    let score = 0;
    for (const t of qterms) {
      const tf = doc.tf[t] ?? 0;
      if (tf === 0) continue;
      const idf = index.idf[t] ?? 0;
      score +=
        (idf * (tf * (BM25_K1 + 1))) /
        (tf + BM25_K1 * (1 - BM25_B + BM25_B * (doc.len / index.avgdl)));
    }
    if (score > 0) scores.set(doc.id, score);
  }

  return scores;
}
