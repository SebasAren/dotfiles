/**
 * File Index — in-memory structural index of a codebase.
 *
 * Built once per session, invalidated on tool edits, and queried with
 * multi-signal relevance scoring (symbols, intent, scope, import graph).
 */

import { spawn } from "node:child_process";
import * as path from "node:path";
import { readFile, stat } from "node:fs/promises";
import { extractSymbols, type CodeSymbol } from "@pi-ext/shared";
import type { QueryPlan, QueryIntent } from "./query-planner";

export interface FileEntry {
  path: string;
  language: string;
  symbols: CodeSymbol[];
  description: string;
  imports: string[];
  exports: string[];
  size: number;
  mtimeMs: number;
}

export interface ScoredFile {
  path: string;
  score: number;
  reasons: string[];
}

const MAX_INDEXED_FILES = 1500;
const MAX_BUILD_TIME_MS = 5000;
const MAX_FILE_SIZE = 50_000;

export class FileIndex {
  private cwd: string;
  private files = new Map<string, FileEntry>();
  private importedBy = new Map<string, Set<string>>();

  constructor(cwd: string) {
    this.cwd = cwd;
  }

  get size(): number {
    return this.files.size;
  }

  /** Look up a single entry by relative path. Returns undefined if not indexed. */
  getEntry(relPath: string): FileEntry | undefined {
    return this.files.get(relPath);
  }

  /** Build the index from all tracked source files. */
  async build(): Promise<void> {
    const fileList = await this.enumerateFiles();
    const start = Date.now();

    const indexed: string[] = [];
    for (const relPath of fileList) {
      if (Date.now() - start > MAX_BUILD_TIME_MS) break;
      const success = await this.indexFile(relPath);
      if (success) indexed.push(relPath);
    }

    // Second pass: resolve imports and build reverse graph
    for (const relPath of indexed) {
      const entry = this.files.get(relPath);
      if (!entry) continue;
      for (const imp of entry.imports) {
        const resolved = this.resolveImport(relPath, imp);
        if (resolved && this.files.has(resolved)) {
          if (!this.importedBy.has(resolved)) {
            this.importedBy.set(resolved, new Set());
          }
          this.importedBy.get(resolved)!.add(relPath);
        }
      }
    }
  }

  /** Search the index using a structured query plan. */
  search(plan: QueryPlan): ScoredFile[] {
    const scored: ScoredFile[] = [];
    for (const entry of this.files.values()) {
      const result = this.scoreFile(entry, plan);
      if (result.score > 0) {
        scored.push(result);
      }
    }

    scored.sort((a, b) => b.score - a.score);
    this.applyProximityBoost(scored);
    scored.sort((a, b) => b.score - a.score);

    return scored;
  }

