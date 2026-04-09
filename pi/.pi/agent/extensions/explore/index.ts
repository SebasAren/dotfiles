/**
 * Explore Subagent — delegate codebase exploration to a separate model
 *
 * Spawns a `pi` subprocess with read-only tools to investigate the codebase.
 * The model is configurable via CHEAP_MODEL env var.
 */

import * as path from "node:path";
import { type ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

import { resolveRealCwd, runSubagent, getModel } from "@pi-ext/shared";

import { EXPLORE_SYSTEM_PROMPT, EXPLORE_BASE_FLAGS } from "./constants";
import { renderCall, renderResult } from "./render";

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
      description: "How thorough to be: quick (20 calls), medium (40, default), thorough (80)",
    }),
  ),
  maxToolCalls: Type.Optional(
    Type.Number({ description: "Override the tool call limit (default: based on thoroughness)" }),
  ),
  timeoutMs: Type.Optional(
    Type.Number({
      description: "Override timeout in ms (default: 180000 for medium, 300000 for thorough)",
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
      "Use maxToolCalls to give the subagent more budget when thoroughness=thorough isn't enough (e.g. maxToolCalls=120).",
    ],
    parameters: ExploreParams,

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const realCwd = resolveRealCwd(ctx.cwd);
      const cwd = params.directory ? path.resolve(realCwd, params.directory) : realCwd;

      // Resolve thoroughness → budget
      const thoroughness = params.thoroughness || "medium";
      const defaultMaxCalls = thoroughness === "quick" ? 20 : thoroughness === "thorough" ? 80 : 40;
      const maxToolCalls = params.maxToolCalls ?? defaultMaxCalls;
      const defaultTimeout = thoroughness === "thorough" ? 300_000 : 180_000;
      const timeoutMs = params.timeoutMs ?? defaultTimeout;

      // Build query with constraints and optional focus files
      let query = params.query;
      query += `\n\n[Constraints: thoroughness=${thoroughness}, max ${maxToolCalls} tool calls]`;
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
        `Stop calling tools once you have enough information and write the summary. ` +
        `A final turn with only tool calls is a failed response.]`;

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
