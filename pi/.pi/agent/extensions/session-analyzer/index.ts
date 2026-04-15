/**
 * Session Analyzer Extension
 *
 * Export pi sessions to agent-readable files for analysis of agent behavior patterns.
 * Detects common mistakes like inefficient tool usage, repeated commands, and errors.
 *
 * Commands:
 * - /export-session [path]  - Export session to JSON file
 * - /analyze-session        - Show analysis summary in TUI
 *
 * Tools:
 * - session_analyze - Export and analyze session (for LLM use)
 */

import { StringEnum } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { DynamicBorder } from "@mariozechner/pi-coding-agent";
import { Container, matchesKey, Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { analyzeSession } from "./analyzer";
import type { ExportConfig, SessionExport, IssuePattern } from "./types";

/** Default export configuration */
const DEFAULT_CONFIG: ExportConfig = {
  includeThinking: true,
  includeToolResults: true,
  includeToolResultContent: true,
  maxToolResultLength: 500,
  analyzeIssues: true,
};

/** Severity icon mapping */
const severityIcon: Record<string, string> = {
  info: "ℹ️",
  warning: "⚠️",
  error: "❌",
};

/** Severity color mapping for theme */
const severityColor = {
  info: "muted" as const,
  warning: "warning" as const,
  error: "error" as const,
} satisfies Record<string, string>;

/**
 * Build a markdown summary of issues for display
 */
function buildIssuesSummary(issues: IssuePattern[]): string {
  if (issues.length === 0) {
    return "✅ **No issues detected** - Session looks clean!";
  }

  const lines: string[] = [];
  const byType = new Map<string, IssuePattern[]>();

  for (const issue of issues) {
    const existing = byType.get(issue.type) ?? [];
    existing.push(issue);
    byType.set(issue.type, existing);
  }

  lines.push(`Found **${issues.length}** issue(s):`);
  lines.push("");

  for (const [type, typeIssues] of byType) {
    const icon = severityIcon[typeIssues[0].severity] ?? "•";
    lines.push(`### ${icon} ${formatIssueType(type)} (${typeIssues.length})`);

    for (const issue of typeIssues.slice(0, 3)) {
      lines.push(`- ${issue.description}`);
      if (issue.suggestion) {
        lines.push(`  💡 *${issue.suggestion}*`);
      }
    }

    if (typeIssues.length > 3) {
      lines.push(`  ... and ${typeIssues.length - 3} more`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Format issue type for display
 */
function formatIssueType(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Build markdown summary of session statistics
 */
function buildStatsSummary(exportData: SessionExport): string {
  const { meta, summary, toolExecutions } = exportData;
  const durationMin = Math.round(meta.durationMs / 60000);

  const lines: string[] = [
    "## 📊 Session Statistics",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Duration | ${durationMin} minutes |`,
    `| Turns | ${meta.turnCount} |`,
    `| Total Tool Calls | ${summary.totalToolCalls} |`,
    `| Errors | ${summary.errorCount} |`,
    `| Estimated Tokens | ~${summary.estimatedTokensUsed.toLocaleString()} |`,
    "",
    "### Tool Usage",
    "",
  ];

  const sortedTools = Object.entries(summary.toolCallCounts).sort((a, b) => b[1] - a[1]);

  for (const [tool, count] of sortedTools) {
    const bar = "█".repeat(Math.min(count, 20));
    lines.push(`- **${tool}**: ${count} ${bar}`);
  }

  if (summary.errorCount > 0) {
    lines.push("");
    lines.push("### ❌ Errors");
    lines.push("");
    const errors = toolExecutions.filter((t) => t.isError).slice(0, 5);
    for (const err of errors) {
      lines.push(`- Turn ${err.turnIndex}: ${err.toolName} - ${err.resultSummary.slice(0, 100)}`);
    }
  }

  return lines.join("\n");
}

/**
 * Show analysis UI
 */
async function showAnalysisUI(
  exportData: SessionExport,
  ctx: ExtensionCommandContext,
): Promise<void> {
  if (!ctx.hasUI) {
    ctx.ui.notify("Analysis requires interactive mode", "error");
    return;
  }

  const statsSummary = buildStatsSummary(exportData);
  const issuesSummary = buildIssuesSummary(exportData.issues);
  const fullContent = `${statsSummary}\n\n---\n\n## 🔍 Issue Analysis\n\n${issuesSummary}`;

  await ctx.ui.custom<void>((_tui, theme, _kb, done) => {
    const container = new Container();
    const border = new DynamicBorder((s: string) => theme.fg("accent", s));

    container.addChild(border);
    container.addChild(new Text(theme.fg("accent", theme.bold("Session Analysis")), 1, 0));

    // Use Text component for markdown-like display
    const lines = fullContent.split("\n");
    for (const line of lines) {
      // Basic markdown-like rendering
      let styled = line;
      if (line.startsWith("### ")) {
        styled = theme.bold(theme.fg("accent", line.slice(4)));
      } else if (line.startsWith("## ")) {
        styled = theme.bold(theme.fg("accent", line.slice(3)));
      } else if (line.startsWith("- **")) {
        styled = theme.fg("text", line);
      } else if (line.startsWith("✅")) {
        styled = theme.fg("success", line);
      } else if (line.startsWith("❌") || line.startsWith("⚠️")) {
        styled = theme.fg("warning", line);
      } else if (line.startsWith("💡")) {
        styled = theme.fg("muted", line);
      } else if (line === "---") {
        styled = theme.fg("borderMuted", "─".repeat(50));
      }
      container.addChild(new Text(styled, 1, 0));
    }

    container.addChild(new Text(theme.fg("dim", "Press Escape to close"), 1, 0));
    container.addChild(border);

    return {
      render: (width: number) => container.render(width),
      invalidate: () => container.invalidate(),
      handleInput: (data: string) => {
        if (matchesKey(data, "escape") || matchesKey(data, "enter")) {
          done(undefined);
        }
      },
    };
  });
}

export default function (pi: ExtensionAPI) {
  /**
   * Export session to a file
   */
  async function exportSession(
    outputPath: string | undefined,
    ctx: ExtensionCommandContext,
    config: Partial<ExportConfig> = {},
  ): Promise<SessionExport | null> {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };

    // Get all entries from current branch
    const entries = ctx.sessionManager.getBranch();

    if (entries.length === 0) {
      ctx.ui.notify("No session entries to export", "warning");
      return null;
    }

    // Analyze the session
    const exportData = analyzeSession(
      entries.map((e) => ({
        type: e.type,
        id: (e as any).id,
        parentId: (e as any).parentId,
        timestamp: (e as any).timestamp,
        message: (e as any).message,
      })),
      finalConfig,
    );

    // Determine output path
    let filePath: string;
    if (outputPath) {
      filePath = resolve(ctx.cwd, outputPath);
    } else {
      const sessionFile = ctx.sessionManager.getSessionFile();
      const sessionName = sessionFile
        ? (sessionFile.split("/").pop()?.replace(".jsonl", "") ?? "session")
        : `session-${Date.now()}`;
      filePath = join(ctx.cwd, `${sessionName}-analysis.json`);
    }

    // Write to file
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(exportData, null, 2), "utf-8");

    ctx.ui.notify(`Session exported to: ${filePath}`, "info");

    return exportData;
  }

  // Register /export-session command
  pi.registerCommand("export-session", {
    description: "Export session to an agent-readable JSON file for analysis",
    handler: async (args, ctx) => {
      const outputPath = args?.trim() || undefined;
      const exportData = await exportSession(outputPath, ctx);

      if (exportData && ctx.hasUI) {
        ctx.ui.notify(
          `Exported ${exportData.meta.turnCount} turns, ${exportData.summary.totalToolCalls} tool calls, ${exportData.issues.length} issues detected`,
          "info",
        );
      }
    },
  });

  // Register /analyze-session command
  pi.registerCommand("analyze-session", {
    description: "Analyze current session for agent behavior patterns and mistakes",
    handler: async (_args, ctx) => {
      const entries = ctx.sessionManager.getBranch();

      if (entries.length === 0) {
        ctx.ui.notify("No session entries to analyze", "warning");
        return;
      }

      // Run analysis
      const exportData = analyzeSession(
        entries.map((e) => ({
          type: e.type,
          id: (e as any).id,
          parentId: (e as any).parentId,
          timestamp: (e as any).timestamp,
          message: (e as any).message,
        })),
        DEFAULT_CONFIG,
      );

      if (ctx.hasUI) {
        await showAnalysisUI(exportData, ctx);
      } else {
        // Print summary to console
        console.log(buildStatsSummary(exportData));
        console.log("\n");
        console.log(buildIssuesSummary(exportData.issues));
      }
    },
  });

  // Register session_analyze tool for LLM use
  pi.registerTool({
    name: "session_analyze",
    label: "Analyze Session",
    description:
      "Analyze the current session for agent behavior patterns, mistakes, and inefficiencies. " +
      "Returns a summary of tool usage, detected issues, and suggestions for improvement. " +
      "Can also export the full analysis to a JSON file.",
    promptSnippet: "Analyze session for agent mistakes and patterns",
    promptGuidelines: [
      "Use this tool to review the session for inefficiencies and mistakes",
      "Returns statistics on tool usage, error counts, and detected patterns",
      "Set export=true to save the full analysis to a JSON file",
      "Common detected issues: repeated commands, inefficient tool usage, errors",
    ],
    parameters: Type.Object({
      action: StringEnum(["analyze", "export"] as const),
      exportPath: Type.Optional(
        Type.String({
          description:
            "Path to export JSON file (for export action). Defaults to <session>-analysis.json",
        }),
      ),
      includeThinking: Type.Optional(
        Type.Boolean({
          description: "Include thinking content in export (default: true)",
        }),
      ),
      includeToolResults: Type.Optional(
        Type.Boolean({
          description: "Include tool result content in export (default: true)",
        }),
      ),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const config: ExportConfig = {
        ...DEFAULT_CONFIG,
        includeThinking: params.includeThinking ?? DEFAULT_CONFIG.includeThinking,
        includeToolResults: params.includeToolResults ?? DEFAULT_CONFIG.includeToolResults,
      };

      const entries = ctx.sessionManager.getBranch();

      if (entries.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No session entries to analyze." }],
          details: { error: "empty_session" },
        };
      }

      // Analyze the session
      const exportData = analyzeSession(
        entries.map((e) => ({
          type: e.type,
          id: (e as any).id,
          parentId: (e as any).parentId,
          timestamp: (e as any).timestamp,
          message: (e as any).message,
        })),
        config,
      );

      // Export if requested
      if (params.action === "export") {
        const outputPath = params.exportPath
          ? resolve(ctx.cwd, params.exportPath)
          : join(ctx.cwd, `session-${Date.now()}-analysis.json`);

        await mkdir(dirname(outputPath), { recursive: true });
        await writeFile(outputPath, JSON.stringify(exportData, null, 2), "utf-8");

        return {
          content: [
            {
              type: "text" as const,
              text: `Session analysis exported to: ${outputPath}\n\n${buildStatsSummary(exportData)}\n\n${buildIssuesSummary(exportData.issues)}`,
            },
          ],
          details: { exportPath: outputPath, ...exportData.summary },
        };
      }

      // Return analysis summary
      const summary = buildStatsSummary(exportData);
      const issues = buildIssuesSummary(exportData.issues);

      return {
        content: [
          {
            type: "text" as const,
            text: `${summary}\n\n## Issue Analysis\n\n${issues}`,
          },
        ],
        details: {
          ...exportData.summary,
          issueCount: exportData.issues.length,
          issues: exportData.issues.map((i) => ({
            type: i.type,
            severity: i.severity,
            description: i.description,
            suggestion: i.suggestion,
          })),
        },
      };
    },

    renderCall(args, theme, _context) {
      const action = args.action ?? "analyze";
      let text = theme.fg("toolTitle", theme.bold("session_analyze "));
      text += theme.fg("muted", action);
      if (args.exportPath) {
        text += " " + theme.fg("dim", args.exportPath);
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, { expanded, isPartial }, theme, _context) {
      if (isPartial) {
        return new Text(theme.fg("warning", "Analyzing session..."), 0, 0);
      }

      const details = result.details as any;
      if (!details) {
        const text = result.content[0];
        return new Text(text?.type === "text" ? text.text : "", 0, 0);
      }

      if (details.error) {
        return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
      }

      let text = theme.fg("success", "✓ Analysis complete");
      text +=
        "\n" +
        theme.fg(
          "muted",
          `Turns: ${details.turnCount ?? 0} | Tools: ${details.totalToolCalls ?? 0} | Issues: ${details.issueCount ?? 0}`,
        );

      if (details.errorCount > 0) {
        text += "\n" + theme.fg("error", `Errors: ${details.errorCount}`);
      }

      if (details.exportPath) {
        text += "\n" + theme.fg("accent", `Exported: ${details.exportPath}`);
      }

      if (expanded && details.issues && details.issues.length > 0) {
        text += "\n" + theme.fg("muted", "\nIssues:");
        for (const issue of details.issues.slice(0, 5)) {
          const severity = issue.severity as keyof typeof severityColor;
          const icon = severityIcon[severity] ?? "•";
          text += `\n${icon} ${theme.fg(severityColor[severity], issue.description)}`;
        }
      }

      return new Text(text, 0, 0);
    },
  });
}
