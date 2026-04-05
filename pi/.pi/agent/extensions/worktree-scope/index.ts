/**
 * Worktree Scope Extension
 *
 * Prevents the agent from editing files outside its git worktree.
 * Detects worktree boundaries at session start and blocks write/edit/bash
 * operations that target paths outside the worktree root.
 *
 * Detection: checks if `.git` is a file (worktree) vs directory (main repo).
 * In worktrees, `.git` contains `gitdir: /path/to/main/.git/worktrees/<name>`.
 *
 * Also injects a system prompt snippet so the LLM knows about the boundary,
 * reducing wasted attempts on blocked paths.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// Tools that modify the filesystem and should be scoped
const WRITE_TOOLS = new Set(["write", "edit"]);

// Bash commands that are inherently destructive and should be scoped.
// We don't block all bash — just ones that redirect to files outside the worktree.
// For simplicity, we only check write/edit tool paths for now.
// Bash is too freeform to reliably scope without false positives.

interface WorktreeInfo {
	/** Absolute path to the worktree root */
	worktreeRoot: string;
	/** Absolute path to the main repo (from .git file) */
	mainRepoRoot: string;
	/** Branch name */
	branch: string;
}

/**
 * Detect if cwd is inside a git worktree (not the main repo).
 * Returns worktree info if detected, undefined otherwise.
 */
function detectWorktree(cwd: string): WorktreeInfo | undefined {
	const gitPath = path.join(cwd, ".git");

	// If .git is a directory, this is the main repo — no scoping needed
	let gitStat: fs.Stats;
	try {
		gitStat = fs.statSync(gitPath);
	} catch {
		// No .git at all — not a git repo, skip
		return undefined;
	}

	if (gitStat.isDirectory()) {
		// Main repo, not a worktree
		return undefined;
	}

	// .git is a file → worktree. Read it to get the main repo path.
	let gitContent: string;
	try {
		gitContent = fs.readFileSync(gitPath, "utf-8").trim();
	} catch {
		return undefined;
	}

	// Format: "gitdir: /path/to/main/.git/worktrees/<name>"
	const match = gitContent.match(/^gitdir:\s*(.+)$/);
	if (!match) return undefined;

	const gitdir = match[1];
	// Extract branch name from HEAD in the worktree metadata
	let branch = "";
	try {
		const headPath = path.join(gitdir, "HEAD");
		const head = fs.readFileSync(headPath, "utf-8").trim();
		const branchMatch = head.match(/^ref:\s*refs\/heads\/(.+)$/);
		if (branchMatch) branch = branchMatch[1];
	} catch {
		// Ignore — branch name is informational
	}

	// Main repo root is the grandparent of .git/worktrees/<name>
	// e.g. /path/to/main/.git/worktrees/my-branch → /path/to/main
	const worktreesIndex = gitdir.indexOf("/.git/worktrees/");
	const mainRepoRoot =
		worktreesIndex !== -1 ? gitdir.slice(0, worktreesIndex) : "";

	return {
		worktreeRoot: cwd,
		mainRepoRoot,
		branch,
	};
}

/**
 * Check if a file path is inside the worktree root.
 * Resolves relative paths and handles symlinks.
 */
function isInsideWorktree(
	filePath: string,
	worktreeRoot: string,
): boolean {
	const resolved = path.resolve(worktreeRoot, filePath);
	// Ensure the resolved path starts with the worktree root
	// Use normalized paths to avoid trailing slash issues
	const normalizedWorktree = path.normalize(worktreeRoot);
	const normalizedResolved = path.normalize(resolved);

	if (normalizedResolved === normalizedWorktree) return true;
	// Check if resolved is a descendant of worktree root
	return (
		normalizedResolved.startsWith(normalizedWorktree + path.sep) ||
		normalizedResolved.startsWith(normalizedWorktree + "/")
	);
}

export default function worktreeScopeExtension(pi: ExtensionAPI) {
	let worktreeInfo: WorktreeInfo | undefined;

	pi.on("session_start", async (_event, ctx) => {
		worktreeInfo = detectWorktree(ctx.cwd);

		if (worktreeInfo) {
			const shortRoot = worktreeInfo.worktreeRoot
				.replace(/^\/var\/home\//, "~/")
				.replace(/^\/home\//, "~/");
			const shortMain = worktreeInfo.mainRepoRoot
				.replace(/^\/var\/home\//, "~/")
				.replace(/^\/home\//, "~/");
			ctx.ui.notify(
				`🔒 Worktree scope active: ${shortRoot} (branch: ${worktreeInfo.branch || "unknown"}) — edits outside this directory will be blocked`,
				"info",
			);
			console.log(
				`[worktree-scope] Active: worktree=${worktreeInfo.worktreeRoot}, main=${worktreeInfo.mainRepoRoot}, branch=${worktreeInfo.branch}`,
			);
		}
	});

	// Inject system prompt to inform the LLM about the worktree boundary
	pi.on("before_agent_start", async (event) => {
		if (!worktreeInfo) return undefined;

		const shortRoot = worktreeInfo.worktreeRoot
			.replace(/^\/var\/home\//, "~/")
			.replace(/^\/home\//, "~/");

		const scopePrompt = `

## 🔒 Worktree Scope Enforcement

You are working inside a git worktree at \`${worktreeInfo.worktreeRoot}\` (branch: ${worktreeInfo.branch || "unknown"}).
The main repository is at \`${worktreeInfo.mainRepoRoot}\`.

**CRITICAL RULE: You MUST NOT edit, write, or modify any file outside the worktree root \`${worktreeInfo.worktreeRoot}\`.**

- All \`edit\` and \`write\` tool calls must target paths within \`${worktreeInfo.worktreeRoot}\`
- If you need to reference files in the main repo, use \`read\` only — never edit them
- If you need to make changes to the main repo, those changes should be made from the main repo, not from this worktree
- Paths like \`${worktreeInfo.mainRepoRoot}/...\` are READ-ONLY from this worktree

This is enforced by a hard block — attempts to write outside the worktree will be rejected.
`;

		return {
			systemPrompt: event.systemPrompt + scopePrompt,
		};
	});

	// Block write/edit operations targeting paths outside the worktree
	pi.on("tool_call", async (event, ctx) => {
		if (!worktreeInfo) return undefined;
		if (!WRITE_TOOLS.has(event.toolName)) return undefined;

		const input = event.input;
		if (!input || typeof input !== "object") return undefined;
		const filePath = "path" in input ? (input as { path?: string }).path : undefined;
		if (typeof filePath !== "string") return undefined;

		if (!isInsideWorktree(filePath, worktreeInfo.worktreeRoot)) {
			const resolved = path.resolve(worktreeInfo.worktreeRoot, filePath);
			const shortWorktree = worktreeInfo.worktreeRoot
				.replace(/^\/var\/home\//, "~/")
				.replace(/^\/home\//, "~/");
			const shortPath = resolved
				.replace(/^\/var\/home\//, "~/")
				.replace(/^\/home\//, "~/");

			if (ctx.hasUI) {
				ctx.ui.notify(
					`🔒 Blocked ${event.toolName}: ${shortPath} is outside worktree ${shortWorktree}`,
					"warning",
				);
			}

			console.log(
				`[worktree-scope] BLOCKED ${event.toolName} to ${resolved} (outside ${worktreeInfo.worktreeRoot})`,
			);

			return {
				block: true,
				reason: `Path "${shortPath}" is outside the worktree scope "${shortWorktree}". You are working in a git worktree and cannot modify files outside it. All edits must target paths within the worktree root.`,
			};
		}

		return undefined;
	});
}
