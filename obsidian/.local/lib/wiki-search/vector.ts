import { EMBED_URL, EMBED_MODEL } from "./constants.ts";

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function normalizeScores(
  scores: Map<string, number>,
): Map<string, number> {
  let min = Infinity;
  let max = -Infinity;
  for (const v of scores.values()) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (max === min) {
    const out = new Map<string, number>();
    for (const k of scores.keys()) out.set(k, 1);
    return out;
  }
  const out = new Map<string, number>();
  for (const [k, v] of scores) out.set(k, (v - min) / (max - min));
  return out;
}

export async function getEmbeddings(
  texts: string[],
  apiKey: string,
): Promise<number[][]> {
  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: texts,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embedding API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    data: { embedding: number[] }[];
  };
  return data.data.map((d) => d.embedding);
}
