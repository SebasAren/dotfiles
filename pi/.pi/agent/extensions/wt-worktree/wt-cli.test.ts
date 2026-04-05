import { describe, it, expect } from "bun:test";

import { generateBranchName, formatDuration } from "./wt-cli";

// ---------------------------------------------------------------------------
// generateBranchName
// ---------------------------------------------------------------------------

describe("generateBranchName", () => {
	it("produces a branch prefixed with 'agent/'", () => {
		expect(generateBranchName("fix login bug")).toMatch(/^agent\//);
	});

	it("slugifies the task into lowercase words", () => {
		const name = generateBranchName("Fix Login Bug");
		expect(name).toMatch(/^agent\/fix-login-bug-/);
	});

	it("limits to 5 words from the task", () => {
		const name = generateBranchName("one two three four five six seven");
		const slug = name.split("/")[1].split("-").slice(0, -1).join("-");
		expect(slug).toBe("one-two-three-four-five");
	});

	it("strips non-alphanumeric characters", () => {
		const name = generateBranchName("fix: refactor `foo()` & bar!");
		expect(name).toMatch(/^agent\/fix-refactor-foo-bar-/);
	});

	it("falls back to 'task' for empty or non-alphanumeric input", () => {
		const name = generateBranchName("!@#$%^&*()");
		expect(name).toMatch(/^agent\/task-/);
	});

	it("appends a unique suffix (base-36 timestamp)", async () => {
		const a = generateBranchName("same task");
		await new Promise((r) => setTimeout(r, 2));
		const b = generateBranchName("same task");
		expect(a).not.toBe(b);
	});

	it("handles single word tasks", () => {
		const name = generateBranchName("refactor");
		expect(name).toMatch(/^agent\/refactor-/);
	});

	it("handles empty string", () => {
		const name = generateBranchName("");
		expect(name).toMatch(/^agent\/task-/);
	});
});

// ---------------------------------------------------------------------------
// formatDuration
// ---------------------------------------------------------------------------

describe("formatDuration", () => {
	it("formats zero milliseconds", () => {
		expect(formatDuration(0)).toBe("0s");
	});

	it("formats seconds under 60", () => {
		expect(formatDuration(500)).toBe("1s");
		expect(formatDuration(30_000)).toBe("30s");
		expect(formatDuration(59_499)).toBe("59s");
	});

	it("formats minutes and seconds for >= 60s", () => {
		expect(formatDuration(60_000)).toBe("1m0s");
		expect(formatDuration(90_000)).toBe("1m30s");
		expect(formatDuration(600_000)).toBe("10m0s");
	});

	it("rounds to nearest second", () => {
		expect(formatDuration(1_500)).toBe("2s");
		expect(formatDuration(999)).toBe("1s");
	});

	it("formats large durations", () => {
		expect(formatDuration(3_600_000)).toBe("60m0s");
	});
});
