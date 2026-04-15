/**
 * Session Analyzer - Core Analysis Logic
 *
 * Processes session entries and detects common agent mistake patterns.
 */

import type {
  ExportConfig,
  IssuePattern,
  SessionExport,
  ConversationTurn,
  ToolExecution,
  SessionMeta,
} from "./types";

type SessionEntry = {
  type: string;
  id?: string;
  parentId?: string | null;
  timestamp?: string;
  message?: {
    role?: string;
    content?: unknown;
    provider?: string;
    model?: string;
    usage?: {
      input?: number;
      output?: number;
      totalTokens?: number;
    };
    toolName?: string;
    toolCallId?: string;
    isError?: boolean;
    details?: unknown;
  };
};

type ContentBlock = {
  type?: string;
  text?: string;
  thinking?: string;
  name?: string;
  arguments?: Record<string, unknown>;
  id?: string;
};

/**
 * Extract text from message content
 */
function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .filter(
      (c): c is { type: "text"; text: string } =>
        c && typeof c === "object" && c.type === "text" && typeof c.text === "string",
    )
    .map((c) => c.text)
    .join("\n")
    .trim();
}

/**
 * Extract thinking from message content
 */
function extractThinking(content: unknown): string | undefined {
  if (!Array.isArray(content)) return undefined;

  const thinkingParts = content
    .filter(
      (c): c is { type: "thinking"; thinking: string } =>
        c && typeof c === "object" && c.type === "thinking" && typeof c.thinking === "string",
    )
    .map((c) => c.thinking);

  return thinkingParts.length > 0 ? thinkingParts.join("\n") : undefined;
}

/**
 * Extract tool calls from message content
 */
function extractToolCalls(content: unknown): ContentBlock[] {
  if (!Array.isArray(content)) return [];

  return content.filter(
    (c): c is ContentBlock =>
      c && typeof c === "object" && c.type === "toolCall" && typeof c.name === "string",
  );
}

/**
 * Truncate string for summary
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

/**
 * Analyze session entries and build export
 */
