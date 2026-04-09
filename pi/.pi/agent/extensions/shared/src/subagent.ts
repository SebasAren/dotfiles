/**
 * Generic subagent subprocess runner.
 *
 * Manages the full lifecycle of spawning a pi subprocess for subagent tasks:
 * - Temp dir creation with system prompt file
 * - Process spawning with JSON line parsing
 * - Usage tracking
 * - Loop detection and tool call limits (configurable)
 * - Timeout and abort signal handling
 * - Cleanup
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { getPiInvocation } from "./subprocess.js";
import { argsSignature, detectLoop } from "./loop-detection.js";
import { getModel, getFallbackModel, shouldUseFallback } from "./model.js";
import type { SubagentResult } from "./types.js";

/** Maximum number of recent tool calls kept in the rolling activity window. */
const RECENT_CALLS_WINDOW = 5;

/** Build a short "toolName: detail" line from a tool_execution_start event. */
function formatRecentCall(toolName: string, args: Record<string, unknown> | undefined): string {
  if (!args) return toolName;
  let detail = "";
  if (typeof args.query === "string") detail = args.query.slice(0, 60);
  else if (typeof args.path === "string") detail = args.path;
  else if (typeof args.command === "string") detail = args.command.slice(0, 50);
  else if (typeof args.pattern === "string") detail = args.pattern.slice(0, 50);
  return detail ? `${toolName}: ${detail}` : toolName;
}

/** Options for {@link runSubagent}. */
export interface RunSubagentOptions {
  /** Working directory for the subprocess */
  cwd: string;
  /** The prompt/query to send to the subagent */
  query: string;
  /** System prompt content */
  systemPrompt: string;
  /**
   * Base CLI flags for the pi invocation.
   * The runner automatically adds: `--mode json -p`, `--append-system-prompt`,
   * optional `--model`, and the query as positional arg.
   *
   * Example: `["--no-session", "--no-extensions", "--no-skills",
   * "--no-prompt-templates", "--tools", "read,grep,find,ls,bash"]`
   */
  baseFlags: string[];
  /** Timeout in milliseconds (default: 120_000) */
  timeoutMs?: number;
  /** Abort signal */
  signal?: AbortSignal;
  /**
   * Callback for streaming updates. Fires whenever the subagent emits new
   * assistant text or starts a new tool call, so the caller can surface live
   * activity (e.g. a scrolling tool-call ticker) in the main agent UI.
   */
  onUpdate?: (update: { text: string; recentCalls?: string[] }) => void;
  /** Enable loop detection for tool calls (default: false) */
  loopDetection?: boolean;
  /** Maximum number of tool calls before stopping (default: Infinity) */
  maxToolCalls?: number;
  /** Prefix for temp directory name (default: "pi-subagent-") */
  tmpPrefix?: string;
  /** Debug label for console.log messages (omit to suppress logs) */
  debugLabel?: string;
  /** Override the default subagent model (falls back to CHEAP_MODEL env var) */
  model?: string;
  /** Override the fallback model (falls back to FALLBACK_MODEL env var) */
  fallbackModel?: string;
  /** Extra environment variables to set on the child process */
  env?: Record<string, string>;
}

/** Default timeout: 2 minutes */
const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Spawn a pi subprocess as a subagent and collect its output.
 *
 * Handles system prompt injection, loop detection, tool call limits,
 * timeout, and abort signals. Streams a rolling window of recent tool
 * calls through `onUpdate` so the caller can render a live activity
 * ticker in the main agent UI.
 */
