import { describe, it, expect, mock } from "bun:test";

// Mock TUI components
mock.module("@mariozechner/pi-tui", () => ({
	Container: class Container {
		children: any[] = [];
		addChild(child: any) {
			this.children.push(child);
		}
	},
	Markdown: class Markdown {
		constructor(public text: string, x: number, y: number, theme?: any) {}
	},
	Spacer: class Spacer {
		constructor(public height: number) {}
	},
	Text: class Text {
		text: string;
		constructor(text: string, x: number, y: number) {
			this.text = text;
		}
		setText(t: string) {
			this.text = t;
		}
	},
}));

mock.module("@mariozechner/pi-coding-agent", () => ({
	getMarkdownTheme: () => ({}),
}));

import { renderCall, renderResult } from "./render";
import type { TaskDetails } from "./index";

function makeTheme() {
	return {
		fg: (_color: string, text: string) => `<${_color}>${text}</>`,
		bold: (text: string) => `<b>${text}</b>`,
	};
}

function makeTaskDetails(overrides: Partial<TaskDetails> = {}): TaskDetails {
	return {
		branch: "agent/test-branch",
		worktreePath: "/tmp/test-wt",
		subagentResult: {
			exitCode: 0,
			output: "Done.",
			stderr: "",
			usage: { input: 1000, output: 500, cacheRead: 0, cacheWrite: 0, cost: 0.05, contextTokens: 0, turns: 3 },
			model: "test-model",
		},
		durationMs: 45_000,
		autoMerge: true,
		...overrides,
	};
}

describe("renderCall", () => {
	it("shows branch and model", () => {
		const result = renderCall(
			{ task: "do something", branch: "fix-bug", model: "gpt-4" },
			makeTheme(),
			{},
			"gpt-4",
		);
		expect(result.text).toContain("fix-bug");
		expect(result.text).toContain("gpt-4");
	});

	it("shows '(auto)' when no branch provided", () => {
		const result = renderCall({ task: "do something" }, makeTheme(), {}, "default");
		expect(result.text).toContain("(auto)");
	});

	it("shows 'no auto-merge' warning", () => {
		const result = renderCall(
			{ task: "do something", auto_merge: false },
			makeTheme(),
			{},
			"default",
		);
		expect(result.text).toContain("no auto-merge");
	});

	it("does not show auto-merge warning when true", () => {
		const result = renderCall(
			{ task: "do something", auto_merge: true },
			makeTheme(),
			{},
			"default",
		);
		expect(result.text).not.toContain("no auto-merge");
	});

	it("truncates long task descriptions", () => {
		const longTask = "a".repeat(100);
		const result = renderCall({ task: longTask }, makeTheme(), {}, "default");
		expect(result.text).toContain("aaa...");
		expect(result.text).not.toContain("a".repeat(100));
	});

	it("reuses context.lastComponent", () => {
		const { Text } = require("@mariozechner/pi-tui");
		const existing = new Text("old", 0, 0);
		const result = renderCall({ task: "test" }, makeTheme(), { lastComponent: existing }, "default");
		expect(result).toBe(existing);
		expect(result.text).not.toBe("old");
	});
});

describe("renderResult — collapsed", () => {
	it("shows success icon and branch", () => {
		const result = renderResult(
			{
				content: [{ type: "text", text: "Done." }],
				details: makeTaskDetails(),
				isError: false,
			},
			{ expanded: false },
			makeTheme(),
		) as any;
		expect(result.text).toContain("✓");
		expect(result.text).toContain("agent/test-branch");
	});

	it("shows error icon when isError", () => {
		const result = renderResult(
			{
				content: [{ type: "text", text: "Failed." }],
				details: makeTaskDetails(),
				isError: true,
			},
			{ expanded: false },
			makeTheme(),
		) as any;
		expect(result.text).toContain("✗");
	});

	it("shows usage summary", () => {
		const result = renderResult(
			{
				content: [{ type: "text", text: "Done." }],
				details: makeTaskDetails(),
				isError: false,
			},
			{ expanded: false },
			makeTheme(),
		) as any;
		expect(result.text).toContain("3t");
		expect(result.text).toContain("$0.0500");
		expect(result.text).toContain("test-model");
		expect(result.text).toContain("45s");
	});

	it("shows expand hint", () => {
		const result = renderResult(
			{
				content: [{ type: "text", text: "Done." }],
				details: makeTaskDetails(),
				isError: false,
			},
			{ expanded: false },
			makeTheme(),
		) as any;
		expect(result.text).toContain("Ctrl+O to expand");
	});
});

