/**
 * Plan Mode Extension
 *
 * Simple read-only mode for formulating plans.
 * Toggle with /plan or Ctrl+Alt+P.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
  BeforeAgentStartEvent,
} from "@mariozechner/pi-coding-agent";
import { Key } from "@mariozechner/pi-tui";

const PLAN_MODE_TOOLS = [
  "read",
  "bash",
  "grep",
  "find",
  "ls",
  "questionnaire",
  "explore",
  "librarian",
];

const NORMAL_MODE_TOOLS = ["read", "bash", "edit", "write"];

export default function planModeExtension(pi: ExtensionAPI): void {
  let planModeEnabled = false;

  pi.registerFlag("plan", {
    description: "Start in plan mode (read-only exploration)",
    type: "boolean",
    default: false,
  });

  function togglePlanMode(ctx: ExtensionContext): void {
    planModeEnabled = !planModeEnabled;

    if (planModeEnabled) {
      pi.setActiveTools(PLAN_MODE_TOOLS);
      ctx.ui.setStatus("plan-mode", ctx.ui.theme.fg("warning", "⏸ plan"));
      ctx.ui.notify("Plan mode enabled. Read-only tools only.");
    } else {
      pi.setActiveTools(NORMAL_MODE_TOOLS);
      ctx.ui.setStatus("plan-mode", undefined);
      ctx.ui.notify("Plan mode disabled. Full access restored.");
    }
  }

  pi.registerCommand("plan", {
    description: "Toggle plan mode (read-only exploration)",
    handler: async (_args, ctx) => togglePlanMode(ctx),
  });

  pi.registerCommand("plan-execute", {
    description: "Exit plan mode, compact session preserving the plan, then execute",
    handler: async (_args, ctx) => {
      // Disable plan mode
      planModeEnabled = false;
      pi.setActiveTools(NORMAL_MODE_TOOLS);
      ctx.ui.setStatus("plan-mode", undefined);

      // Trigger compaction, then send instruction message after completion
      ctx.compact({
        onComplete: () => {
          // Send user message to steer LLM
          pi.sendUserMessage(
            "I have a plan I want to execute. Preserve the plan below and continue with its implementation.\n\n" +
              "If there was a previous plan in the conversation, extract and maintain it.\n\n" +
              "Start by acknowledging the plan and then begin executing it step by step.",
            { deliverAs: "steer" },
          );
        },
      });
    },
  });

  pi.registerShortcut(Key.ctrlAlt("p"), {
    description: "Toggle plan mode",
    handler: async (ctx) => togglePlanMode(ctx),
  });

  // Inject context before agent starts
  // @ts-expect-error - event literal type narrowing issue with ExtensionEvent union
  pi.on("before_agent_start", async (_event: BeforeAgentStartEvent) => {
    if (!planModeEnabled) return undefined;

    return {
      message: {
        content: `[PLAN MODE ACTIVE]
You are in plan mode - read-only exploration mode.

Only these tools are available: ${PLAN_MODE_TOOLS.join(", ")}
You CANNOT use: edit, write (file modifications are disabled)

Explore the codebase, ask questions, and formulate a plan.
Present your plan as numbered steps under a "Plan:" header.

When ready, say "I'm ready to execute" to leave plan mode.`,
        display: false,
      },
    };
  });

  // Restore plan mode state on session start
  pi.on("session_start", async (_event, ctx) => {
    if (pi.getFlag("plan") === true) {
      planModeEnabled = true;
      pi.setActiveTools(PLAN_MODE_TOOLS);
      ctx.ui.setStatus("plan-mode", ctx.ui.theme.fg("warning", "⏸ plan"));
    }
  });
}
