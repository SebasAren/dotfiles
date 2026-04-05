/**
 * Generic subagent subprocess runner.
 *
 * Manages the full lifecycle of spawning a pi subprocess for subagent tasks:
 * - Temp dir creation with system prompt file
 * - Optional tmux split pane with real-time pretty-printing
 * - Process spawning with JSON line parsing
 * - Usage tracking
 * - Loop detection and tool call limits (configurable)
 * - Timeout and abort signal handling
 * - Cleanup
 */

import { execSync, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { getPiInvocation } from "./subprocess.js";
import { argsSignature, detectLoop } from "./loop-detection.js";
import { getModel } from "./model.js";
import type { SubagentResult } from "./types.js";

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
	/** Callback for streaming updates */
	onUpdate?: (text: string) => void;
	/** Enable loop detection for tool calls (default: false) */
	loopDetection?: boolean;
	/** Maximum number of tool calls before stopping (default: Infinity) */
	maxToolCalls?: number;
	/** Enable tmux split pane for real-time output */
	tmux?: {
		/** Label shown in the tmux pane header (e.g. "explore", "librarian") */
		label: string;
	};
	/** Prefix for temp directory name (default: "pi-subagent-") */
	tmpPrefix?: string;
	/** Debug label for console.log messages (omit to suppress logs) */
	debugLabel?: string;
	/** Override the default subagent model (falls back to CHEAP_MODEL env var) */
	model?: string;
	/** Extra environment variables to set on the child process */
	env?: Record<string, string>;
}

/** Default timeout: 2 minutes */
const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Generic pretty-printer script for tmux pane.
 * Reads a growing JSONL file and renders tool calls + assistant text in real-time.
 * Usage: `node <script> <tmpDir> <label>`
 */
const PP_SCRIPT = String.raw`#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const tmpDir = process.argv[2] || "";
const label = process.argv[3] || "subagent";
const R = "\x1b[0m", B = "\x1b[1m", D = "\x1b[2m", C = "\x1b[36m", G = "\x1b[32m";

let query = "";
try { query = fs.readFileSync(path.join(tmpDir, "query.txt"), "utf8").trim(); } catch {}
if (query) {
  const firstLine = query.split("\n")[0];
  const preview = firstLine.length > 80 ? firstLine.slice(0, 80) + "..." : firstLine;
  process.stdout.write(B + C + "\u25b6 " + label + R + " " + D + preview + R + "\n");
  process.stdout.write(D + "\u2500".repeat(50) + R + "\n\n");
}

const outputPath = path.join(tmpDir, "subagent-output.jsonl");
let fd = -1;
let offset = 0;
let toolCount = 0;

function poll() {
  try {
    if (fd === -1) fd = fs.openSync(outputPath, "r");
    const stat = fs.fstatSync(fd);
    if (stat.size > offset) {
      const buf = Buffer.alloc(stat.size - offset);
      fs.readSync(fd, buf, 0, buf.length, offset);
      offset += buf.length;
      const newContent = buf.toString("utf8");
      for (const line of newContent.split("\n")) {
        if (!line.trim()) continue;
        let e;
        try { e = JSON.parse(line); } catch { continue; }
        if (e.type === "tool_execution_start") {
          toolCount++;
          const name = e.toolName || "?";
          let detail = "";
          if (e.args && e.args.query) detail = String(e.args.query).slice(0, 60);
          else if (e.args && e.args.path) detail = e.args.path;
          else if (e.args && e.args.command) detail = String(e.args.command).slice(0, 50);
          else if (e.args && e.args.pattern) detail = String(e.args.pattern).slice(0, 50);
          process.stdout.write(D + "[" + toolCount + "]" + R + " " + C + name + R + (detail ? ": " + D + detail + R : "") + "\n");
        } else if (e.type === "message_end" && e.message && e.message.role === "assistant") {
          for (const p of (e.message.content || [])) {
            if (p.type === "text" && p.text) process.stdout.write("\n" + p.text + "\n");
          }
        } else if (e.type === "subagent_done") {
          process.stdout.write("\n" + D + "\u2500".repeat(50) + R + "\n");
          process.stdout.write(G + B + "\u2713 " + label + " complete" + R + " (" + toolCount + " tool calls)\n");
          if (fd !== -1) fs.closeSync(fd);
          process.exit(0);
        }
      }
    }
  } catch (e) {
    if (e.code === "ENOENT") { process.exit(0); }
  }
  setTimeout(poll, 150);
}
poll();
`;

/**
 * Spawn a pi subprocess as a subagent and collect its output.
 *
 * Handles system prompt injection, optional tmux pretty-printing,
 * loop detection, tool call limits, timeout, and abort signals.
 */
export async function runSubagent(options: RunSubagentOptions): Promise<SubagentResult> {
	const model = options.model || getModel();
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
		tmux,
		tmpPrefix = "pi-subagent-",
		debugLabel,
	} = options;

	let tmpDir: string | null = null;
	let tmpPromptPath: string | null = null;
	let tmuxOutputPath: string | null = null;

	const result: SubagentResult = {
		exitCode: 0,
		output: "",
		stderr: "",
		usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
	};

	const emitUpdate = () => {
		onUpdate?.(result.output || "(running...)");
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
		const args = [
			"--mode", "json", "-p",
			...baseFlags,
			"--append-system-prompt", tmpPromptPath,
		];
		if (model) args.push("--model", model);
		args.push(query);

		// --- Tmux pane: tee JSONL to a file, pretty-print in a split pane ---
		if (process.env.TMUX && tmux) {
			try {
				// Write query for pane header
				await fs.promises.writeFile(path.join(tmpDir, "query.txt"), query, "utf8");

				// Write pretty-printer script
				const ppScriptPath = path.join(tmpDir, "subagent-pp.js");
				await fs.promises.writeFile(ppScriptPath, PP_SCRIPT, { mode: 0o755 });

				// Create empty output file
				tmuxOutputPath = path.join(tmpDir, "subagent-output.jsonl");
				await fs.promises.writeFile(tmuxOutputPath, "", "utf8");

				// Split tmux pane running the pretty-printer
				execSync(
					`tmux split-window -h -l 35% -t "${process.env.TMUX_PANE}" "node '${ppScriptPath}' '${tmpDir}' '${tmux.label}'; rm -rf '${tmpDir}'"`,
					{ stdio: "ignore" },
				);
			} catch (err) {
				// tmux pane setup failed, continuing without pane
				tmuxOutputPath = null;
			}
		}

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

				// Track tool calls for loop detection and limits
				if (event.type === "tool_execution_start" && event.toolName) {
					if (loopDetection || maxToolCalls < Infinity) {
						toolHistory.push({
							name: event.toolName,
							argsSignature: argsSignature(event.args || {}),
						});
					}

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
				if (tmuxOutputPath) {
					try { fs.appendFileSync(tmuxOutputPath, chunk); } catch { /* ignore */ }
				}
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
		return result;
	} finally {
		if (tmpPromptPath) {
			try { fs.unlinkSync(tmpPromptPath); } catch { /* ignore */ }
		}
		if (tmuxOutputPath) {
			// Signal the tmux pretty-printer to stop; its shell command cleans up tmpDir
			try { fs.appendFileSync(tmuxOutputPath, JSON.stringify({ type: "subagent_done" }) + "\n"); } catch { /* ignore */ }
		} else if (tmpDir) {
			try { fs.rmdirSync(tmpDir); } catch { /* ignore */ }
		}
	}
}