export async function runSubagent(options: RunSubagentOptions): Promise<SubagentResult> {
  const model = options.model || getModel();
  const fallbackModel = options.fallbackModel || getFallbackModel();

  // Run with primary model first
  const result = await runSubagentOnce(options, model);

  // If primary model failed with a transient error and fallback is available, retry
  if (
    fallbackModel &&
    fallbackModel !== model &&
    (result.exitCode !== 0 || result.errorMessage) &&
    shouldUseFallback(result.errorMessage || result.stderr)
  ) {
    const log = (msg: string) => {
      if (options.debugLabel) console.log(`[${options.debugLabel}] ${msg}`);
    };
    log(`primary model failed, retrying with fallback: ${fallbackModel}`);
    if (options.onUpdate)
      options.onUpdate({ text: `[Primary model unavailable, retrying with ${fallbackModel}...]` });

    const fallbackResult = await runSubagentOnce(options, fallbackModel);

    // Mark that fallback was used
    if (!fallbackResult.errorMessage) {
      fallbackResult.model = fallbackResult.model || fallbackModel;
    }
    return fallbackResult;
  }

  return result;
}

/**
 * Single attempt at running a subagent with a specific model.
 * Used internally by runSubagent for both primary and fallback attempts.
 */
async function runSubagentOnce(
  options: RunSubagentOptions,
  model: string | undefined,
): Promise<SubagentResult> {
  const {
    cwd,
    query,
    systemPrompt,
    baseFlags,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
    onUpdate,
    loopDetection = false,
    maxToolCalls = Infinity,
    tmpPrefix = "pi-subagent-",
    debugLabel,
  } = options;

  let tmpDir: string | null = null;
  let tmpPromptPath: string | null = null;
  const recentCalls: string[] = [];
  // Full, unbounded log of every tool call the subagent made. Used to
  // synthesize a fallback summary when the subagent exits without producing
  // any assistant text (e.g. some models keep tool-calling then hit end_turn
  // without writing a summary).
  const allCalls: string[] = [];

  const result: SubagentResult = {
    exitCode: 0,
    output: "",
    stderr: "",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      cost: 0,
      contextTokens: 0,
      turns: 0,
    },
  };

  const emitUpdate = () => {
    onUpdate?.({
      text: result.output || "(running...)",
      recentCalls: recentCalls.length > 0 ? [...recentCalls] : undefined,
    });
  };

  const log = (msg: string) => {
    if (debugLabel) console.log(`[${debugLabel}] ${msg}`);
  };

  try {
    // Write system prompt to temp file
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), tmpPrefix));
    tmpPromptPath = path.join(tmpDir, "system-prompt.md");
    await fs.promises.writeFile(tmpPromptPath, systemPrompt, { encoding: "utf-8", mode: 0o600 });

    // Build CLI args: base flags + system prompt + optional model + query
    const args = ["--mode", "json", "-p", ...baseFlags, "--append-system-prompt", tmpPromptPath];
    if (model) args.push("--model", model);
    args.push(query);

    let wasAborted = false;
    let stoppedEarly = false;
    const toolHistory: Array<{ name: string; argsSignature: string }> = [];

    const exitCode = await new Promise<number>((resolve) => {
      const invocation = getPiInvocation(args);
      log(`spawning: ${invocation.command} ${invocation.args.join(" ")}`);
      log(`cwd: ${cwd}`);

      const proc = spawn(invocation.command, invocation.args, {
        cwd,
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, PI_REAL_CWD: cwd, ...options.env },
      });
      proc.stdin.end(); // Signal EOF so subprocess doesn't wait for input

      // Helper to kill the subprocess with escalation
      const killProc = (reason: string) => {
        log(`killing: ${reason}`);
        proc.kill("SIGTERM");
        setTimeout(() => {
          if (!proc.killed) proc.kill("SIGKILL");
        }, 5000);
      };

      // Timeout: kill subprocess if it takes too long
      const timeout = setTimeout(() => {
        killProc(`timeout after ${timeoutMs}ms`);
      }, timeoutMs);

      let buffer = "";

      const processLine = (line: string) => {
        if (!line.trim()) return;
        let event: any;
        try {
          event = JSON.parse(line);
        } catch {
          return;
        }

        // Track tool calls for loop detection, limits, and live activity display
        if (event.type === "tool_execution_start" && event.toolName) {
          if (loopDetection || maxToolCalls < Infinity) {
            toolHistory.push({
              name: event.toolName,
              argsSignature: argsSignature(event.args || {}),
            });
          }

          // Push into the rolling activity window shown in the main agent UI
          // and the full log used for the "no text output" fallback.
          const callLine = formatRecentCall(event.toolName, event.args);
          allCalls.push(callLine);
          recentCalls.push(callLine);
          if (recentCalls.length > RECENT_CALLS_WINDOW) recentCalls.shift();
          emitUpdate();

          // Hard limit on total tool calls
          if (toolHistory.length > maxToolCalls) {
            stoppedEarly = true;
            result.output += `\n\n[Stopped: exceeded ${maxToolCalls} tool calls]`;
            emitUpdate();
            killProc(`exceeded ${maxToolCalls} tool calls`);
            return;
          }

          // Pattern-based loop detection
          if (loopDetection) {
            const loopMsg = detectLoop(toolHistory);
            if (loopMsg) {
              stoppedEarly = true;
              result.output += `\n\n[Stopped: ${loopMsg}]`;
              emitUpdate();
              killProc(loopMsg);
              return;
            }
          }
        }

        if (event.type === "message_end" && event.message) {
          const msg = event.message;
          if (msg.role === "assistant") {
            result.usage.turns++;
            const usage = msg.usage;
            if (usage) {
              result.usage.input += usage.input || 0;
              result.usage.output += usage.output || 0;
              result.usage.cacheRead += usage.cacheRead || 0;
              result.usage.cacheWrite += usage.cacheWrite || 0;
              result.usage.cost += usage.cost?.total || 0;
              result.usage.contextTokens = usage.totalTokens || 0;
            }
            if (!result.model && msg.model) result.model = msg.model;
            if (msg.errorMessage) result.errorMessage = msg.errorMessage;

            // Extract text content
            for (const part of msg.content) {
              if (part.type === "text") {
                result.output += part.text;
              }
            }
            emitUpdate();
          }
        }
      };

      proc.stdout.on("data", (data) => {
        const chunk = data.toString();
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) processLine(line);
      });

      proc.stderr.on("data", (data) => {
        const str = data.toString();
        result.stderr += str;
        log(`stderr: ${str.slice(0, 200)}`);
      });

      proc.on("close", (code) => {
        clearTimeout(timeout);
        if (buffer.trim()) processLine(buffer);
        log(`subprocess exited with code ${code}, output length: ${result.output.length}`);
        resolve(code ?? 0);
      });

      proc.on("error", () => {
        resolve(1);
      });

      if (signal) {
        const abortKill = () => {
          wasAborted = true;
          killProc("aborted");
        };
        if (signal.aborted) abortKill();
        else signal.addEventListener("abort", abortKill, { once: true });
      }
    });

    result.exitCode = stoppedEarly ? 0 : exitCode;
    if (wasAborted) throw new Error("Subagent was aborted");

    // Fallback: some models (notably Mistral Small) keep tool-calling until
    // end_turn without ever emitting an assistant text message, leaving
    // result.output empty. Synthesize a tool-call log so the main agent can
    // see what was explored instead of an opaque "(no output)". We keep the
    // result marked as success so the synthesized sections render normally.
    if (!result.output.trim() && exitCode === 0 && !result.errorMessage) {
      if (allCalls.length > 0) {
        const numbered = allCalls.map((c, i) => `${i + 1}. ${c}`).join("\n");
        result.output =
          `## Activity\n` +
          `The subagent ran ${allCalls.length} tool call${allCalls.length === 1 ? "" : "s"} ` +
          `but exited without producing a text summary.\n\n` +
          `${numbered}\n\n` +
          `## Summary\n` +
          `(No summary was produced. Consider re-running with a more specific query or a different model.)`;
      } else {
        result.output =
          `## Summary\n(Subagent exited without producing any output or tool calls.)`;
      }
    }

    return result;
  } finally {
    if (tmpPromptPath) {
      try {
        fs.unlinkSync(tmpPromptPath);
      } catch {
        /* ignore */
      }
    }
    if (tmpDir) {
      try {
        fs.rmdirSync(tmpDir);
      } catch {
        /* ignore */
      }
    }
  }
}
