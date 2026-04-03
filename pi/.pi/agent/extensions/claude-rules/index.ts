// Claude Rules Extension
//
// Reads Claude Code-style path-scoped rules from `.claude/rules/*.md`.
// Each rule file can have YAML frontmatter with a `globs` field (list of
// path patterns). When the agent reads/writes/edits a file that matches a
// rule's globs, the rule content is automatically injected into the LLM
// context alongside the tool result.
//
// Rule files without globs are always included in the system prompt.
//
// Rule file format:
//   globs: ["*.ts", "src/**/*.tsx"]
//   description: TypeScript coding standards
//
// Supports both inline arrays (`globs: ["*.ts"]`) and multi-line YAML arrays.
// Frontmatter fields: `globs` (string|string[]), `description` (string).

import * as fs from "node:fs";
import * as path from "node:path";
import picomatch from "picomatch";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// ── Types ──────────────────────────────────────────────────────────────

interface ClaudeRule {
  /** Relative path from project root, e.g. ".claude/rules/typescript.md" */
  filePath: string;
  /** Human-readable description (from frontmatter, defaults to filename) */
  description: string;
  /** Compiled matchers for path-scoped rules */
  matchers: Array<(p: string) => boolean>;
  /** The rule body (everything after the frontmatter) */
  body: string;
}

// ── Frontmatter parser ─────────────────────────────────────────────────

/**
 * Parse an inline JSON-like array value: ["a", "b", "c"]
 */
function parseInlineArray(value: string): string[] | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed))
      return parsed.filter((v) => typeof v === "string");
  } catch {
    // Not valid JSON, fall through
  }
  return null;
}

/**
 * Parse YAML frontmatter from a markdown string.
 * Returns { frontmatter: Record<string, unknown>, body: string }.
 * Handles missing frontmatter gracefully.
 */
