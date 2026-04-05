/**
 * wt CLI helpers — command execution and worktree management.
 */

import { spawn } from "node:child_process";

// ── Pure helpers ────────────────────────────────────────────────────────────

export function generateBranchName(task: string): string {
	const slug = task
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 5)
		.join("-");
	const suffix = Date.now().toString(36);
	return `agent/${slug || "task"}-${suffix}`;
}

export function formatDuration(ms: number): string {
	const s = Math.round(ms / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	const rem = s % 60;
	return `${m}m${rem}s`;
}

// ── wt CLI wrappers ────────────────────────────────────────────────────────

interface WtWorktreeInfo {
	branch: string;
	path: string;
	is_current: boolean;
}

export async function execCommand(
	command: string,
	args: string[],
	cwd: string,
	signal?: AbortSignal,
	timeout?: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	return new Promise((resolve, reject) => {
		const proc = spawn(command, args, { cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });

		let stdout = "";
		let stderr = "";
		let settled = false;

		const timer = timeout
			? setTimeout(() => {
					settled = true;
					proc.kill("SIGTERM");
					setTimeout(() => {
						if (!proc.killed) proc.kill("SIGKILL");
					}, 5000);
					resolve({ stdout, stderr: stderr + "\nTimed out", exitCode: -1 });
				}, timeout)
			: null;

		proc.stdout.on("data", (d) => (stdout += d.toString()));
		proc.stderr.on("data", (d) => (stderr += d.toString()));
		proc.on("close", (code) => {
			if (settled) return;
			clearTimeout(timer!);
			resolve({ stdout, stderr, exitCode: code ?? 0 });
		});
		proc.on("error", (err) => {
			if (settled) return;
			clearTimeout(timer!);
			reject(err);
		});

		if (signal) {
			const kill = () => {
				settled = true;
				proc.kill("SIGTERM");
				setTimeout(() => {
					if (!proc.killed) proc.kill("SIGKILL");
				}, 5000);
			};
			if (signal.aborted) kill();
			else signal.addEventListener("abort", kill, { once: true });
		}
	});
}

export async function createWorktree(
	branch: string,
	cwd: string,
	signal?: AbortSignal,
): Promise<string> {
	const { stdout, stderr, exitCode } = await execCommand("wt", ["switch", "--create", branch], cwd, signal, 30_000);
	if (exitCode !== 0) {
		throw new Error(`wt switch --create failed (exit ${exitCode}): ${stderr || stdout}`);
	}

	// Discover the worktree path via wt list --format=json
	const listResult = await execCommand("wt", ["list", "--format=json"], cwd, signal, 10_000);
	if (listResult.exitCode !== 0) {
		throw new Error(`wt list failed (exit ${listResult.exitCode}): ${listResult.stderr}`);
	}

	const worktrees: WtWorktreeInfo[] = JSON.parse(listResult.stdout);
	const wt = worktrees.find((w) => w.branch === branch);
	if (!wt) {
		throw new Error(`Created worktree for branch "${branch}" not found in wt list output`);
	}

	return wt.path;
}

export async function mergeWorktree(
	worktreePath: string,
	targetBranch: string | undefined,
	noSquash: boolean,
	noVerify: boolean,
	signal?: AbortSignal,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	const args: string[] = ["merge"];
	if (targetBranch) args.push(targetBranch);
	if (noSquash) args.push("--no-squash");
	if (noVerify) args.push("--no-verify");
	args.push("-y"); // Skip approval prompts

	return execCommand("wt", args, worktreePath, signal, 120_000);
}

export async function removeWorktree(
	worktreePath: string,
	signal?: AbortSignal,
): Promise<void> {
	const { exitCode, stderr } = await execCommand("wt", ["remove", "--force"], worktreePath, signal, 30_000);
	if (exitCode !== 0) {
		console.log(`[wt-worktree] warning: wt remove failed (exit ${exitCode}): ${stderr}`);
	}
}
