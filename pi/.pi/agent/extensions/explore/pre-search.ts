/**
 * Pre-search module — orchestrates query planning, in-memory index search,
 * and structured result formatting for the explore subagent.
 */

import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { planQuery, type QueryPlan } from "./query-planner";
import { FileIndex, type ScoredFile, type FileEntry } from "./file-index";
import { rerankCandidates, heuristicToRelevance, type RerankedFile } from "./reranker";

const MAX_CACHE_SIZE = 5;

// Module-level cache: repo cwd → FileIndex (LRU, max 5 entries)
const indexCache = new Map<string, FileIndex>();
// In-flight build promises — deduplicates concurrent preSearch calls on same cwd
const buildPromises = new Map<string, Promise<boolean>>();

export interface PreSearchStats {
  indexSize: number;
  queryTimeMs: number;
  filesSurfaced: number;
  fallbackToRipgrep: boolean;
  hitBuildCap: boolean;
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
 * 4. Returns a structured, tiered list with evidence.
 */
export async function preSearch(
  cwd: string,
  rawQuery: string,
): Promise<PreSearchResult> {
  const startTime = Date.now();

  // 1. Query decomposition
  const plan = planQuery(rawQuery);

  // 2. Build or reuse index (dedup concurrent builds, evict oldest if cache is full)
  let hitBuildCap = false;
  let index = indexCache.get(cwd);

  if (!index) {
    let buildPromise = buildPromises.get(cwd);
    if (!buildPromise) {
      if (indexCache.size >= MAX_CACHE_SIZE) {
        const oldest = indexCache.keys().next().value;
        if (oldest !== undefined) indexCache.delete(oldest);
      }
      const idx = new FileIndex(cwd);
      buildPromise = idx.build().then((hbc) => {
        indexCache.set(cwd, idx);
        buildPromises.delete(cwd);
        return hbc;
      });
      buildPromises.set(cwd, buildPromise);
    }
    hitBuildCap = await buildPromise;
    index = indexCache.get(cwd)!;
  }

  // 3. Heuristic search (fast)
  let scored = index.search(plan);

  // 4. Fall back to ripgrep if index returned nothing (empty repo or parsing issues)
  let fallback = false;
  if (scored.length === 0 && index.size < 10) {
    const rgResults = fallbackRipgrep(cwd, plan);
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
  const text = formatResults(plan, reranked, hitBuildCap);

  return {
    text,
    stats: {
      indexSize: index.size,
      queryTimeMs: Date.now() - startTime,
      filesSurfaced: reranked.length,
      fallbackToRipgrep: fallback,
      hitBuildCap,
      rerankUsed,
    },
  };
}

// ── Formatting ────────────────────────────────────────────────────────────

function formatResults(
  plan: QueryPlan,
  scored: RerankedFile[],
  hitBuildCap: boolean,
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

  if (hitBuildCap) {
    lines.push("[⚠ Index build was truncated at 5s — results may be incomplete for large repos.]");
  }

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

const RG_GLOBS = [
  "-g", "*.ts", "-g", "*.tsx", "-g", "*.js", "-g", "*.jsx",
  "-g", "*.vue", "-g", "*.svelte", "-g", "*.py", "-g", "*.go",
  "-g", "*.rs", "-g", "*.rb", "-g", "*.java", "-g", "*.kt",
  "-g", "*.swift", "-g", "*.c", "-g", "*.cpp", "-g", "*.h", "-g", "*.hpp",
];

function fallbackRipgrep(
  cwd: string,
  plan: QueryPlan,
): ScoredFile[] {
  if (plan.grepTerms.length === 0) return [];

  const seen = new Set<string>();
  const results: ScoredFile[] = [];

  for (const term of plan.grepTerms.slice(0, 3)) {
    const result = spawnSync("rg", [
      "-l", "--hidden", ...RG_GLOBS, "--", term, ".",
    ], { cwd, timeout: 5000, encoding: "utf-8" });
    const out = result.stdout?.trim() ?? "";
    if (!out) continue;
    const files = out
      .split("\n")
      .filter((f) => f && !seen.has(f));
    files.forEach((f) => seen.add(f));
    for (const f of files) {
      results.push({ path: f, score: 1, reasons: ["rg match"] });
    }
  }

  return results;
}
