/**
 * Git Checkpoint Extension
 *
 * Creates git stash checkpoints at each turn so /fork can restore code state.
 * When forking, offers to restore code to that point in history.
 *
 * Works in both regular repos and git worktrees (detected via .git file).
 * Clean commits skip checkpointing (nothing to stash), keeping the map lean.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	/** Map from entry ID → git stash ref */
	const checkpoints = new Map<string, string>();

	/** Entry ID of the most recent user/tool message before the current turn */
	let currentEntryId: string | undefined;

	// Track the current entry ID as messages are saved
	pi.on("tool_result", async (_event, ctx) => {
		const leaf = ctx.sessionManager.getLeafEntry();
		if (leaf) currentEntryId = leaf.id;
	});

	// Before each LLM turn, create a stash checkpoint
	pi.on("turn_start", async () => {
		const { stdout } = await pi.exec("git", ["stash", "create"]);
		const ref = stdout.trim();
		if (ref && currentEntryId) {
			checkpoints.set(currentEntryId, ref);
		}
	});

	// When forking, offer to restore code to the checkpoint
	pi.on("session_before_fork", async (event, ctx) => {
		const ref = checkpoints.get(event.entryId);
		if (!ref) return;

		if (!ctx.hasUI) return;

		const choice = await ctx.ui.select("Restore code state?", [
			"Yes, restore code to that point",
			"No, keep current code",
		]);

		if (choice?.startsWith("Yes")) {
			await pi.exec("git", ["stash", "apply", ref]);
			ctx.ui.notify("Code restored to checkpoint", "info");
		}
	});

	// Clean up after agent completes
	pi.on("agent_end", async () => {
		checkpoints.clear();
	});
}
