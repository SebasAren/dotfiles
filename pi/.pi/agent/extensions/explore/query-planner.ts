/**
 * Query Planner — decomposes natural language explore queries into
 * structured search intent without fragile regex keyword extraction.
 */

/** Query intent classification. */
export type QueryIntent = "define" | "use" | "arch" | "change";

export interface QueryPlan {
  /** Classified intent. */
  intent: QueryIntent;
  /** Named code entities (camelCase, snake_case, PascalCase). */
  entities: string[];
  /** Safe terms for ripgrep (≥4 chars, noise-filtered). */
  grepTerms: string[];
  /** File extension patterns inferred from query context. */
  filePatterns: string[];
  /** Directory or scope hints. */
  scopeHints: string[];
  /** Terms that produce noise and should be avoided in searches. */
  avoidTerms: string[];
}

const INTENT_DEFINE_KEYWORDS = new Set([
  "define",
  "definition",
  "declared",
  "declaration",
  "where is",
  "what is",
]);
const INTENT_USE_KEYWORDS = new Set([
  "use",
  "usage",
  "used",
  "uses",
  "call",
  "called",
  "invoke",
  "invoked",
  "how to",
  "how do",
  "example",
  "pattern",
  "how does",
]);
const INTENT_ARCH_KEYWORDS = new Set([
  "architecture",
  "structure",
  "overview",
  "flow",
  "design",
  "how does",
  "fit together",
  "component",
  "module",
  "system",
]);
const INTENT_CHANGE_KEYWORDS = new Set([
  "change",
  "modify",
  "update",
  "refactor",
  "add",
  "remove",
  "delete",
  "fix",
  "implement",
  "move",
  "rename",
  "edit",
]);

const EXT_PATTERNS: Record<string, string[]> = {
  docker: ["*.yaml", "*.yml", "docker-compose.*", "Dockerfile*"],
  compose: ["*.yaml", "*.yml", "docker-compose.*"],
  neovim: ["*.lua", "*.vim"],
  nvim: ["*.lua", "*.vim"],
  plugin: ["*.lua", "*.ts", "*.js"],
  typescript: ["*.ts", "*.tsx"],
  python: ["*.py"],
  go: ["*.go"],
  rust: ["*.rs"],
  css: ["*.css", "*.scss", "*.sass"],
  style: ["*.css", "*.scss", "*.sass"],
  bash: ["*.sh", "*.bash"],
  shell: ["*.sh", "*.bash"],
  test: ["*.test.ts", "*.test.js", "*.spec.ts", "*.spec.py", "*_test.go"],
};

