/**
 * Session Analyzer Types
 *
 * Type definitions for session export and analysis.
 */

/** Session metadata */
export interface SessionMeta {
  id: string;
  cwd: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  entryCount: number;
  turnCount: number;
}

/** A single content block in a message */
export interface ContentBlock {
  type: "text" | "toolCall" | "thinking" | "image";
  text?: string;
  thinking?: string;
  toolName?: string;
  toolCallId?: string;
  toolArgs?: Record<string, unknown>;
}

/** A tool execution record */
export interface ToolExecution {
  turnIndex: number;
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  resultSummary: string;
  isError: boolean;
  timestamp: string;
}

/** A conversation turn (user message → assistant response + tool calls) */
export interface ConversationTurn {
  turnIndex: number;
  timestamp: string;
  userMessage: string;
  assistantText: string;
  thinking?: string;
  toolCalls: ToolExecution[];
  model?: string;
  provider?: string;
  usage?: {
    input: number;
    output: number;
    total: number;
  };
}

/** Detected issue pattern */
export interface IssuePattern {
  type:
    | "repeated_command"
    | "inefficient_tool"
    | "excessive_reads"
    | "failed_tool"
    | "hallucinated_path"
    | "missing_tool_use"
    | "context_bloat"
    | "slow_pattern";
  severity: "info" | "warning" | "error";
  description: string;
  occurrences: {
    turnIndex: number;
    toolCallId?: string;
    detail: string;
  }[];
  suggestion?: string;
}

/** Full session export */
export interface SessionExport {
  meta: SessionMeta;
  turns: ConversationTurn[];
  toolExecutions: ToolExecution[];
  issues: IssuePattern[];
  summary: {
    totalToolCalls: number;
    toolCallCounts: Record<string, number>;
    errorCount: number;
    repeatedCommandCount: number;
    estimatedTokensUsed: number;
  };
}

/** Configuration for what to include in export */
export interface ExportConfig {
  includeThinking: boolean;
  includeToolResults: boolean;
  includeToolResultContent: boolean;
  maxToolResultLength: number;
  analyzeIssues: boolean;
}