export function analyzeSession(entries: SessionEntry[], config: ExportConfig): SessionExport {
  const turns: ConversationTurn[] = [];
  const toolExecutions: ToolExecution[] = [];
  const issues: IssuePattern[] = [];

  let currentTurn: ConversationTurn | null = null;
  let turnIndex = 0;
  let sessionStartTime: string | undefined;
  let sessionEndTime: string | undefined;
  let sessionId = "unknown";
  let sessionCwd = "unknown";

  // Track for issue detection
  const commandHistory: { command: string; turnIndex: number; toolCallId: string }[] = [];
  const readPaths: { path: string; turnIndex: number }[] = [];
  const failedTools: { toolName: string; toolCallId: string; turnIndex: number; detail: string }[] =
    [];

  for (const entry of entries) {
    // Session header
    if (entry.type === "session") {
      sessionStartTime = entry.timestamp;
      sessionId = (entry as any).id ?? "unknown";
      sessionCwd = (entry as any).cwd ?? "unknown";
      continue;
    }

    // Skip non-message entries
    if (entry.type !== "message" || !entry.message) continue;

    const msg = entry.message;
    const entryTimestamp = entry.timestamp ?? new Date().toISOString();
    sessionEndTime = entryTimestamp;

    if (msg.role === "user") {
      // Start new turn
      if (currentTurn) {
        turns.push(currentTurn);
      }
      turnIndex++;
      currentTurn = {
        turnIndex,
        timestamp: entryTimestamp,
        userMessage: truncate(extractText(msg.content), 500),
        assistantText: "",
        toolCalls: [],
      };
    } else if (msg.role === "assistant" && currentTurn) {
      // Parse assistant message
      const text = extractText(msg.content);
      const thinking = config.includeThinking ? extractThinking(msg.content) : undefined;
      const toolCallsContent = extractToolCalls(msg.content);

      currentTurn.assistantText = truncate(text, 1000);
      if (thinking) currentTurn.thinking = truncate(thinking, 2000);
      currentTurn.model = msg.model ?? undefined;
      currentTurn.provider = msg.provider ?? undefined;
      if (msg.usage) {
        currentTurn.usage = {
          input: msg.usage.input ?? 0,
          output: msg.usage.output ?? 0,
          total: msg.usage.totalTokens ?? 0,
        };
      }

      // Process tool calls (results come in toolResult entries)
      for (const tc of toolCallsContent) {
        const args = tc.arguments ?? {};
        const toolExecution: ToolExecution = {
          turnIndex,
          toolCallId: tc.id ?? "unknown",
          toolName: tc.name ?? "unknown",
          args: config.includeToolResults ? args : {},
          resultSummary: "",
          isError: false,
          timestamp: entryTimestamp,
        };

        currentTurn.toolCalls.push(toolExecution);
        toolExecutions.push(toolExecution);

        // Track bash commands for issue detection
        if (tc.name === "bash" && typeof args.command === "string") {
          commandHistory.push({
            command: args.command,
            turnIndex,
            toolCallId: tc.id ?? "unknown",
          });
        }

        // Track read paths
        if (tc.name === "read" && typeof args.path === "string") {
          readPaths.push({ path: args.path, turnIndex });
        }
      }
    } else if (msg.role === "toolResult") {
      // Update the matching tool execution with result summary
      const toolCallId = msg.toolCallId ?? "unknown";
      const toolName = msg.toolName ?? "unknown";
      const isError = msg.isError ?? false;
      const resultText = extractText(msg.content);

      const execution = toolExecutions.find((t) => t.toolCallId === toolCallId);
      if (execution) {
        execution.resultSummary = truncate(resultText, config.maxToolResultLength);
        execution.isError = isError;
      }

      if (isError) {
        failedTools.push({
          toolName,
          toolCallId,
          turnIndex,
          detail: truncate(resultText, 200),
        });
      }
    }
  }

  // Push final turn
  if (currentTurn) {
    turns.push(currentTurn);
  }

  // Build session meta
  const startTime = sessionStartTime ?? new Date().toISOString();
  const endTime = sessionEndTime ?? new Date().toISOString();
  const meta: SessionMeta = {
    id: sessionId,
    cwd: sessionCwd,
    startTime,
    endTime,
    durationMs: new Date(endTime).getTime() - new Date(startTime).getTime(),
    entryCount: entries.length,
    turnCount: turns.length,
  };

  // Build summary
  const toolCallCounts: Record<string, number> = {};
  let errorCount = 0;
  let estimatedTokensUsed = 0;

  for (const exec of toolExecutions) {
    toolCallCounts[exec.toolName] = (toolCallCounts[exec.toolName] ?? 0) + 1;
    if (exec.isError) errorCount++;
  }

  for (const turn of turns) {
    if (turn.usage) {
      estimatedTokensUsed += turn.usage.total;
    }
  }

  // Detect issues
  if (config.analyzeIssues) {
    detectIssues(entries, turns, toolExecutions, commandHistory, readPaths, failedTools, issues);
  }

  const repeatedCommandCount = issues
    .filter((i) => i.type === "repeated_command")
    .reduce((sum, i) => sum + i.occurrences.length, 0);

  return {
    meta,
    turns,
    toolExecutions,
    issues,
    summary: {
      totalToolCalls: toolExecutions.length,
      toolCallCounts,
      errorCount,
      repeatedCommandCount,
      estimatedTokensUsed,
    },
  };
}

/**
 * Detect common agent issue patterns
 */
function detectIssues(
  _entries: SessionEntry[],
  turns: ConversationTurn[],
  toolExecutions: ToolExecution[],
  commandHistory: { command: string; turnIndex: number; toolCallId: string }[],
  readPaths: { path: string; turnIndex: number }[],
  failedTools: { toolName: string; toolCallId: string; turnIndex: number; detail: string }[],
  issues: IssuePattern[],
): void {
  // 1. Repeated commands (same bash command used multiple times)
  const commandCounts = new Map<
    string,
    { count: number; turns: number[]; toolCallIds: string[] }
  >();
  for (const cmd of commandHistory) {
    const normalized = normalizeCommand(cmd.command);
    const existing = commandCounts.get(normalized) ?? { count: 0, turns: [], toolCallIds: [] };
    existing.count++;
    existing.turns.push(cmd.turnIndex);
    existing.toolCallIds.push(cmd.toolCallId);
    commandCounts.set(normalized, existing);
  }

  for (const [command, data] of commandCounts) {
    if (data.count >= 3) {
      issues.push({
        type: "repeated_command",
        severity: "warning",
        description: `Command repeated ${data.count} times: "${truncate(command, 80)}"`,
        occurrences: data.turns.map((t, i) => ({
          turnIndex: t,
          toolCallId: data.toolCallIds[i],
          detail: `Execution #${i + 1}`,
        })),
        suggestion: "Consider caching the result or using a more efficient approach.",
      });
    }
  }

  // 2. Excessive reads (reading many files in succession)
  const readsByTurn = new Map<number, string[]>();
  for (const r of readPaths) {
    const existing = readsByTurn.get(r.turnIndex) ?? [];
    existing.push(r.path);
    readsByTurn.set(r.turnIndex, existing);
  }

  for (const [turn, paths] of readsByTurn) {
    if (paths.length >= 5) {
      issues.push({
        type: "excessive_reads",
        severity: "info",
        description: `${paths.length} files read in turn ${turn}`,
        occurrences: paths.map((p) => ({ turnIndex: turn, detail: p })),
        suggestion:
          "Consider using grep or find to search content instead of reading individual files.",
      });
    }
  }

  // 3. Failed tool executions
  for (const failed of failedTools) {
    issues.push({
      type: "failed_tool",
      severity: "error",
      description: `${failed.toolName} failed in turn ${failed.turnIndex}`,
      occurrences: [
        { turnIndex: failed.turnIndex, toolCallId: failed.toolCallId, detail: failed.detail },
      ],
      suggestion: "Check if the tool arguments are correct or if prerequisites are missing.",
    });
  }

  // 4. Inefficient tool usage patterns
  detectInefficientPatterns(toolExecutions, issues);

  // 5. Context bloat (large token usage per turn)
  for (const turn of turns) {
    if (turn.usage && turn.usage.total > 50000) {
      issues.push({
        type: "context_bloat",
        severity: "warning",
        description: `High token usage in turn ${turn.turnIndex}: ${turn.usage.total} tokens`,
        occurrences: [
          {
            turnIndex: turn.turnIndex,
            detail: `Input: ${turn.usage.input}, Output: ${turn.usage.output}`,
          },
        ],
        suggestion: "Consider using more specific queries or tools to reduce context size.",
      });
    }
  }
}