describe("renderResult — expanded", () => {
	it("returns a Container with children", () => {
		const result = renderResult(
			{
				content: [{ type: "text", text: "Done." }],
				details: makeTaskDetails(),
				isError: false,
			},
			{ expanded: true },
			makeTheme(),
		) as any;
		expect(result.children).toBeDefined();
		expect(result.children.length).toBeGreaterThan(0);
	});

	it("shows phase 'Complete' for successful runs", () => {
		const result = renderResult(
			{
				content: [{ type: "text", text: "Done." }],
				details: makeTaskDetails(),
				isError: false,
			},
			{ expanded: true },
			makeTheme(),
		) as any;
		const texts = result.children.map((c: any) => c.text);
		const phaseText = texts.find((t: string) => t?.includes("Phase:"));
		expect(phaseText).toContain("Complete");
	});

	it("shows phase 'Implementation' when subagent failed", () => {
		const details = makeTaskDetails({
			subagentResult: {
				...makeTaskDetails().subagentResult,
				exitCode: 1,
			},
		});
		const result = renderResult(
			{
				content: [{ type: "text", text: "Failed." }],
				details,
				isError: true,
			},
			{ expanded: true },
			makeTheme(),
		) as any;
		const texts = result.children.map((c: any) => c.text);
		const phaseText = texts.find((t: string) => t?.includes("Phase:"));
		expect(phaseText).toContain("Implementation");
	});

	it("shows phase 'Merge' when merge failed", () => {
		const details = makeTaskDetails({
			mergeResult: { stdout: "", stderr: "conflict", exitCode: 1 },
		});
		const result = renderResult(
			{
				content: [{ type: "text", text: "Done." }],
				details,
				isError: false,
			},
			{ expanded: true },
			makeTheme(),
		) as any;
		const texts = result.children.map((c: any) => c.text);
		const phaseText = texts.find((t: string) => t?.includes("Phase:"));
		expect(phaseText).toContain("Merge");
	});

	it("shows phase 'Setup' when no subagent result", () => {
		const details = makeTaskDetails({
			subagentResult: undefined as any,
		});
		const result = renderResult(
			{
				content: [{ type: "text", text: "Setup." }],
				details,
				isError: false,
			},
			{ expanded: true },
			makeTheme(),
		) as any;
		const texts = result.children.map((c: any) => c.text);
		const phaseText = texts.find((t: string) => t?.includes("Phase:"));
		expect(phaseText).toContain("Setup");
	});

	it("includes merge output when present", () => {
		const details = makeTaskDetails({
			mergeResult: { stdout: "merged successfully", stderr: "", exitCode: 0 },
		});
		const result = renderResult(
			{
				content: [{ type: "text", text: "Done." }],
				details,
				isError: false,
			},
			{ expanded: true },
			makeTheme(),
		) as any;
		const texts = result.children.map((c: any) => c.text).filter(Boolean);
		const mergeText = texts.find((t: string) => t.includes("merged successfully"));
		expect(mergeText).toBeDefined();
	});

	it("includes merge stderr in error color when merge failed", () => {
		const details = makeTaskDetails({
			mergeResult: { stdout: "", stderr: "merge conflict in file.ts", exitCode: 1 },
		});
		const result = renderResult(
			{
				content: [{ type: "text", text: "Done." }],
				details,
				isError: false,
			},
			{ expanded: true },
			makeTheme(),
		) as any;
		const texts = result.children.map((c: any) => c.text).filter(Boolean);
		const errorText = texts.find((t: string) => t.includes("merge conflict"));
		expect(errorText).toBeDefined();
	});
});
