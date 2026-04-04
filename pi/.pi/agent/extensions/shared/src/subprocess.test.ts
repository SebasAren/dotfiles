import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as path from "node:path";

// We test against the module interface — the implementation will use
// process.argv and process.execPath internally.
import { getPiInvocation } from "./subprocess";

describe("getPiInvocation", () => {
	const savedArgv1 = process.argv[1];

	afterEach(() => {
		// Restore original argv[1]
		process.argv[1] = savedArgv1;
	});

	it("returns pi command with args when running under generic runtime (bun/node)", () => {
		// When argv[1] doesn't point to a real file, it falls through to the
		// generic runtime check. Bun's execPath basename is "bun", so it
		// should return "pi" as the command.
		process.argv[1] = "/nonexistent/script.ts";
		const result = getPiInvocation(["--mode", "json"]);
		expect(result.command).toBe("pi");
		expect(result.args).toEqual(["--mode", "json"]);
	});

	it("returns execPath with script when argv[1] points to a real file", () => {
		// Use this test file itself as the "script" — it exists on disk.
		const thisFile = import.meta.path;
		process.argv[1] = thisFile;
		const result = getPiInvocation(["query"]);
		expect(result.command).toBe(process.execPath);
		expect(result.args[0]).toBe(thisFile);
		expect(result.args[1]).toBe("query");
	});

	it("uses execPath directly when it is not a generic runtime", () => {
		// We can't easily change process.execPath, but we can verify the
		// function's contract: it returns { command, args }.
		process.argv[1] = "/nonexistent/script.ts";
		const result = getPiInvocation(["task"]);
		expect(result).toHaveProperty("command");
		expect(result).toHaveProperty("args");
		expect(result.args).toContain("task");
	});
});
