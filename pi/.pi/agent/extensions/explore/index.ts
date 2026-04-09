/**
 * Explore Subagent — delegate codebase exploration to a separate model
 *
 * Spawns a `pi` subprocess with read-only tools to investigate the codebase.
 * The model is configurable via CHEAP_MODEL env var.
 */

import { spawn } from "node:child_process";
import * as path from "node:path";
import { type ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

import { resolveRealCwd, runSubagent, getModel } from "@pi-ext/shared";

import { EXPLORE_SYSTEM_PROMPT, EXPLORE_BASE_FLAGS } from "./constants";
import { renderCall, renderResult } from "./render";

// ── Pre-search ─────────────────────────────────────────────────────────────

/** Common English stop words to exclude from search terms. */
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

/** Extract 2-5 search terms from a natural language query. */
function extractSearchTerms(query: string): string[] {
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

/** File extensions to include in pre-search grep. */
const GREP_INCLUDES = [
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
  .map((e) => `--include=${e}`)
  .join(" ");

/** Run grep before spawning subagent to give it a head start on file discovery. */
async function preSearch(cwd: string, rawQuery: string): Promise<string> {
  const terms = extractSearchTerms(rawQuery);
  if (terms.length === 0) return "";

  const seen = new Set<string>();

  const runCmd = (cmd: string, args: string[]): Promise<string> =>
    new Promise((resolve) => {
      const proc = spawn(cmd, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
      proc.stdin.end();
      let out = "";
      proc.stdout.on("data", (d: Buffer) => (out += d));
      proc.stderr.on("data", () => {});
      const timer = setTimeout(() => proc.kill(), 5000);
      proc.on("close", () => {
        clearTimeout(timer);
        resolve(out);
      });
      proc.on("error", () => {
        clearTimeout(timer);
        resolve("");
      });
    });

  // Run greps for top 3 terms in parallel
  const searches = terms.slice(0, 3).map(async (term) => {
    const escaped = term.replace(/'/g, "'\\''");
    const out = await runCmd("sh", [
      "-c",
      `grep -rl ${GREP_INCLUDES} '${escaped}' . 2>/dev/null | head -20`,
    ]);
    if (!out.trim()) return null;
    const files = out
      .trim()
      .split("\n")
      .filter((f) => !seen.has(f));
    files.forEach((f) => seen.add(f));
    return files.length > 0 ? `"${term}": ${files.join(", ")}` : null;
  });

  const results = (await Promise.all(searches)).filter(Boolean) as string[];
  if (results.length === 0) return "";

  return (
    `\n\n[PRE-SEARCH RESULTS — grep already found these files. ` +
    `Read them directly, do NOT re-search.]\n${results.join("\n")}`
  );
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface ExploreDetails {
  model?: string;
  usedModel?: string;
  query?: string;
  success?: boolean;
  usage?: { input: number; output: number; turns: number; cost: number; contextTokens: number };
  [key: string]: unknown;
}

// ── Tool parameters ────────────────────────────────────────────────────────

const ExploreParams = Type.Object({
  query: Type.String({
    description: "What to explore in the codebase. Be specific about what you're looking for.",
  }),
  directory: Type.Optional(
    Type.String({ description: "Directory to explore (defaults to current working directory)" }),
  ),
  thoroughness: Type.Optional(
    Type.String({
      description: "How thorough to be: quick (40 calls), medium (80, default), thorough (160)",
    }),
  ),
  maxToolCalls: Type.Optional(
    Type.Number({ description: "Override the tool call limit (default: based on thoroughness)" }),
  ),
  timeoutMs: Type.Optional(
    Type.Number({
      description: "Override timeout in ms (default: 300000 for medium, 600000 for thorough)",
    }),
  ),
  files: Type.Optional(
    Type.Array(Type.String(), {
      description:
        "Known file paths to focus on (for deepening after a scout pass). The subagent will prioritize these files.",
    }),
  ),
});

// ── Extension ──────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "explore",
    label: "Explore",
    description: [
      "Delegate codebase exploration to a subagent running on a separate (cheaper/faster) model.",
      "Useful for reconnaissance: finding files, tracing dependencies, understanding architecture.",
      "The explore agent is read-only — it cannot modify files.",
      "Configure the model via CHEAP_MODEL env var (e.g. 'xiaomi-mimo/mimo-v2-flash').",
      "You may call explore up to 4 times in parallel to investigate different aspects of the codebase simultaneously.",
    ].join(" "),
    promptSnippet:
      "Explore the codebase to find files, trace dependencies, or understand architecture",
    promptGuidelines: [
      "Use explore for codebase reconnaissance — finding relevant files, tracing imports, understanding structure.",
      "Prefer explore over multiple read/grep calls when you need to broadly investigate an unfamiliar area.",
      "Call explore up to 4 times in parallel when investigating multiple independent aspects of the codebase (e.g. different modules, different concerns).",
      "Write specific, keyword-rich queries. Bad: 'explore the codebase'. Good: 'tmux wt worktrunk integration pane_current_path'.",
      "Provide a directory hint when you know where to look. Use the directory parameter to scope the search (e.g. 'tmux/.config/tmux/scripts/').",
      "For large codebases, use a scout-then-deepen pattern: first explore with quick thoroughness to find relevant files, then call explore again with 'files' set to the discovered paths and thoroughness=thorough.",
      "Defaults: quick=40 calls/5min, medium=80 calls/5min, thorough=160 calls/10min. Failures are rare — if you see one, use maxToolCalls to increase the budget.",
    ],
    parameters: ExploreParams,

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const realCwd = resolveRealCwd(ctx.cwd);
      const cwd = params.directory ? path.resolve(realCwd, params.directory) : realCwd;

      // Resolve thoroughness → budget
      const thoroughness = params.thoroughness || "medium";
      const defaultMaxCalls =
        thoroughness === "quick" ? 40 : thoroughness === "thorough" ? 160 : 80;
      const maxToolCalls = params.maxToolCalls ?? defaultMaxCalls;
      const defaultTimeout = thoroughness === "thorough" ? 600_000 : 300_000;
      const timeoutMs = params.timeoutMs ?? defaultTimeout;

      // Pre-search: run grep before spawning the subagent to give it a head start
      const preSearchResults = await preSearch(cwd, params.query);

      // Build query with constraints and optional focus files
      let query = params.query + preSearchResults;
      const summaryThreshold = Math.floor(maxToolCalls * 0.75);
      query += `\n\n[Constraints: thoroughness=${thoroughness}, max ${maxToolCalls} tool calls]`;
      query +=
        `\n[BUDGET RULE: You MUST start writing your summary by call #${summaryThreshold}. ` +
        `After ${summaryThreshold} calls, STOP calling tools and write the summary. ` +
        `You may use up to ${maxToolCalls} calls total, but the LAST ${maxToolCalls - summaryThreshold} must be your summary text.]`;
      if (params.directory) {
        query += `\n[Scope: only look in ${params.directory}]`;
      }
      if (params.files && params.files.length > 0) {
        query += `\n[Focus files: start by reading these known-relevant files, then explore outward if needed]`;
        query += `\n${params.files.map((f) => `- ${f}`).join("\n")}`;
      }
      query +=
        `\n\n[CRITICAL: Your final assistant turn MUST contain a plain-text message with ` +
        `## Files Retrieved, ## Key Code, and ## Summary sections. ` +
        `A final turn with only tool calls is a FAILED response. ` +
        `Write the summary NOW if you have ANY relevant information, even if incomplete.]`;

      const result = await runSubagent({
        cwd,
        query,
        systemPrompt: EXPLORE_SYSTEM_PROMPT,
        baseFlags: EXPLORE_BASE_FLAGS,
        timeoutMs,
        signal,
        onUpdate: onUpdate
          ? (update) => {
              onUpdate({
                content: [{ type: "text", text: update.text }],
                details: { model: getModel(), query, recentCalls: update.recentCalls },
              });
            }
          : undefined,
        loopDetection: true,
        maxToolCalls,
        tmpPrefix: "pi-explore-",
      });

      const isError = result.exitCode !== 0 || !!result.errorMessage;
      if (isError) {
        const errorMsg = result.errorMessage || result.stderr || result.output || "(no output)";
        return {
          content: [{ type: "text" as const, text: `Explore failed: ${errorMsg}` }],
          details: { model: getModel(), query, usage: result.usage, success: false },
        } as any;
      }

      return {
        content: [{ type: "text" as const, text: result.output || "(no output)" }],
        details: {
          model: getModel(),
          usedModel: result.model,
          query,
          usage: result.usage,
          success: true,
        },
      };
    },

    renderCall(args, theme, context) {
      return renderCall(args, theme, context, getModel());
    },

    renderResult(result, state, theme, context) {
      return renderResult(result as any, state, theme, context);
    },
  });

  // Register /explore command for interactive use
  pi.registerCommand("explore", {
    description: "Run explore subagent interactively",
    handler: async (args, ctx) => {
      if (!args.trim()) {
        ctx.ui.notify("Usage: /explore <query>", "info");
        return;
      }
      // Send as a prompt that triggers the explore tool
      pi.sendUserMessage(`Use the explore tool to investigate: ${args}`, {
        deliverAs: ctx.isIdle() ? undefined : "followUp",
      });
    },
  });
}
