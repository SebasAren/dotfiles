/**
 * Librarian Subagent — delegate documentation research to a separate model
 *
 * Spawns a `pi` subprocess with web_search (Exa) and context7 tools to research
 * external documentation. The model is configurable via CHEAP_MODEL env var.
 */

import { type ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

import { resolveRealCwd, runSubagent, getModel } from "@pi-ext/shared";

import { LIBRARIAN_SYSTEM_PROMPT, LIBRARIAN_BASE_FLAGS, CHILD_ENV_VAR } from "./constants";
import { renderCall, renderResult } from "./render";

// ── Types ──────────────────────────────────────────────────────────────────

export interface LibrarianDetails {
  model?: string;
  usedModel?: string;
  query?: string;
  library?: string;
  focus?: string;
  success?: boolean;
  usage?: { input: number; output: number; turns: number; cost: number; contextTokens: number };
  [key: string]: unknown;
}

// ── Tool parameters ────────────────────────────────────────────────────────

const LibrarianParams = Type.Object({
  query: Type.String({
    description: "What documentation or information to look for. Be specific about what you need.",
  }),
  library: Type.Optional(
    Type.String({
      description:
        "Specific library or framework name to search for (e.g., 'react', 'next.js', 'tanstack-query')",
    }),
  ),
  focus: Type.Optional(
    Type.String({
      description: "What to focus on: docs, examples, api, best-practices, or changelog",
    }),
  ),
  maxToolCalls: Type.Optional(
    Type.Number({ description: "Override the tool call limit (default: 60)" }),
  ),
  timeoutMs: Type.Optional(
    Type.Number({ description: "Override timeout in ms (default: 240000)" }),
  ),
});

// ── Extension ──────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // Prevent recursive registration in child subagent processes
  if (process.env[CHILD_ENV_VAR] === "1") {
    return;
  }

  pi.registerTool({
    name: "librarian",
    label: "Librarian",
    description: [
      "Delegate documentation research to a subagent with access to web search (Exa) and library documentation (Context7).",
      "Useful for looking up APIs, finding examples, checking best practices, and reading external docs.",
      "The librarian agent can search the web and fetch up-to-date library documentation.",
      "You may call librarian up to 4 times in parallel to research different topics simultaneously.",
    ].join(" "),
    promptSnippet: "Research external documentation using web search and Context7",
    promptGuidelines: [
      "Use librarian when you need up-to-date documentation, API references, or examples from external sources.",
      "Prefer librarian over web_search directly when you need the agent to synthesize findings from multiple sources.",
      "Call librarian up to 4 times in parallel when researching multiple independent topics or libraries.",
      "Requires EXA_API_KEY and/or CONTEXT7_API_KEY environment variables to be set.",
    ],
    parameters: LibrarianParams,

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const realCwd = resolveRealCwd(ctx.cwd);
      // Build a focused query incorporating library and focus if provided
      let query = params.query;
      if (params.library) {
        query = `Research the ${params.library} library: ${query}`;
      }
      if (params.focus) {
        query += ` Focus on ${params.focus}.`;
      }
      query +=
        `\n\n[CRITICAL: Your final assistant turn MUST contain a plain-text message with ` +
        `## Sources, ## Documentation, ## Key Findings, and ## Recommendations sections. ` +
        `Stop calling tools once you have enough information and write the summary. ` +
        `A final turn with only tool calls is a failed response.]`;

      const maxToolCalls = params.maxToolCalls ?? 60;
      const timeoutMs = params.timeoutMs ?? 240_000;

      const result = await runSubagent({
        cwd: realCwd,
        query,
        systemPrompt: LIBRARIAN_SYSTEM_PROMPT,
        baseFlags: LIBRARIAN_BASE_FLAGS,
        timeoutMs,
        signal,
        onUpdate: onUpdate
          ? (update) => {
              onUpdate({
                content: [{ type: "text", text: update.text }],
                details: {
                  model: getModel(),
                  query: params.query,
                  recentCalls: update.recentCalls,
                },
              });
            }
          : undefined,
        loopDetection: true,
        maxToolCalls,
        tmpPrefix: "pi-librarian-",
        debugLabel: "librarian",
        env: { [CHILD_ENV_VAR]: "1" },
      });

      const isError = result.exitCode !== 0 || !!result.errorMessage;
      if (isError) {
        const errorMsg = result.errorMessage || result.stderr || result.output || "(no output)";
        // Provide helpful error for missing API keys
        if (errorMsg.includes("EXA_API_KEY") || errorMsg.includes("CONTEXT7_API_KEY")) {
          return {
            content: [
              {
                type: "text",
                text:
                  `Librarian requires API keys. Set environment variables:\n` +
                  `  export EXA_API_KEY='your-key'          # For web search\n` +
                  `  export CONTEXT7_API_KEY='your-key'     # For library docs\n` +
                  `\nOriginal error: ${errorMsg}`,
              },
            ],
            details: {
              model: getModel(),
              query: params.query,
              usage: result.usage,
              success: false,
            },
          };
        }
        return {
          content: [{ type: "text", text: `Librarian failed: ${errorMsg}` }],
          details: {
            model: getModel(),
            query: params.query,
            usage: result.usage,
            success: false,
          },
        };
      }

      return {
        content: [{ type: "text", text: result.output || "(no output)" }],
        details: {
          model: getModel(),
          usedModel: result.model,
          query: params.query,
          library: params.library,
          focus: params.focus,
          usage: result.usage,
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

  // Register /librarian command for interactive use
  pi.registerCommand("librarian", {
    description: "Research external documentation interactively",
    handler: async (args, ctx) => {
      if (!args.trim()) {
        ctx.ui.notify(
          "Usage: /librarian <query>  (e.g. /librarian how to use React Server Components)",
          "info",
        );
        return;
      }
      pi.sendUserMessage(`Use the librarian tool to research: ${args}`, {
        deliverAs: ctx.isIdle() ? undefined : "followUp",
      });
    },
  });
}
