import { describe, it, expect } from "bun:test";
import * as shared from "./index";

describe("index exports", () => {
	it("exports resolveRealCwd", () => {
		expect(typeof shared.resolveRealCwd).toBe("function");
	});

	it("exports formatTokens", () => {
		expect(typeof shared.formatTokens).toBe("function");
	});

	it("exports formatUsageLine", () => {
		expect(typeof shared.formatUsageLine).toBe("function");
	});

	it("exports parseSections", () => {
		expect(typeof shared.parseSections).toBe("function");
	});

	it("exports getSectionSummary", () => {
		expect(typeof shared.getSectionSummary).toBe("function");
	});

	it("exports getPiInvocation", () => {
		expect(typeof shared.getPiInvocation).toBe("function");
	});
});

// Type-only exports
import type { SubagentResult, UsageStats, SpawnOptions } from "./index";

describe("type exports", () => {
	it("exports SubagentResult type", () => {
		// Ensure the type is importable (compile-time check)
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
		expect(result.exitCode).toBe(0);
	});

	it("exports UsageStats type", () => {
		const usage: UsageStats = {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			cost: 0,
			contextTokens: 0,
			turns: 0,
		};
		expect(usage.turns).toBe(0);
	});

	it("exports SpawnOptions type", () => {
		const options: SpawnOptions = {
			cwd: "/tmp",
			args: [],
		};
		expect(options.cwd).toBe("/tmp");
	});
});