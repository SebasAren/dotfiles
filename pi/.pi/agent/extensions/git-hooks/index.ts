/**
 * Git Hooks Extension
 *
 * Discovers the repo's git hooks directory via `git rev-parse --git-path hooks`
 * and injects an instruction into the system prompt telling the agent to run
 * the pre-commit hook before every `jj commit`.
 *
 * If no pre-commit hook exists, or the cwd is not a git repo, the extension
 * is a no-op.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function gitHooksExtension(pi: ExtensionAPI): void {
  let preCommitHook: string | null = null;

  pi.on("session_start", async (_event, ctx) => {
    preCommitHook = null;

    try {
      const result = spawnSync("git", ["rev-parse", "--git-path", "hooks"], {
        cwd: ctx.cwd,
        encoding: "utf-8",
        timeout: 5000,
      });

      if (result.status !== 0 || !result.stdout.trim()) return;

      const hooksDir = result.stdout.trim();
      const hookPath = resolve(ctx.cwd, hooksDir, "pre-commit");

      if (existsSync(hookPath)) {
        preCommitHook = hookPath;
      }
    } catch {
      // Not a git repo or git not available — silent no-op
    }
  });

  pi.on("before_agent_start", async (event) => {
    if (!preCommitHook) return;

    const instruction = [
      "",
      "## Git Pre-commit Hook",
      "",
      `A pre-commit hook exists at \`${preCommitHook}\`.`,
      "Run it before every `jj commit`. If the hook fails, do not commit.",
      "",
    ].join("\n");

    return {
      systemPrompt: event.systemPrompt + instruction,
    };
  });
}