  /** Remove a file from the index (e.g. after an external edit). */
  invalidate(relPath: string): void {
    const normalized = relPath.replace(/^\.\//, "");
    this.files.delete(normalized);
  }

  /** Re-index a single file if it changed on disk. */
  async validateAndReindexIfNeeded(relPath: string): Promise<boolean> {
    const normalized = relPath.replace(/^\.\//, "");
    const entry = this.files.get(normalized);
    if (!entry) return false;
    try {
      const fullPath = path.resolve(this.cwd, normalized);
      const s = await stat(fullPath);
      if (s.mtimeMs > entry.mtimeMs || s.size !== entry.size) {
        await this.indexFile(normalized);
        return true;
      }
      return false;
    } catch {
      this.files.delete(normalized);
      return false;
    }
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  private async enumerateFiles(): Promise<string[]> {
    return new Promise((resolve) => {
      const exts = [
        "*.ts",
        "*.tsx",
        "*.js",
        "*.jsx",
        "*.mjs",
        "*.cjs",
        "*.py",
        "*.go",
        "*.rs",
        "*.vue",
        "*.svelte",
        "*.rb",
        "*.java",
        "*.kt",
        "*.swift",
        "*.c",
        "*.cpp",
        "*.h",
        "*.hpp",
      ];
      const gitCmd = `git ls-files -- ${exts.map((e) => `'${e}'`).join(" ")}`;
      const findOr = exts.map((e) => `-name '${e}'`).join(" -o ");
      const findCmd =
        `find . -type f \\( ${findOr} \\) ! -path './node_modules/*' ! -path './.*' ! -path './dist/*' ! -path './build/*'`;

      const proc = spawn(
        "sh",
        ["-c", `${gitCmd} 2>/dev/null || ${findCmd} 2>/dev/null`],
        { cwd: this.cwd },
      );
      let out = "";
      proc.stdout.on("data", (d: Buffer) => (out += d));
      proc.on("close", () => {
        const files = out
          .trim()
          .split("\n")
          .filter((f) => f && !f.includes("node_modules/") && !f.startsWith(".git/"))
          .map((f) => f.replace(/^\.\//, ""))
          .slice(0, MAX_INDEXED_FILES);
        resolve(files);
      });
      proc.on("error", () => resolve([]));
    });
  }

  private async indexFile(relPath: string): Promise<boolean> {
    const fullPath = path.resolve(this.cwd, relPath);
    try {
      const s = await stat(fullPath);
      if (s.size > MAX_FILE_SIZE) return false;

      const source = await readFile(fullPath, "utf-8");
      const outline = await extractSymbols(relPath, source);
      const symbols = outline?.symbols ?? [];
      const description = extractDescription(source);
      const imports = extractImports(relPath, source);
      const exports = symbols
        .filter(
          (sym) =>
            sym.name &&
            (["export", "function", "class", "interface"] as string[]).includes(sym.kind),
        )
        .map((sym) => sym.name);

      const entry: FileEntry = {
        path: relPath,
        language: outline?.language ?? path.extname(relPath),
        symbols,
        description,
        imports,
        exports,
        size: s.size,
        mtimeMs: s.mtimeMs,
      };

      this.files.set(relPath, entry);
      return true;
    } catch {
      return false;
    }
  }

  private scoreFile(entry: FileEntry, plan: QueryPlan): ScoredFile {
    let score = 0;
    const reasons: string[] = [];

    // Grep term matches in symbols, path, and description
    for (const term of plan.grepTerms) {
      const lower = term.toLowerCase();
      // Path match
      if (entry.path.toLowerCase().includes(lower)) {
        score += 2;
        reasons.push(`path match: ${term}`);
      }
      for (const sym of entry.symbols) {
        if (sym.kind === "export") continue; // Skip noisy export-statement symbols
        const symLower = sym.name.toLowerCase();
        if (isRelated(lower, symLower)) {
          score += symLower === lower ? 8 : 4;
          reasons.push(`symbol match: ${sym.name}`);
        }
      }
      if (entry.description.toLowerCase().includes(lower)) {
        score += 1;
      }
    }

    // Exact entity matches (highest weight)
    for (const entity of plan.entities) {
      const lower = entity.toLowerCase();
      // Path match for entity
      if (entry.path.toLowerCase().includes(lower)) {
        score += 6;
        reasons.push(`path entity: ${entity}`);
      }
      const exactSym = entry.symbols.find(
        (s) =>
          s.kind !== "export" &&
          (isRelated(s.name.toLowerCase(), lower)),
      );
      if (exactSym) {
        score += 12;
        reasons.push(`exact entity: ${exactSym.name}`);
      }
    }

    // Intent boosting
    if (
      plan.intent === "define" &&
      entry.symbols.some((s) =>
        (["function", "class", "interface", "type_alias", "method"] as string[]).includes(
          s.kind,
        ),
      )
    ) {
      score += 4;
    }
    if (
      plan.intent === "arch" &&
      ["index.ts", "main.ts", "app.ts", "server.ts"].some((n) => entry.path.endsWith(n))
    ) {
      score += 3;
      reasons.push("entry point");
    }

    // Scope hints
    for (const hint of plan.scopeHints) {
      if (entry.path.includes(hint)) {
        score += 3;
        reasons.push(`scope: ${hint}`);
      }
    }

    // File pattern preference
    const ext = path.extname(entry.path);
    const hasPreferredExt = plan.filePatterns.some((p) => {
      if (p.startsWith("*.")) return ext === p.slice(1);
      return (
        entry.path.toLowerCase().includes(p.toLowerCase().replace(/\*/g, "")) &&
        !p.startsWith("*.")
      );
    });
    if (hasPreferredExt) {
      score += 1;
    }

    return {
      path: entry.path,
      score: Math.max(0, score),
      reasons: [...new Set(reasons)],
    };
  }

  private applyProximityBoost(scored: ScoredFile[]): void {
    const topPaths = new Set(scored.slice(0, 10).map((s) => s.path));
    const boostMap = new Map<string, number>();

    for (const file of topPaths) {
      // Files that import top files
      const importers = this.importedBy.get(file);
      if (importers) {
        for (const importer of importers) {
          boostMap.set(importer, (boostMap.get(importer) || 0) + 2);
        }
      }
      // Files that top files import
      const entry = this.files.get(file);
      if (entry) {
        for (const imp of entry.imports) {
          const resolved = this.resolveImport(file, imp);
          if (resolved) {
            boostMap.set(resolved, (boostMap.get(resolved) || 0) + 1);
          }
        }
      }
    }

    for (const s of scored) {
      // Only boost files that already have direct relevance.
      if (s.score === 0) continue;
      const boost = boostMap.get(s.path);
      if (boost) {
        s.score += boost;
        s.reasons.push("import proximity");
      }
    }
  }

  private resolveImport(fromRelPath: string, importPath: string): string | null {
    // Only handle relative imports for now
    if (!importPath.startsWith(".")) return null;
    const fromDir = path.dirname(fromRelPath);
    const base = path.join(fromDir, importPath);
    const candidates = [
      base,
      base + ".ts",
      base + ".tsx",
      base + ".js",
      base + ".jsx",
      base + "/index.ts",
      base + "/index.js",
    ];
    for (const c of candidates) {
      const normalized = c.replace(/^\.\//, "").replace(/\\/g, "/");
      if (this.files.has(normalized)) {
        return normalized;
      }
    }
    return null;
  }
}

/**
 * Check if two lowercase strings are related (stem/plural overlap).
 * Returns true if either is a prefix of the other with ≥6 shared chars,
 * or if one contains the other.
 */
function isRelated(a: string, b: string): boolean {
  if (a.includes(b) || b.includes(a)) return true;
  // Plural / stem overlap: compute longest common prefix
  let shared = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) shared++;
    else break;
  }
  if (shared >= 6) return true;
  // De-pluralised containment (subagents ↔ subagent)
  const aStem = a.replace(/s$/, "");
  const bStem = b.replace(/s$/, "");
  if (aStem !== a || bStem !== b) {
    return aStem.includes(bStem) || bStem.includes(aStem);
  }
  return false;
}

function extractDescription(source: string): string {
  // JSDoc block
  const jsdoc = source.match(/\/\*\*[\s\S]*?\*\//);
  if (jsdoc) {
    return jsdoc[0]
      .replace(/\/\*\*?\s*|\s*\*\//g, "")
      .replace(/\s*\n\s*\*\s?/g, " ")
      .trim()
      .slice(0, 200);
  }

  // Leading single-line comments
  const lines = source.split("\n");
  const comments: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//")) {
      comments.push(trimmed.replace(/^\/\/\s*/, ""));
    } else if (trimmed === "" || trimmed.startsWith("import ") || trimmed.startsWith("export ")) {
      continue;
    } else {
      break;
    }
  }
  if (comments.length > 0) {
    return comments.join(" ").slice(0, 200);
  }

  // Fallback: first non-empty non-import line
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("import") && !trimmed.startsWith("export")) {
      return trimmed.slice(0, 200);
    }
  }
  return "";
}

function extractImports(filePath: string, source: string): string[] {
  const ext = path.extname(filePath);
  if (![".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext)) {
    return [];
  }

  const imports: string[] = [];
  const importRegex =
    /import\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(source)) !== null) {
    imports.push(match[1]);
  }

  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRegex.exec(source)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}