/**
 * Detect inefficient tool usage patterns
 */
function detectInefficientPatterns(toolExecutions: ToolExecution[], issues: IssuePattern[]): void {
  // Pattern: Using bash for things that have dedicated tools
  const bashCommands = toolExecutions.filter((t) => t.toolName === "bash");
  const inefficientCommands: {
    turnIndex: number;
    toolCallId: string;
    command: string;
    suggestion: string;
  }[] = [];

  for (const exec of bashCommands) {
    const cmd = (exec.args.command as string) ?? "";

    // cat → read tool
    if (/^cat\s+/.test(cmd) && !cmd.includes("|") && !cmd.includes(">")) {
      inefficientCommands.push({
        turnIndex: exec.turnIndex,
        toolCallId: exec.toolCallId,
        command: cmd,
        suggestion: "Use the 'read' tool instead of 'cat' for reading files.",
      });
    }

    // grep/ripgrep → grep tool
    if (/^(grep|rg)\s+/.test(cmd) && !cmd.includes("|")) {
      inefficientCommands.push({
        turnIndex: exec.turnIndex,
        toolCallId: exec.toolCallId,
        command: cmd,
        suggestion: "Use the 'grep' tool instead of shell grep for searching.",
      });
    }

    // find → find tool
    if (/^find\s+/.test(cmd) && !cmd.includes("-exec") && !cmd.includes("|")) {
      inefficientCommands.push({
        turnIndex: exec.turnIndex,
        toolCallId: exec.toolCallId,
        command: cmd,
        suggestion: "Use the 'find' tool instead of shell find for file discovery.",
      });
    }

    // ls → ls tool
    if (/^ls\s*$/.test(cmd) || /^ls\s+-[a-z]*l[a-z]*\s*$/.test(cmd)) {
      inefficientCommands.push({
        turnIndex: exec.turnIndex,
        toolCallId: exec.toolCallId,
        command: cmd,
        suggestion: "Use the 'ls' tool instead of shell ls.",
      });
    }

    // echo with no pipe
    if (/^echo\s+/.test(cmd) && !cmd.includes("|") && !cmd.includes(">")) {
      inefficientCommands.push({
        turnIndex: exec.turnIndex,
        toolCallId: exec.toolCallId,
        command: cmd,
        suggestion:
          "Echo without piping is usually unnecessary. Consider if this step can be skipped.",
      });
    }
  }

  if (inefficientCommands.length > 0) {
    issues.push({
      type: "inefficient_tool",
      severity: "info",
      description: `${inefficientCommands.length} bash commands could use dedicated tools`,
      occurrences: inefficientCommands.map((c) => ({
        turnIndex: c.turnIndex,
        toolCallId: c.toolCallId,
        detail: `${c.command}\n→ ${c.suggestion}`,
      })),
      suggestion:
        "Prefer specialized tools (read, grep, find, ls) over bash equivalents for better error handling and formatting.",
    });
  }


}

/**
 * Normalize a command for comparison (remove varying arguments)
 */
function normalizeCommand(cmd: string): string {
  // Remove extra whitespace
  let normalized = cmd.trim().replace(/\s+/g, " ");

  // Normalize common variations
  normalized = normalized.replace(/\/+/g, "/"); // Multiple slashes

  return normalized;
}