function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const raw = match[1];
  const body = match[2];
  const frontmatter: Record<string, unknown> = {};

  // Minimal YAML parser — handles the flat key-value pairs and arrays that
  // Claude Code uses. Not a full YAML parser but sufficient for frontmatter.
  const lines = raw.split(/\r?\n/);
  let currentKey: string | null = null;
  let currentArray: string[] | null = null;

  for (const line of lines) {
    // Array item: - "value" or - 'value' or - value
    const arrayMatch = line.match(/^\s*-\s*(?:["'](.+?)["']|(.+))$/);
    if (arrayMatch && currentArray !== null) {
      currentArray.push((arrayMatch[1] ?? arrayMatch[2]).trim());
      continue;
    }

    // Key: value
    const kvMatch = line.match(/^(\w[\w-]*)\s*:\s*(?:["'](.+?)["']|(.+))?$/);
    if (kvMatch) {
      // Flush previous array
      if (currentKey && currentArray !== null) {
        frontmatter[currentKey] = currentArray;
      }

      currentKey = kvMatch[1];
      const value = kvMatch[2] ?? kvMatch[3];

      if (value === undefined || value === "") {
        // Start of a multi-line array
        currentArray = [];
      } else {
        // Try to parse as inline array first
        const inlineArray = parseInlineArray(value.trim());
        if (inlineArray) {
          frontmatter[currentKey] = inlineArray;
        } else {
          frontmatter[currentKey] = value.trim();
        }
        currentArray = null;
      }
      continue;
    }
  }

  // Flush last array
  if (currentKey && currentArray !== null) {
    frontmatter[currentKey] = currentArray;
  }

  return { frontmatter, body };
}

// ── Rule loading ───────────────────────────────────────────────────────

/**
 * Recursively find all .md files under a directory.
 */
function findMarkdownFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Create a matcher function for a glob pattern.
 * Patterns without slashes use matchBase (match basename anywhere).
 * Patterns with slashes match against the full relative path.
 */
function createMatcher(glob: string): (p: string) => boolean {
  const hasSlash = glob.includes("/");
  const pm = picomatch(glob, {
    dot: true,
    matchBase: !hasSlash,
  });
  return (filePath: string) => pm(filePath);
}

/**
 * Load all Claude rules from `.claude/rules/`.
 */
function loadRules(projectRoot: string): ClaudeRule[] {
  const rulesDir = path.join(projectRoot, ".claude", "rules");
  const files = findMarkdownFiles(rulesDir);
  const rules: ClaudeRule[] = [];

  for (const fullPath of files) {
    try {
      const raw = fs.readFileSync(fullPath, "utf-8");
      const { frontmatter, body } = parseFrontmatter(raw);
      const relativePath = path.relative(projectRoot, fullPath);

      // Normalize globs to string array
      let globs: string[] = [];
      if (frontmatter.globs) {
        if (typeof frontmatter.globs === "string") {
          // Could be a single glob or inline JSON array
          const inlineArray = parseInlineArray(frontmatter.globs);
          globs = inlineArray ?? [frontmatter.globs];
        } else if (Array.isArray(frontmatter.globs)) {
          globs = frontmatter.globs.filter(
            (g): g is string => typeof g === "string",
          );
        }
      }

      // Build compiled matchers
      const matchers = globs.map(createMatcher);

      const description =
        typeof frontmatter.description === "string"
          ? frontmatter.description
          : path.basename(fullPath, ".md");

      rules.push({
        filePath: relativePath,
        description,
        matchers,
        body: body.trim(),
      });
    } catch (err) {
      console.error(`[claude-rules] Failed to parse ${fullPath}: ${err}`);
    }
  }

  return rules;
}

// ── Extension ──────────────────────────────────────────────────────────

export default function claudeRulesExtension(pi: ExtensionAPI) {
  let rules: ClaudeRule[] = [];
  let projectRoot: string = "";
  /**
   * Track which rules have been injected to avoid duplicates.
   * Maps ruleFilePath -> toolCallId of the tool_result where it was injected.
   * Used to check if an injection is still in the current branch after tree navigation.
   */
  const injectedRules = new Map<string, string>();

  pi.on("session_start", async (_event, ctx) => {
    projectRoot = ctx.cwd;
    rules = loadRules(projectRoot);
    injectedRules.clear();

    if (rules.length === 0) return;

    const scoped = rules.filter((r) => r.matchers.length > 0);
    const global = rules.filter((r) => r.matchers.length === 0);

    if (ctx.hasUI) {
      const parts: string[] = [];
      if (global.length > 0) parts.push(`${global.length} global`);
      if (scoped.length > 0) parts.push(`${scoped.length} path-scoped`);
      ctx.ui.notify(
        `Loaded ${rules.length} rule(s) from .claude/rules/: ${parts.join(", ")}`,
        "info",
      );
    }
  });

  // Inject global (non-scoped) rules into the system prompt
  pi.on("before_agent_start", async (event) => {
    const globalRules = rules.filter((r) => r.matchers.length === 0);
    if (globalRules.length === 0) return;

    const rulesText = globalRules
      .map((r) => `### ${r.description}\n(Source: ${r.filePath})\n\n${r.body}`)
      .join("\n\n---\n\n");

    return {
      systemPrompt:
        event.systemPrompt +
        `\n\n## Project Rules (.claude/rules)\n\nThe following rules always apply to this project:\n\n${rulesText}\n`,
    };
  });

  // Inject path-scoped rules when matching files are read/written/edited
  pi.on("tool_result", async (event) => {
    const relevantTools = new Set(["read", "write", "edit"]);
    if (!relevantTools.has(event.toolName)) return;

    const input = event.input as { path?: string } | undefined;
    const filePath = input?.path;
    if (!filePath || typeof filePath !== "string") return;

    // Resolve to absolute, then make relative to project root for matching
    const absolutePath = path.resolve(projectRoot, filePath);
    const relativePath = path.relative(projectRoot, absolutePath);

    // Find matching rules that haven't been injected yet
    const matchingRules = rules.filter(
      (r) =>
        r.matchers.length > 0 &&
        !injectedRules.has(r.filePath) &&
        r.matchers.some((match) => match(relativePath)),
    );

    if (matchingRules.length === 0) return;

    // Mark as injected, keyed by toolCallId for tree navigation checks
    for (const r of matchingRules) {
      injectedRules.set(r.filePath, event.toolCallId);
    }

    // Build the appendix
    const appendix = matchingRules
      .map(
        (r) =>
          `<rule file="${r.filePath}" description="${r.description}">\n${r.body}\n</rule>`,
      )
      .join("\n\n");

    const ruleNotice = `\n\n---\n**📋 Path-scoped rules matched for \`${relativePath}\`:**\n\n${appendix}`;

    // Append to existing content
    const existingContent = event.content ?? [];
    return {
      content: [
        ...existingContent,
        { type: "text" as const, text: ruleNotice },
      ],
    };
  });

  // Compaction summarizes away previous injections — always clear all
  pi.on("session_compact", async () => {
    injectedRules.clear();
  });

  // Tree navigation may branch to a point before some injections.
  // Only clear rules whose injection entry is no longer in the branch.
  pi.on("session_tree", async (_event, ctx) => {
    const branchEntries = ctx.sessionManager.getBranch();
    const branchToolCallIds = new Set<string>();
    for (const entry of branchEntries) {
      if (
        entry.type === "message" &&
        entry.message?.role === "toolResult" &&
        entry.message?.toolCallId
      ) {
        branchToolCallIds.add(entry.message.toolCallId);
      }
    }
    for (const [rulePath, toolCallId] of injectedRules) {
      if (!branchToolCallIds.has(toolCallId)) {
        injectedRules.delete(rulePath);
      }
    }
  });
}
