/**
 * Pre-search module — extracts search terms from queries, runs ripgrep,
 * and optionally boosts results with tree-sitter symbol outlines.
 */

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { extractSymbols, type SymbolOutline } from "@pi-ext/shared";

/** Common English stop words to exclude from search terms. */
export const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "find",
  "look",
  "explore",
  "related",
  "about",
  "into",
  "what",
  "where",
  "which",
  "how",
  "all",
  "any",
  "some",
  "will",
  "also",
  "just",
  "than",
  "then",
  "there",
  "their",
  "them",
  "they",
  "these",
  "those",
  "other",
  "more",
  "most",
  "very",
  "much",
  "many",
  "such",
  "does",
  "dont",
  "should",
  "could",
  "would",
  "only",
  "even",
  "still",
  "already",
  "not",
  "but",
  "can",
  "are",
  "was",
  "were",
  "been",
  "being",
  "did",
  "has",
  "had",
  "its",
  "you",
  "your",
  "our",
  "use",
  "used",
  "using",
  "need",
  "like",
  "want",
  "get",
  "got",
  "over",
  "under",
]);

/** Extract 2-5 search terms from a natural language query. */
export function extractSearchTerms(query: string): string[] {
  // Use text before any injected markers
  const text = query.split("\n[")[0];

  // Extract quoted strings first (highest priority)
  const quoted: string[] = [];
  for (const m of text.matchAll(/["']([^"']{2,40})["']/g)) {
    quoted.push(m[1]);
  }

  // Extract distinctive words >= 3 chars
  const words = text
    .replace(/[^a-zA-Z0-9\s_-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w.toLowerCase()));

  // Combine: quoted phrases first, then unique words
  const seen = new Set(quoted.map((q) => q.toLowerCase()));
  const result = [...quoted];
  for (const w of words) {
    if (!seen.has(w.toLowerCase())) {
      seen.add(w.toLowerCase());
      result.push(w);
    }
  }
  return result.slice(0, 5);
}

/** Glob patterns for pre-search (ripgrep -g flags). */
export const RG_GLOBS = [
  "*.ts",
  "*.tsx",
  "*.js",
  "*.jsx",
  "*.vue",
  "*.svelte",
  "*.py",
  "*.go",
  "*.rs",
  "*.rb",
  "*.java",
  "*.kt",
  "*.swift",
  "*.c",
  "*.cpp",
  "*.h",
  "*.hpp",
]
  .map((e) => `-g '${e}'`)
  .join(" ");

/** A single file result with optional symbol outline. */
export interface PreSearchFile {
  path: string;
  outline?: SymbolOutline;
  /** Relevance boost score from symbol matching */
  boost?: number;
}

/** Run a shell command with a timeout, returning stdout. */
function runCmd(cwd: string, cmd: string, args: string[], timeoutMs = 5000): Promise<string> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    proc.stdin.end();
    let out = "";
    let resolved = false;
    const resolveOnce = (value: string) => {
      if (!resolved) {
        resolved = true;
        resolve(value);
      }
    };
    proc.stdout.on("data", (d: Buffer) => (out += d));
    proc.stderr.on("data", () => {});
    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      setTimeout(() => {
        if (!proc.killed) proc.kill("SIGKILL");
        resolveOnce(out);
      }, 1000);
    }, timeoutMs);
    proc.on("close", () => {
      clearTimeout(timer);
      resolveOnce(out);
    });
    proc.on("error", () => {
      clearTimeout(timer);
      resolveOnce("");
    });
  });
}

/**
 * Run grep before spawning subagent to give it a head start on file discovery.
 *
 * When `symbolBoost` is enabled, reads up to 50 candidate files and runs
 * tree-sitter symbol extraction. Files whose symbols match the search terms
 * get a relevance boost and their top symbols are included in the output.
 */
export async function preSearch(
  cwd: string,
  rawQuery: string,
  opts: { symbolBoost?: boolean } = {},
): Promise<string> {
  const terms = extractSearchTerms(rawQuery);
  if (terms.length === 0) return "";

  const seen = new Set<string>();

  // Run greps for top 3 terms in parallel
  const searches = terms.slice(0, 3).map(async (term) => {
    const escaped = term.replace(/'/g, "'\\''");
    const out = await runCmd(cwd, "sh", [
      "-c",
      `rg -l --hidden ${RG_GLOBS} '${escaped}' . 2>/dev/null | head -20`,
    ]);
    if (!out.trim()) return null;
    const files = out
      .trim()
      .split("\n")
      .filter((f) => !seen.has(f));
    files.forEach((f) => seen.add(f));
    return { term, files };
  });

  const grepResults = (await Promise.all(searches)).filter(
    (r): r is { term: string; files: string[] } => r !== null,
  );

  if (grepResults.length === 0) return "";

  // Optional symbol-outline boost phase
  let boostedFiles: Map<string, PreSearchFile> | undefined;
  if (opts.symbolBoost) {
    const candidates = grepResults.flatMap((r) => r.files).slice(0, 50);
    boostedFiles = await boostWithSymbols(cwd, candidates, terms);
  }

  // Format results: include symbol outline hints when available
  const results = grepResults.map(({ term, files }) => {
    const fileLines = files.map((f) => {
      const info = boostedFiles?.get(f);
      if (info?.outline && info.boost && info.boost > 0) {
        const topSymbols = info.outline.symbols
          .filter((s) => s.name)
          .slice(0, 3)
          .map((s) => `${s.name}(${s.kind})`)
          .join(", ");
        return `${f} [${topSymbols}]`;
      }
      return f;
    });
    return `"${term}": ${fileLines.join(", ")}`;
  });

  return (
    `\n\n[PRE-SEARCH RESULTS — grep already found these potentially relevant files. ` +
    `Skim the list and read only the ones likely related to your query. ` +
    `You do NOT need to re-search for these terms.]\n${results.join("\n")}`
  );
}

/** Read candidate files and boost those whose symbols match search terms. */
async function boostWithSymbols(
  cwd: string,
  files: string[],
  terms: string[],
): Promise<Map<string, PreSearchFile>> {
  const map = new Map<string, PreSearchFile>();
  const lowerTerms = terms.map((t) => t.toLowerCase());

  const start = Date.now();
  const MAX_SYMBOL_TIME_MS = 2000;
  const MAX_FILE_SIZE = 50_000;

  for (const file of files) {
    if (Date.now() - start > MAX_SYMBOL_TIME_MS) break;

    try {
      const fullPath = join(cwd, file);
      // stat + read in one shot using readFile; if it's huge the promise rejects or we check after
      const source = await readFile(fullPath, "utf-8");
      if (source.length > MAX_FILE_SIZE) continue;

      const outline = await extractSymbols(file, source);
      if (!outline || outline.symbols.length === 0) continue;

      let boost = 0;
      for (const sym of outline.symbols) {
        const nameLower = sym.name.toLowerCase();
        for (const term of lowerTerms) {
          if (nameLower.includes(term)) {
            boost += term.length >= 5 ? 3 : 2; // longer terms = stronger signal
          }
        }
      }

      map.set(file, { path: file, outline, boost });
    } catch {
      // Ignore unreadable files
    }
  }

  return map;
}
