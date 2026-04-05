/**
 * Claude Rules Extension
 *
 * Reads Claude Code-style path-scoped rules from `.claude/rules/*.md`.
 * Each rule file can have YAML frontmatter with a `globs` or `paths` field
 * (list of path patterns). Both fields are supported — `globs` is the legacy
 * name, `paths` is what Claude Code documents officially. When the agent
 * reads/writes/edits a file that matches a rule's patterns, the rule content
 * is automatically injected into the LLM context alongside the tool result.
 *
 * Rule files without globs/paths are always included in the system prompt.
 */

import * as path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import type { ClaudeRule } from "./types";
import { loadRules } from "./rules";

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
