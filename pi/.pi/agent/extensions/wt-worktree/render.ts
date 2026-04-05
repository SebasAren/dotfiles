/**
 * wt-worktree TUI renderers for tool call and result display.
 */

import * as os from "node:os";
import { getMarkdownTheme } from "@mariozechner/pi-coding-agent";
import { Container, Markdown, Spacer, Text } from "@mariozechner/pi-tui";

import { formatTokens } from "@pi-ext/shared";

import type { TaskDetails } from "./index";
import { formatDuration } from "./wt-cli";

// ── renderCall ──────────────────────────────────────────────────────────────

export function renderCall(
	args: { task: string; branch?: string; model?: string; auto_merge?: boolean },
	theme: any,
	context: { lastComponent?: any },
	model: string | undefined,
): Text {
	const branch = args.branch || "(auto)";
	const displayModel = model || "default";
	const preview = args.task.length > 80 ? `${args.task.slice(0, 80)}...` : args.task;
	let content =
		theme.fg("toolTitle", theme.bold("wt_worktree_task ")) +
		theme.fg("accent", branch) +
		theme.fg("muted", ` [${displayModel}]`);
	content += `\n  ${theme.fg("dim", preview)}`;
	if (!args.auto_merge && args.auto_merge !== undefined) {
		content += `\n  ${theme.fg("warning", "no auto-merge")}`;
	}
	// Reuse existing component if available to avoid duplicate renders
	const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
	text.setText(content);
	return text;
}

// ── renderResult ────────────────────────────────────────────────────────────

export function renderResult(
	result: {
		content: Array<{ type: string; text?: string }>;
		details?: TaskDetails;
		isError?: boolean;
	},
	state: { expanded: boolean },
	theme: any,
): Text | Container {
	const details = result.details as TaskDetails | undefined;
	const text = result.content[0];
	const output = text?.type === "text" ? text.text : "(no output)";

	const isError = result.isError;
	const icon = isError ? theme.fg("error", "✗") : theme.fg("success", "✓");

	const sub = details?.subagentResult;
	const merge = details?.mergeResult;
	const phase = !sub ? "setup" : sub.exitCode !== 0 ? "implement" : merge && merge.exitCode !== 0 ? "merge" : "done";

	if (state.expanded) {
		const mdTheme = getMarkdownTheme();
		const container = new Container();

		// Header
		let header = `${icon} ${theme.fg("toolTitle", theme.bold("wt_worktree_task"))}`;
		if (details?.branch) header += ` ${theme.fg("accent", details.branch)}`;
		container.addChild(new Text(header, 0, 0));

		// Phase indicator
		const phaseLabel = { setup: "Setup", implement: "Implementation", merge: "Merge", done: "Complete" }[phase];
		container.addChild(new Text(theme.fg("muted", `Phase: ${phaseLabel}`), 0, 0));

		if (details?.worktreePath) {
			const home = os.homedir();
			const shortPath = details.worktreePath.startsWith(home)
				? `~${details.worktreePath.slice(home.length)}`
				: details.worktreePath;
			container.addChild(new Text(theme.fg("muted", `Worktree: ${shortPath}`), 0, 0));
		}

		container.addChild(new Spacer(1));

		// Subagent output
		if (output) {
			container.addChild(new Markdown(output.trim(), 0, 0, mdTheme));
		}

		// Usage
		if (sub?.usage) {
			const parts: string[] = [];
			if (sub.usage.turns) parts.push(`${sub.usage.turns} turn${sub.usage.turns > 1 ? "s" : ""}`);
			if (sub.usage.input) parts.push(`↑${formatTokens(sub.usage.input)}`);
			if (sub.usage.output) parts.push(`↓${formatTokens(sub.usage.output)}`);
			if (sub.usage.cost) parts.push(`$${sub.usage.cost.toFixed(4)}`);
			if (sub.model) parts.push(sub.model);
			if (details?.durationMs) parts.push(formatDuration(details.durationMs));
			if (parts.length > 0) {
				container.addChild(new Spacer(1));
				container.addChild(new Text(theme.fg("dim", parts.join(" ")), 0, 0));
			}
		}

		// Merge output
		if (merge) {
			container.addChild(new Spacer(1));
			const mergeIcon = merge.exitCode === 0 ? theme.fg("success", "✓") : theme.fg("error", "✗");
			container.addChild(new Text(`${mergeIcon} ${theme.fg("muted", "wt merge")}`, 0, 0));
			if (merge.stdout.trim()) {
				container.addChild(new Text(theme.fg("dim", merge.stdout.trim().split("\n").slice(-5).join("\n")), 0, 0));
			}
			if (merge.exitCode !== 0 && merge.stderr.trim()) {
				container.addChild(new Text(theme.fg("error", merge.stderr.trim().split("\n").slice(-3).join("\n")), 0, 0));
			}
		}

		return container;
	}

	// Collapsed
	const previewLines = output.split("\n").slice(0, 4).join("\n");
	let rendered = `${icon} ${theme.fg("toolTitle", theme.bold("wt_worktree_task"))}`;
	if (details?.branch) rendered += ` ${theme.fg("accent", details.branch)}`;

	if (isError) {
		rendered += `\n${theme.fg("error", previewLines)}`;
	} else {
		rendered += `\n${theme.fg("dim", previewLines)}`;
	}

	// Usage summary
	const usageParts: string[] = [];
	if (sub?.usage?.turns) usageParts.push(`${sub.usage.turns}t`);
	if (sub?.usage?.cost) usageParts.push(`$${sub.usage.cost.toFixed(4)}`);
	if (sub?.model) usageParts.push(sub.model);
	if (details?.durationMs) usageParts.push(formatDuration(details.durationMs));
	if (usageParts.length > 0) {
		rendered += `\n${theme.fg("dim", usageParts.join(" "))}`;
	}

	rendered += `\n${theme.fg("muted", "(Ctrl+O to expand)")}`;
	return new Text(rendered, 0, 0);
}
