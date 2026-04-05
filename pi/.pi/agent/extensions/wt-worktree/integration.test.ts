import { describe, it, expect, mock, beforeEach } from "bun:test";
import {
	piCodingAgentMock,
	piTuiMock,
	typeboxMock,
} from "@pi-ext/shared/test-mocks";

// Mock external dependencies with shared mock factories
mock.module("@mariozechner/pi-coding-agent", piCodingAgentMock);
mock.module("@mariozechner/pi-tui", piTuiMock);
mock.module("@sinclair/typebox", typeboxMock);

import wtWorktreeExtension from "./index";

describe("wt-worktree extension", () => {
	beforeEach(() => {
		// Reset child env var to ensure tool registration
		delete process.env.WT_WORKTREE_CHILD;
	});

	it("can be loaded without errors", () => {
		const mockApi = {
			registerTool: mock(() => {}),
			registerCommand: mock(() => {}),
		};
		expect(() => wtWorktreeExtension(mockApi as any)).not.toThrow();
	});

	it("registers a tool named 'wt_worktree_task'", () => {
		const registeredTools: any[] = [];
		const mockApi = {
			registerTool: (tool: any) => {
				registeredTools.push(tool);
			},
			registerCommand: mock(() => {}),
		};
		wtWorktreeExtension(mockApi as any);
		expect(registeredTools).toHaveLength(1);
		expect(registeredTools[0].name).toBe("wt_worktree_task");
	});

	it("skips registration in child processes", () => {
		process.env.WT_WORKTREE_CHILD = "1";
		const mockApi = {
			registerTool: mock(() => {}),
			registerCommand: mock(() => {}),
		};
		wtWorktreeExtension(mockApi as any);
		expect(mockApi.registerTool).not.toHaveBeenCalled();
		delete process.env.WT_WORKTREE_CHILD;
	});

	it("declares @pi-ext/shared as a workspace dependency", async () => {
		const pkg = await import("./package.json");
		expect(pkg.dependencies).toBeDefined();
		expect(pkg.dependencies["@pi-ext/shared"]).toBe("workspace:*");
	});
});
