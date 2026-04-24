import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  statSync,
  readdirSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { Manifest } from "./types.ts";
import { extractText } from "./text.ts";
import { buildBm25Index } from "./bm25.ts";
import { getEmbeddings } from "./vector.ts";

function getCacheDir(): string {
  return `${process.env.HOME}/.cache/wiki-search`;
}

export function cachePath(name: string): string {
  return resolve(getCacheDir(), name);
}

export function loadJson<T>(name: string): T | null {
  const p = cachePath(name);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as T;
  } catch {
    return null;
  }
}

export function saveJson(name: string, data: unknown): void {
  const dir = getCacheDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(cachePath(name), JSON.stringify(data), "utf-8");
}

export function fileHash(path: string): string {
  const stat = statSync(path);
  return `${stat.mtimeMs}-${stat.size}`;
}

export function* walkMarkdown(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkMarkdown(path);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      yield path;
    }
  }
}

export async function buildCache(
  wikiDir: string,
  apiKey: string,
  onProgress?: (msg: string) => void,
): Promise<void> {
  const dir = getCacheDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const manifest = loadJson<Manifest>("manifest.json") ?? {};
  const newManifest: Manifest = {};
  const toEmbed: { path: string; text: string }[] = [];
  const unchangedVectors: Record<string, number[]> = {};
  const existingVectors =
    loadJson<Record<string, number[]>>("vectors.json") ?? {};

  let count = 0;
  for (const path of walkMarkdown(wikiDir)) {
    count++;
    const hash = fileHash(path);
    newManifest[path] = { hash };

    if (manifest[path]?.hash === hash && existingVectors[path]) {
      unchangedVectors[path] = existingVectors[path]!;
    } else {
      const content = readFileSync(path, "utf-8");
      const text = extractText(content).slice(0, 8000); // cap for API
      toEmbed.push({ path, text });
    }
  }

  if (toEmbed.length === 0) {
    onProgress?.("No changes detected.");
  } else {
    onProgress?.(`Embedding ${toEmbed.length} of ${count} documents...`);

    // Batch in groups of 64 to stay within API limits
    const batchSize = 64;
    const vectors: Record<string, number[]> = { ...unchangedVectors };
    for (let i = 0; i < toEmbed.length; i += batchSize) {
      const batch = toEmbed.slice(i, i + batchSize);
      const embs = await getEmbeddings(
        batch.map((b) => b.text),
        apiKey,
      );
      for (let j = 0; j < batch.length; j++) {
        vectors[batch[j]!.path] = embs[j]!;
      }
      onProgress?.(
        `Embedded ${Math.min(i + batchSize, toEmbed.length)} / ${toEmbed.length}`,
      );
    }
    saveJson("vectors.json", vectors);
  }

  // Build BM25 index from all docs
  onProgress?.("Building BM25 index...");
  const allDocs: { id: string; text: string }[] = [];
  for (const path of walkMarkdown(wikiDir)) {
    const content = readFileSync(path, "utf-8");
    allDocs.push({ id: path, text: extractText(content) });
  }
  const bm25 = buildBm25Index(allDocs);
  saveJson("bm25-index.json", bm25);
  saveJson("manifest.json", newManifest);
  onProgress?.(`Done. Indexed ${allDocs.length} documents.`);
}

export function cacheIsStale(
  wikiDir: string,
): { stale: false } | { stale: true; reason: "hash" | "structure" } {
  const manifest = loadJson<Manifest>("manifest.json");
  if (!manifest) return { stale: true, reason: "structure" };
  const currentPaths = new Set(walkMarkdown(wikiDir));
  const cachedPaths = new Set(Object.keys(manifest));
  if (currentPaths.size !== cachedPaths.size)
    return { stale: true, reason: "structure" };
  for (const p of currentPaths)
    if (!cachedPaths.has(p)) return { stale: true, reason: "structure" };
  for (const [p, entry] of Object.entries(manifest)) {
    if (!existsSync(p)) return { stale: true, reason: "structure" };
    if (fileHash(p) !== entry.hash) return { stale: true, reason: "hash" };
  }
  return { stale: false };
}
