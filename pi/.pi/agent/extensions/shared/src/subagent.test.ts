import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";

// We test the model option by mocking child_process.spawn to capture the
// args that runSubagent builds, rather than spawning a real subprocess.

const originalSpawn = require("node:child_process").spawn;

let capturedArgs: string[] | null = null;
let capturedEnv: Record<string, string> | null = null;

function mockSpawn(command: string, args: string[], options: any) {
	capturedArgs = args;
	capturedEnv = options?.env || null;

	// Return a fake child process that immediately closes with success
	const listeners: Record<string, Function[]> = {};
	const fakeProc = {
		stdin: { end: () => {} },
		stdout: {
			on: (event: string, cb: Function) => {
				if (event === "data") {
					// Emit a minimal message_end event so the runner can parse usage
					cb(
						Buffer.from(
							JSON.stringify({
								type: "message_end",
								message: {
									role: "assistant",
									content: [{ type: "text", text: "test output" }],
									usage: { input: 100, output: 50, totalTokens: 150, cost: { total: 0.01 } },
									model: "test-model",
								},
							}) + "\n",
						),
					);
				}
			},
		},
		stderr: { on: () => {} },
		on: (event: string, cb: Function) => {
			if (!listeners[event]) listeners[event] = [];
			listeners[event].push(cb);
			if (event === "close") {
				setTimeout(() => cb(0), 10);
			}
			if (event === "error") {
				// don't trigger
			}
		},
		kill: () => {},
		killed: false,
	};
	return fakeProc;
}

mock.module("node:child_process", () => ({
	spawn: mockSpawn,
	execSync: () => {},
}));

import { runSubagent } from "./subagent";

describe("runSubagent model option", () => {
	const originalCheapModel = process.env.CHEAP_MODEL;

	beforeEach(() => {
		capturedArgs = null;
		capturedEnv = null;
		delete process.env.CHEAP_MODEL;
		delete process.env.TMUX;
	});

	afterEach(() => {
		if (originalCheapModel !== undefined) {
			process.env.CHEAP_MODEL = originalCheapModel;
		} else {
			delete process.env.CHEAP_MODEL;
		}
	});

	it("passes --model to subprocess when model option is provided", async () => {
		const result = await runSubagent({
			cwd: "/tmp",
			query: "test query",
			systemPrompt: "test prompt",
			baseFlags: ["--no-session"],
			model: "my-custom-model",
		});

		expect(capturedArgs).not.toBeNull();
		expect(capturedArgs!).toContain("--model");
		const modelIdx = capturedArgs!.indexOf("--model");
		expect(capturedArgs![modelIdx + 1]).toBe("my-custom-model");
	});

	it("falls back to CHEAP_MODEL when model option is not provided", async () => {
		process.env.CHEAP_MODEL = "cheap-model-from-env";

		await runSubagent({
			cwd: "/tmp",
			query: "test query",
			systemPrompt: "test prompt",
			baseFlags: [],
		});

		expect(capturedArgs).not.toBeNull();
		expect(capturedArgs!).toContain("--model");
		const modelIdx = capturedArgs!.indexOf("--model");
		expect(capturedArgs![modelIdx + 1]).toBe("cheap-model-from-env");
	});

	it("prefers model option over CHEAP_MODEL", async () => {
		process.env.CHEAP_MODEL = "cheap-model";

		await runSubagent({
			cwd: "/tmp",
			query: "test query",
			systemPrompt: "test prompt",
			baseFlags: [],
			model: "override-model",
		});

		expect(capturedArgs!).toContain("--model");
		const modelIdx = capturedArgs!.indexOf("--model");
		expect(capturedArgs![modelIdx + 1]).toBe("override-model");
	});

	it("does not pass --model when neither option nor CHEAP_MODEL is set", async () => {
		await runSubagent({
			cwd: "/tmp",
			query: "test query",
			systemPrompt: "test prompt",
			baseFlags: [],
		});

		expect(capturedArgs).not.toBeNull();
		expect(capturedArgs!).not.toContain("--model");
	});
});

describe("runSubagent env option", () => {
	beforeEach(() => {
		capturedArgs = null;
		capturedEnv = null;
		delete process.env.CHEAP_MODEL;
		delete process.env.TMUX;
	});

	it("passes extra env vars to the subprocess", async () => {
		await runSubagent({
			cwd: "/tmp",
			query: "test",
			systemPrompt: "test",
			baseFlags: [],
			env: { MY_CUSTOM_VAR: "hello" },
		});

		expect(capturedEnv).not.toBeNull();
		expect(capturedEnv!.MY_CUSTOM_VAR).toBe("hello");
	});
});

describe("runSubagent baseFlags", () => {
	beforeEach(() => {
		capturedArgs = null;
		delete process.env.CHEAP_MODEL;
		delete process.env.TMUX;
	});

	it("includes base flags in the subprocess args", async () => {
		await runSubagent({
			cwd: "/tmp",
			query: "test",
			systemPrompt: "test",
			baseFlags: ["--no-session", "--no-extensions"],
		});

		expect(capturedArgs).not.toBeNull();
		expect(capturedArgs!).toContain("--no-session");
		expect(capturedArgs!).toContain("--no-extensions");
	});

	it("always includes --mode json and -p", async () => {
		await runSubagent({
			cwd: "/tmp",
			query: "test",
			systemPrompt: "test",
			baseFlags: [],
		});

		expect(capturedArgs!).toContain("--mode");
		expect(capturedArgs!).toContain("json");
		expect(capturedArgs!).toContain("-p");
	});
});

describe("runSubagent debugLabel", () => {
	const logs: string[] = [];
	const originalLog = console.log;

	beforeEach(() => {
		logs.length = 0;
		console.log = (...args: unknown[]) => logs.push(String(args[0]));
		delete process.env.CHEAP_MODEL;
		delete process.env.TMUX;
	});

	afterEach(() => {
		console.log = originalLog;
	});

	it("logs debug messages when debugLabel is set", async () => {
		await runSubagent({
			cwd: "/tmp",
			query: "test",
			systemPrompt: "test",
			baseFlags: [],
			debugLabel: "my-tool",
		});

		const debugLogs = logs.filter((l) => l.includes("[my-tool]"));
		expect(debugLogs.length).toBeGreaterThan(0);
	});

	it("suppresses debug messages when debugLabel is not set", async () => {
		await runSubagent({
			cwd: "/tmp",
			query: "test",
			systemPrompt: "test",
			baseFlags: [],
		});

		const debugLogs = logs.filter((l) => l.includes("[") && l.includes("]"));
		expect(debugLogs.length).toBe(0);
	});
});