const STOP_WORDS = new Set([
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

/** Decompose a raw explore query into a structured plan. */
export function planQuery(rawQuery: string): QueryPlan {
  const text = rawQuery.split("\n[")[0];

  const intent = detectIntent(text);
  const entities = extractEntities(text);
  const scopeHints = extractScopeHints(text);
  const filePatterns = inferFilePatterns(text);
  const { grepTerms, avoidTerms } = deriveSearchTerms(text, entities);

  return { intent, entities, grepTerms, filePatterns, scopeHints, avoidTerms };
}

function detectIntent(text: string): QueryIntent {
  const lower = text.toLowerCase();
  if (matchesAny(lower, INTENT_ARCH_KEYWORDS)) return "arch";
  if (matchesAny(lower, INTENT_CHANGE_KEYWORDS)) return "change";
  if (matchesAny(lower, INTENT_USE_KEYWORDS)) return "use";
  if (matchesAny(lower, INTENT_DEFINE_KEYWORDS)) return "define";
  return "define";
}

function matchesAny(text: string, keywords: Set<string>): boolean {
  // For multi-word phrases, use substring match; for single words, require
  // exact word boundaries to prevent "defined" from matching "used".
  const wordSet = new Set(text.split(/[^a-z]+/).filter(Boolean));
  for (const kw of keywords) {
    if (kw.includes(" ")) {
      if (text.includes(kw)) return true;
    } else {
      if (wordSet.has(kw)) return true;
    }
  }
  return false;
}

function extractEntities(text: string): string[] {
  const entities: string[] = [];
  const seen = new Set<string>();

  // Match double-quoted strings
  for (const m of text.matchAll(/"([^"]{1,60})"/g)) {
    const e = m[1];
    if (!seen.has(e.toLowerCase())) {
      seen.add(e.toLowerCase());
      entities.push(e);
    }
  }
  // Match single-quoted strings
  for (const m of text.matchAll(/'([^']{1,60})'/g)) {
    const e = m[1];
    if (!seen.has(e.toLowerCase())) {
      seen.add(e.toLowerCase());
      entities.push(e);
    }
  }

  // Plain distinctive nouns (all-lowercase, ≥4 chars, not stop words)
  // Also allows kebab-case tokens (e.g. file-index, query-planner)
  const plainWords = text
    .replace(/[^a-zA-Z0-9\s_-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && /^[a-z][a-z-]*[a-z]$/.test(w) && !STOP_WORDS.has(w));
  for (const w of plainWords) {
    if (!seen.has(w)) {
      seen.add(w);
      entities.push(w);
    }
  }
  // Snake_case, camelCase, PascalCase, kebab-case identifiers
  const idPattern =
    /\b[a-zA-Z][a-zA-Z0-9]*(?:_[a-zA-Z0-9]+)+\b|\b[a-z]+(?:-[a-z]+)+\b|\b[a-z]+[A-Z][a-zA-Z0-9]*\b|\b[A-Z][a-z]+[A-Z][a-zA-Z0-9]*\b/g;
  for (const m of text.matchAll(idPattern)) {
    const e = m[0];
    if (!seen.has(e.toLowerCase()) && e.length >= 3) {
      seen.add(e.toLowerCase());
      entities.push(e);
    }
  }

  return entities;
}

function extractScopeHints(text: string): string[] {
  const hints: string[] = [];
  for (const m of text.matchAll(
    /(?:\.\.?\/|[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)+)/g,
  )) {
    const hint = m[0];
    if (!hint.startsWith(".") && !hint.includes("=") && hint.length >= 2) {
      hints.push(hint);
    }
  }
  return [...new Set(hints)];
}

function inferFilePatterns(text: string): string[] {
  const lower = text.toLowerCase();
  const patterns: string[] = [];
  for (const [keyword, exts] of Object.entries(EXT_PATTERNS)) {
    if (lower.includes(keyword)) patterns.push(...exts);
  }
  if (patterns.length === 0) {
    patterns.push(
      "*.ts",
      "*.tsx",
      "*.js",
      "*.jsx",
      "*.py",
      "*.go",
      "*.rs",
      "*.vue",
      "*.svelte",
    );
  }
  return [...new Set(patterns)];
}

function deriveSearchTerms(
  text: string,
  entities: string[],
): { grepTerms: string[]; avoidTerms: string[] } {
  const seen = new Set<string>();
  const grepTerms: string[] = [];
  const avoidTerms: string[] = [];

  // Entities as primary terms (keep snake_case intact)
  for (const e of entities) {
    const lower = e.toLowerCase();
    if (!seen.has(lower) && e.length >= 3) {
      seen.add(lower);
      grepTerms.push(e);
    }

    // Flag short components of snake_case / kebab-case as avoidTerms
    // Only flag parts ≤2 chars (e.g. "pi", "wt") to preserve 3-char domain terms ("api", "cli")
    const splitChars = e.includes("_") ? "_" : e.includes("-") ? "-" : null;
    if (splitChars) {
      for (const part of e.split(splitChars)) {
        if (part.length <= 2 && !seen.has(part.toLowerCase())) {
          seen.add(part.toLowerCase());
          avoidTerms.push(part.toLowerCase());
        }
      }
    }
  }

  // Distinctive words from query text
  const words = text
    .replace(/[^a-zA-Z0-9\s_-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w.toLowerCase()));

  for (const w of words) {
    const lower = w.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      grepTerms.push(w);
    }
  }

  return {
    grepTerms: grepTerms.slice(0, 8),
    avoidTerms: avoidTerms.slice(0, 5),
  };
}
