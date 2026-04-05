import { describe, it, expect, mock } from "bun:test";
import {
	piTuiMock,
} from "../shared/src/test-mocks";

// Mock external dependencies with shared mock factories
mock.module("@mariozechner/pi-tui", piTuiMock);

// Now import the extension after mocks are set up
import planModeExtension from "./index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type RegisteredCommand = {
	name: string;
	def: { description: string; handler: (args: string[], ctx: any) => Promise<void> };
};

type RegisteredShortcut = {
	key: string;
	def: { description: string; handler: (ctx: any) => Promise<void> };
};

function createMockApi() {
	const commands: RegisteredCommand[] = [];
	const shortcuts: RegisteredShortcut[] = [];
	const flags: { name: string; def: any }[] = [];
	let activeTools: string[] | undefined;
	const entries: { customType: string; data?: any }[] = [];
	const sentMessages: any[] = [];
	const sentUserMessages: any[] = [];

	return {
		commands,
		shortcuts,
		flags,
		activeTools,
		entries,
		sentMessages,
		sentUserMessages,
		api: {
			registerCommand: mock((name: string, def: any) => {
				commands.push({ name, def });
			}),
			registerShortcut: mock((key: string, def: any) => {
				shortcuts.push({ key, def });
			}),
			registerFlag: mock((name: string, def: any) => {
				flags.push({ name, def });
			}),
			setActiveTools: mock((tools: string[]) => {
				activeTools = tools;
			}),
			registerTool: mock(() => {}),
			on: mock(() => {}),
			getFlag: mock(() => false),
			appendEntry: mock((customType: string, data?: any) => {
				entries.push({ customType, data });
			}),
			sendMessage: mock((msg: any, opts?: any) => {
				sentMessages.push({ msg, opts });
			}),
			sendUserMessage: mock((content: any, opts?: any) => {
				sentUserMessages.push({ content, opts });
			}),
		} as any,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("plan mode extension", () => {
	it("can be loaded without errors", () => {
		const { api } = createMockApi();
		expect(() => planModeExtension(api)).not.toThrow();
	});

	it("registers /plan command", () => {
		const { api, commands } = createMockApi();
		planModeExtension(api);
		const plan = commands.find((c) => c.name === "plan");
		expect(plan).toBeDefined();
		expect(plan!.def.description).toContain("Toggle plan mode");
	});

	it("registers /plan-progress command", () => {
		const { api, commands } = createMockApi();
		planModeExtension(api);
		const progress = commands.find((c) => c.name === "plan-progress");
		expect(progress).toBeDefined();
		expect(progress!.def.description).toContain("progress");
	});

	it("registers /plan-exec-fresh command", () => {
		const { api, commands } = createMockApi();
		planModeExtension(api);
		const freshExec = commands.find((c) => c.name === "plan-exec-fresh");
		expect(freshExec).toBeDefined();
		expect(freshExec!.def.description).toContain("fresh session");
	});

	it("registers Ctrl+Alt+P shortcut", () => {
		const { api, shortcuts } = createMockApi();
		planModeExtension(api);
		expect(shortcuts).toHaveLength(1);
		expect(shortcuts[0].key).toBe("ctrl-alt-p");
		expect(shortcuts[0].def.description).toContain("Toggle plan mode");
	});

	it("registers plan flag", () => {
		const { api, flags } = createMockApi();
		planModeExtension(api);
		expect(flags).toHaveLength(1);
		expect(flags[0].name).toBe("plan");
		expect(flags[0].def.type).toBe("boolean");
		expect(flags[0].def.default).toBe(false);
	});

	describe("/plan command handler", () => {
		it("enables plan mode on first toggle", async () => {
			const { api, commands } = createMockApi();
			planModeExtension(api);

			const planCmd = commands.find((c) => c.name === "plan")!;
			const mockCtx = {
				ui: {
					notify: mock(() => {}),
					setStatus: mock(() => {}),
					setWidget: mock(() => {}),
					theme: { fg: mock((_: string, t: string) => t), strikethrough: mock((t: string) => t) },
				},
				hasUI: true,
			};

			await planCmd.def.handler([], mockCtx);

			expect(api.setActiveTools).toHaveBeenCalledWith([
				"read",
				"bash",
				"grep",
				"find",
				"ls",
				"questionnaire",
				"explore",
				"librarian",
			]);
		});

		it("restores full tools on second toggle", async () => {
			const { api, commands } = createMockApi();
			planModeExtension(api);

			const planCmd = commands.find((c) => c.name === "plan")!;
			const mockCtx = {
				ui: {
					notify: mock(() => {}),
					setStatus: mock(() => {}),
					setWidget: mock(() => {}),
					theme: { fg: mock((_: string, t: string) => t), strikethrough: mock((t: string) => t) },
				},
				hasUI: true,
			};

			// Toggle on
			await planCmd.def.handler([], mockCtx);
			// Toggle off
			await planCmd.def.handler([], mockCtx);

			expect(api.setActiveTools).toHaveBeenLastCalledWith(["read", "bash", "edit", "write"]);
		});
	});

	describe("/plan-exec-fresh command handler", () => {
		it("notifies error when no pending todos", async () => {
			const { api, commands } = createMockApi();
			planModeExtension(api);

			const freshCmd = commands.find((c) => c.name === "plan-exec-fresh")!;
			const notify = mock(() => {});
			await freshCmd.def.handler([], {
				ui: { notify },
				sessionManager: { getSessionFile: () => "/test/session.jsonl" },
			});

			expect(notify).toHaveBeenCalledWith("No plan steps to execute.", "error");
		});
	});

	describe("event handler registration", () => {
		it("registers 7 event handlers (tool_call, context, before_agent_start, turn_end, agent_end, session_start)", () => {
			const { api } = createMockApi();
			planModeExtension(api);
			// pi.on is called for: tool_call, context, before_agent_start, turn_end, agent_end, session_start
			expect(api.on).toHaveBeenCalledTimes(6);
		});

		it("registers events with event names", () => {
			const { api } = createMockApi();
			planModeExtension(api);
			const eventNames = api.on.mock.calls.map((call: any[]) => call[0]);
			expect(eventNames).toContain("tool_call");
			expect(eventNames).toContain("context");
			expect(eventNames).toContain("before_agent_start");
			expect(eventNames).toContain("turn_end");
			expect(eventNames).toContain("agent_end");
			expect(eventNames).toContain("session_start");
		});
	});
});
