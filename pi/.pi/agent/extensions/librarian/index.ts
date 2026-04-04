/**
 * Librarian Subagent — delegate documentation research to a separate model
 *
 * Spawns a `pi` subprocess with web_search (Exa) and context7 tools to research
 * external documentation. The model is configurable via:
 *   - Environment variable: CHEAP_MODEL (e.g. "xiaomi-mimo/mimo-v2-flash")
 *   - Falls back to the default model if not set
 *
 * The librarian agent uses web search and library docs tools and returns
 * structured findings without modifying any files.
 */

import {
  type ExtensionAPI,
  getMarkdownTheme,
} from "@mariozechner/pi-coding-agent";
import { Container, Markdown, Spacer, Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";

import {
  resolveRealCwd,
  parseSections,
  getSectionSummary,
  formatUsageLine,
  splitIntoSentences,
  runSubagent,
  getModel,
} from "@pi-ext/shared";

/** Env var set on child processes to prevent recursive librarian registration */
const CHILD_ENV_VAR = "PI_LIBRARIAN_CHILD";

const LIBRARIAN_SYSTEM_PROMPT = `You are a documentation librarian. Your job is to research external documentation and return structured, actionable findings.

You have access to these tools:
- **web_search**: Search the web via Exa for current information, tutorials, guides, and documentation
- **web_fetch**: Fetch and parse full page content from URLs (text, highlights, or summary)
- **context7_search**: Search for libraries in the Context7 database to find library IDs
- **context7_docs**: Fetch up-to-date documentation and code examples for a specific library

You do NOT have filesystem tools. Do NOT attempt to read, write, or edit files.

Research strategy:
1. If the query mentions a specific library, start with context7_search to find it
2. Use context7_docs to fetch relevant documentation snippets
3. Use web_search for supplementary information: tutorials, blog posts, changelogs, comparisons
4. After web_search, use web_fetch on the most relevant result URLs to get full page content
5. Use web_fetch directly when you have a known documentation URL to read
6. If initial results are insufficient, refine your search and try again
7. Cross-reference multiple sources when possible
8. Maximum 20 tool calls total. Stop and summarize once you have enough information.

Output format:

## Sources
List all sources consulted:
1. \`Library/API name\` — brief description of what was found

## Documentation
The actual documentation content, organized by topic:
- Include relevant API signatures, types, and interfaces
- Include code examples where available
- Note version-specific information if found

## Key Findings
Concise summary answering the research query with specific details.

## Recommendations
If applicable, suggest best practices or patterns discovered from the documentation.`;

/** Base CLI flags for the librarian subagent.
 *  We omit --no-extensions so that the exa-search and context7 extensions load,
 *  providing web_search, context7_search, and context7_docs tools.
 *  We use --no-tools to skip built-in filesystem tools since the librarian only
 *  needs external documentation tools. */
const LIBRARIAN_BASE_FLAGS = [
  "--no-session",
  "--no-tools",
  "--no-skills",
  "--no-prompt-templates",
];

const LibrarianParams = Type.Object({
  query: Type.String({
    description:
      "What documentation or information to look for. Be specific about what you need.",
  }),
  library: Type.Optional(
    Type.String({
      description:
        "Specific library or framework name to search for (e.g., 'react', 'next.js', 'tanstack-query')",
    }),
  ),
  focus: Type.Optional(
    Type.String({
      description:
        "What to focus on: docs, examples, api, best-practices, or changelog",
    }),
  ),
});

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
    promptSnippet:
      "Research external documentation using web search and Context7",
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

      const result = await runSubagent({
        cwd: realCwd,
        query,
        systemPrompt: LIBRARIAN_SYSTEM_PROMPT,
        baseFlags: LIBRARIAN_BASE_FLAGS,
        timeoutMs: 180_000, // 3 minutes — documentation research can take longer
        signal,
        onUpdate: onUpdate
          ? (text) => {
              onUpdate({
                content: [{ type: "text", text }],
                details: { model: getModel(), query: params.query },
              });
            }
          : undefined,
        loopDetection: true,
        maxToolCalls: 20,
        tmux: { label: "librarian" },
        tmpPrefix: "pi-librarian-",
        debugLabel: "librarian",
        env: { [CHILD_ENV_VAR]: "1" },
      });

      const isError = result.exitCode !== 0 || !!result.errorMessage;
      if (isError) {
        const errorMsg =
          result.errorMessage ||
          result.stderr ||
          result.output ||
          "(no output)";
        // Provide helpful error for missing API keys
        if (
          errorMsg.includes("EXA_API_KEY") ||
          errorMsg.includes("CONTEXT7_API_KEY")
        ) {
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
      const model = getModel();
      const preview =
        args.query.length > 80 ? `${args.query.slice(0, 80)}...` : args.query;
      let content =
        theme.fg("toolTitle", theme.bold("librarian ")) +
        (model ? theme.fg("muted", `[${model}] `) : "") +
        theme.fg("dim", preview);
      if (args.library) {
        content += `\n  ${theme.fg("accent", args.library)}`;
      }
      if (args.focus) {
        content += theme.fg("muted", ` · focus: ${args.focus}`);
      }
      // Reuse existing component if available to avoid duplicate renders
      const text =
        (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
      text.setText(content);
      return text;
    },

    renderResult(result, { expanded, isPartial }, theme, _context) {
      const details = result.details as
        | {
            model?: string;
            usedModel?: string;
            query?: string;
            library?: string;
            focus?: string;
            success?: boolean;
            usage?: {
              input: number;
              output: number;
              turns: number;
              cost: number;
              contextTokens: number;
            };
          }
        | undefined;

      const text = result.content[0];
      const output = text?.type === "text" ? text.text : "(no output)";
      const isError = details?.success === false;
      const icon = isError ? theme.fg("error", "✗") : theme.fg("success", "✓");
      const sections = parseSections(output);

      // Streaming/partial: show progress with parsed sections so far
      if (isPartial) {
        if (sections.length === 0) {
          return new Text(theme.fg("warning", "⏳ researching..."), 0, 0);
        }
        let content =
          theme.fg("warning", "⏳ ") +
          theme.fg("toolTitle", theme.bold("librarian"));
        for (const section of sections) {
          const summary = getSectionSummary(section.content);
          content += `\n  ${theme.fg("muted", `${section.title}:`)} ${theme.fg("dim", summary)}`;
        }
        return new Text(content, 0, 0);
      }

      const mdTheme = getMarkdownTheme();

      if (expanded) {
        const container = new Container();
        container.addChild(
          new Text(
            `${icon} ${theme.fg("toolTitle", theme.bold("librarian"))}`,
            0,
            0,
          ),
        );
        if (details?.query) {
          let header =
            theme.fg("muted", "Query: ") + theme.fg("dim", details.query);
          if (details.library)
            header +=
              theme.fg("muted", ` · Library: `) +
              theme.fg("accent", details.library);
          if (details.focus)
            header +=
              theme.fg("muted", ` · Focus: `) + theme.fg("dim", details.focus);
          container.addChild(new Text(header, 0, 0));
        }

        if (isError) {
          container.addChild(new Spacer(1));
          container.addChild(new Text(theme.fg("error", output), 0, 0));
        } else if (sections.length > 0) {
          for (const section of sections) {
            container.addChild(new Spacer(1));
            container.addChild(
              new Text(theme.fg("muted", `─── ${section.title} ───`), 0, 0),
            );
            if (section.content) {
              container.addChild(new Markdown(section.content, 0, 0, mdTheme));
            }
          }
        } else {
          container.addChild(new Spacer(1));
          container.addChild(new Markdown(output.trim(), 0, 0, mdTheme));
        }

        if (details?.usage) {
          const usageLine = formatUsageLine(details.usage, details.usedModel);
          if (usageLine) {
            container.addChild(new Spacer(1));
            container.addChild(new Text(theme.fg("dim", usageLine), 0, 0));
          }
        }
        return container;
      }

      // Collapsed: structured section summaries
      let rendered = `${icon} ${theme.fg("toolTitle", theme.bold("librarian"))}`;

      if (isError) {
        const errorPreview =
          output.length > 120 ? `${output.slice(0, 120)}...` : output;
        rendered += `\n  ${theme.fg("error", errorPreview)}`;
      } else if (sections.length > 0) {
        for (const section of sections) {
          const summary = getSectionSummary(section.content);
          rendered += `\n  ${theme.fg("muted", `${section.title}:`)} ${theme.fg("dim", summary)}`;
        }
      } else {
        // Fallback for unstructured output - use shared sentence parser
        const sentences = splitIntoSentences(output);

        if (sentences.length === 0) {
          const preview = output.length > 150 ? `${output.slice(0, 150)}...` : output;
          rendered += `\n  ${theme.fg("dim", preview)}`;
        } else {
          const maxItems = Math.min(sentences.length, 4);
          for (let i = 0; i < maxItems; i++) {
            rendered += `\n  ${theme.fg("muted", "•")} ${theme.fg("dim", sentences[i].text)}`;
          }
          if (sentences.length > 4) {
            rendered += `\n  ${theme.fg("muted", `... +${sentences.length - 4} more`)}`;
          }
        }
      }

      if (details?.usage) {
        const usageLine = formatUsageLine(details.usage, details.usedModel);
        if (usageLine) rendered += `\n  ${theme.fg("dim", usageLine)}`;
      }
      rendered += `\n  ${theme.fg("muted", "(Ctrl+O to expand)")}`;
      return new Text(rendered, 0, 0);
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
