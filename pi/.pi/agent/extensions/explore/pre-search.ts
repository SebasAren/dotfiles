/**
 * Pre-search module — orchestrates query planning, in-memory index search,
 * and structured result formatting for the explore subagent.
 */

import { spawn } from "node:child_process";
import { join } from "node:path";
import { planQuery, type QueryPlan } from "./query-planner";
import { FileIndex, type ScoredFile, type FileEntry } from "./file-index";
import { rerankCandidates, type RerankedFile } from "./reranker";

// Module-level cache: repo cwd → FileIndex
const indexCache = new Map<string, FileIndex>();

export interface PreSearchStats {
  indexSize: number;
  queryTimeMs: number;
  filesSurfaced: number;
  snippetsInjected: number;
  fallbackToRipgrep: boolean;
  rerankUsed: boolean;
}

export interface PreSearchResult {
  text: string;
  stats: PreSearchStats;
}

/** Invalidate a file path in every cached index that contains it. */
export function invalidateFilePath(filePath: string, sessionCwd: string): void {
  const absPath =
    filePath.startsWith("/") ? filePath : join(sessionCwd, filePath);
  for (const [cwd, index] of indexCache.entries()) {
    if (absPath.startsWith(cwd + "/")) {
      const rel = absPath.slice(cwd.length + 1);
      index.invalidate(rel);
    }
  }
}

/**
 * Run intelligent pre-search before spawning the subagent.
 *
 * 1. Decomposes the query into a structured plan.
 * 2. Builds or reuses an in-memory file index of the repo.
 * 3. Ranks files by multi-signal relevance.
 * 4. Returns a structured, tiered list with evidence and optional snippets.
 */
