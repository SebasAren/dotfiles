/**
 * TDD Tree Integration
 *
 * Bridges TDD plan execution with pi's session tree feature.
 * Provides tools to label a "kickoff" point (the exploration state)
 * and navigate back to it for each new TDD step.
 *
 * Tools:
 *   tdd-set-kickoff  — Label the current session leaf as the kickoff point
 *   tdd-go-kickoff   — Navigate to the labeled kickoff point (command)
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { type Component, Text } from "@mariozechner/pi-tui";
import { Type } from "typebox";
import { reuseOrCreateText } from "@pi-ext/shared";

// ── Helpers ────────────────────────────────────────────────────────────────

function kickoffLabel(slug: string): string {
  return `tdd-kickoff-${slug}`;
}

/** Find the entry ID that has a given label. */
function findLabeledEntry(ctx: ExtensionContext, label: string): string | undefined {
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type === "custom" || entry.type === "message" || entry.type === "branch_summary") {
      const entryLabel = ctx.sessionManager.getLabel(entry.id);
      if (entryLabel === label) return entry.id;
    }
  }
  return undefined;
}

// ── Extension ──────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // Track kickoff entries: slug → entryId (reconstructed on session_start)
  const kickoffEntries = new Map<string, string>();

  // Reconstruct state from session entries
  pi.on("session_start", async (_event, ctx) => {
    kickoffEntries.clear();
    for (const entry of ctx.sessionManager.getEntries()) {
      if (entry.type === "custom" && entry.customType === "tdd-kickoff") {
        const data = entry.data as { slug?: string; entryId?: string } | undefined;
        if (data?.slug && data?.entryId) {
          kickoffEntries.set(data.slug, data.entryId);
        }
      }
    }
  });

  // ── Tool: tdd-set-kickoff ──────────────────────────────────────────────

  pi.registerTool({
    name: "tdd-set-kickoff",
    label: "Set TDD Kickoff",
    description:
      "Label the current session position as the TDD kickoff point for a plan. " +
      "Call this after the initial codebase exploration completes. " +
      "Each subsequent TDD step can then branch from this point.",
    promptSnippet: "Label the current session position as the TDD kickoff checkpoint",
    promptGuidelines: [
      "Call tdd-set-kickoff exactly once per plan, after the explore phase completes, before starting Step 1.",
      "This creates a single labeled checkpoint in the session tree that all steps can branch from.",
      "Use tdd-go-kickoff (via /tdd-go-kickoff <slug>) to navigate back to this existing point for fresh steps.",
      "Never call tdd-set-kickoff more than once per plan.",
    ],
    parameters: Type.Object({
      slug: Type.String({
        description: "The plan slug (e.g. 'user-auth'). Must match the tdd-plan slug.",
      }),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const leafId = ctx.sessionManager.getLeafId();
      if (!leafId) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No session content yet. Run exploration first before setting kickoff.",
            },
          ],
          details: { success: false },
        };
      }

      const label = kickoffLabel(params.slug);

      // Prevent multiple kickoff points for the same slug
      if (kickoffEntries.has(params.slug)) {
        return {
          content: [
            {
              type: "text" as const,
              text: `A kickoff point already exists for "${params.slug}". Use /tdd-go-kickoff ${params.slug} to navigate to it instead of creating a new one.`,
            },
          ],
          details: { success: false, error: "kickoff_already_exists" },
        };
      }

      // Set the label on the current leaf
      pi.setLabel(leafId, label);

      // Store a custom entry for persistence across sessions
      pi.appendEntry("tdd-kickoff", {
        slug: params.slug,
        entryId: leafId,
        labeledAt: new Date().toISOString(),
      });

      // Track in memory
      kickoffEntries.set(params.slug, leafId);

      return {
        content: [
          {
            type: "text" as const,
            text:
              `TDD kickoff point set for plan "${params.slug}".\n` +
              `Entry: ${leafId}\n` +
              `Label: ${label}\n\n` +
              `Each TDD step can now branch from this point using /tdd-go-kickoff ${params.slug}.`,
          },
        ],
        details: { slug: params.slug, entryId: leafId, label },
      };
    },

    renderCall(args, theme, context): Component {
      const preview = `Setting TDD kickoff for "${args.slug}"...`;
      const text = reuseOrCreateText(context);
      text.setText(theme.fg("muted", `🏷️  ${preview}`));
      return text;
    },

    renderResult(result, _state, theme): Component {
      const details = result.details as { success?: boolean; slug?: string } | undefined;
      if (details?.success === false) {
        return new Text(theme.fg("error", "❌ Failed to set kickoff point"));
      }
      return new Text(theme.fg("accent", `✅ Kickoff set for "${details?.slug ?? "plan"}"`));
    },
  });

  // ── Command: tdd-go-kickoff ────────────────────────────────────────────

  pi.registerCommand("tdd-go-kickoff", {
    description: "Navigate to the TDD kickoff point for a plan (branches from exploration state)",
    handler: async (args, ctx) => {
      const slug = args.trim();
      if (!slug) {
        ctx.ui.notify("Usage: /tdd-go-kickoff <slug>", "info");
        return;
      }

      const label = kickoffLabel(slug);

      // Try to find from tracked entries first, then scan
      let targetId = kickoffEntries.get(slug);
      if (!targetId) {
        targetId = findLabeledEntry(ctx, label);
      }

      if (!targetId) {
        ctx.ui.notify(
          `No kickoff point found for "${slug}". Run exploration and use tdd-set-kickoff first.`,
          "error",
        );
        return;
      }

      // Check if we're already at the kickoff point
      const currentLeaf = ctx.sessionManager.getLeafId();
      if (currentLeaf === targetId) {
        ctx.ui.notify("Already at the kickoff point.", "info");
        return;
      }

      // Navigate with summarization
      const result = await ctx.navigateTree(targetId, {
        summarize: true,
        customInstructions:
          "Summarize the TDD step work that was done after the kickoff exploration. " +
          "Focus on: what tests were written, what implementation was added, what was refactored. " +
          "Keep it concise — this is a handoff to the next step.",
        label: `tdd-step-done-${slug}`,
      });

      if (result.cancelled) {
        ctx.ui.notify("Navigation cancelled.", "info");
      } else {
        ctx.ui.notify(`Navigated to TDD kickoff for "${slug}". Starting fresh branch.`, "info");
      }
    },
  });
}