export async function preSearch(
  cwd: string,
  rawQuery: string,
  opts: { symbolBoost?: boolean } = {},
): Promise<PreSearchResult> {
  const startTime = Date.now();

  // 1. Query decomposition
  const plan = planQuery(rawQuery);

  // 2. Build or reuse index
  let index = indexCache.get(cwd);
  if (!index) {
    index = new FileIndex(cwd);
    await index.build();
    indexCache.set(cwd, index);
  }

  // 3. Heuristic search (fast)
  let scored = index.search(plan);

  // 4. Fall back to ripgrep if index returned nothing (empty repo or parsing issues)
  let fallback = false;
  if (scored.length === 0 && index.size < 10) {
    const rgResults = await fallbackRipgrep(cwd, plan);
    scored = rgResults;
    fallback = true;
  }

  // 5. Semantic reranking (cheap API call, big quality boost)
  let reranked: RerankedFile[] = scored.map((c) => ({
    ...c,
    relevanceScore: heuristicToRelevance(c.score),
  }));
  let rerankUsed = false;
  if (!fallback) {
    try {
      // Gather entries for the top ~30 heuristic candidates
      const candidateMap = new Map<string, FileEntry>();
      for (const c of scored.slice(0, 30)) {
        const entry = index.getEntry(c.path);
        if (entry) candidateMap.set(c.path, entry);
      }
      if (candidateMap.size > 0) {
        reranked = await rerankCandidates(
          rawQuery,
          scored.slice(0, 30),
          candidateMap,
        );
        rerankUsed = true;
      }
    } catch {
      // Graceful fallback — keep heuristic scores already set above
    }
  }

  // 6. Format results
  const text = formatResults(plan, reranked);

  return {
    text,
    stats: {
      indexSize: index.size,
      queryTimeMs: Date.now() - startTime,
      filesSurfaced: reranked.length,
      snippetsInjected: 0,
      fallbackToRipgrep: fallback,
      rerankUsed,
    },
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────

function heuristicToRelevance(score: number): number {
  return Math.min(1, score / (score + 8));
}

// ── Formatting ────────────────────────────────────────────────────────────

function formatResults(
  plan: QueryPlan,
  scored: RerankedFile[],
): string {
  if (scored.length === 0) return "";

  const highly = scored.filter((s) => s.relevanceScore >= 0.60);
  const probably = scored.filter((s) => s.relevanceScore >= 0.30 && s.relevanceScore < 0.60);
  const mentioned = scored.filter((s) => s.relevanceScore >= 0.10 && s.relevanceScore < 0.30);

  const lines: string[] = [];
  lines.push(
    "\n\n[PRE-SEARCH RESULTS]",
    `Query analysis: ${plan.intent} | entities: ${plan.entities.join(", ") || "none"} | scope: ${plan.scopeHints.join(", ") || "none"}`,
  );

  let fileNum = 1;

  if (highly.length > 0) {
    lines.push(`\n## Highly Relevant (read these first)`);
    for (const s of highly.slice(0, 7)) {
      const reasonStr = s.reasons.slice(0, 2).join(", ");
      lines.push(`${fileNum}. \`./${s.path}\` — score ${Math.round(s.relevanceScore * 100)}%${reasonStr ? ` — ${reasonStr}` : ""}`);
      fileNum++;
    }
  }

  if (probably.length > 0) {
    lines.push(`\n## Probably Relevant`);
    for (const s of probably.slice(0, 5)) {
      const reasonStr = s.reasons.slice(0, 2).join(", ");
      lines.push(`${fileNum}. \`./${s.path}\` — score ${Math.round(s.relevanceScore * 100)}%${reasonStr ? ` — ${reasonStr}` : ""}`);
      fileNum++;
    }
  }

  if (mentioned.length > 0) {
    lines.push(`\n## Mentioned in code`);
    for (const s of mentioned.slice(0, 5)) {
      lines.push(`${fileNum}. \`./${s.path}\` — score ${Math.round(s.relevanceScore * 100)}%`);
      fileNum++;
    }
  }

  // Strategy hint
  if (highly.length > 0) {
    let hint = "";
    if (plan.intent === "define") {
      hint = "Start with file #1 (definitions), then follow import links.";
    } else if (plan.intent === "use") {
      hint = "Start with file #1 (primary usage), then check files that import it.";
    } else if (plan.intent === "arch") {
      hint = "Start with file #1 (entry point), then follow outward to dependencies.";
    } else if (plan.intent === "change") {
      hint = "Start with file #1 (main location), then check tests and related files.";
    }
    if (hint) lines.push(`\n[STRATEGY HINT: ${hint}]`);
  } else if (plan.entities.length > 0 || plan.grepTerms.length > 0) {
    // No highly relevant files — warn about likely missing terms
    const topTerms = [...new Set([...plan.entities, ...plan.grepTerms])].slice(0, 5);
    const missing = topTerms.filter((t) =>
      !scored.some((s) =>
        s.reasons.some((r) => r.toLowerCase().includes(t.toLowerCase())),
      ),
    );
    if (missing.length > 0) {
      lines.push(
        `\n[⚠ No strong matches found for: ${missing.join(", ")} — these may be in external dependencies or use different terminology.]`,
      );
    }
  }

  return lines.join("\n");
}

// ── Fallback ──────────────────────────────────────────────────────────────

async function fallbackRipgrep(
  cwd: string,
  plan: QueryPlan,
): Promise<ScoredFile[]> {
  if (plan.grepTerms.length === 0) return [];

  const seen = new Set<string>();
  const results: ScoredFile[] = [];

  for (const term of plan.grepTerms.slice(0, 3)) {
    const escaped = term.replace(/'/g, "'\\''");
    const out = await runCmd(cwd, "sh", [
      "-c",
      `rg -l --hidden ${rgGlobs()} '${escaped}' . 2>/dev/null | head -20`,
    ]);
    if (!out.trim()) continue;
    const files = out
      .trim()
      .split("\n")
      .filter((f) => !seen.has(f));
    files.forEach((f) => seen.add(f));
    for (const f of files) {
      results.push({ path: f, score: 1, reasons: ["rg match"] });
    }
  }

  return results;
}

function rgGlobs(): string {
  return [
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
}

function runCmd(
  cwd: string,
  cmd: string,
  args: string[],
  timeoutMs = 5000,
): Promise<string> {
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
