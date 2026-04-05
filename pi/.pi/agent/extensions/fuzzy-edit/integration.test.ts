import { describe, it, expect, mock } from "bun:test";

// Mock external dependencies
mock.module("@mariozechner/pi-coding-agent", () => ({
	createEditTool: () => ({
		description: "edit tool description",
		execute: mock(() => {
			throw new Error("Could not find oldText in file");
		}),
	}),
	withFileMutationQueue: (_path: string, fn: () => any) => fn(),
}));

mock.module("@sinclair/typebox", () => ({
	Type: {
		Object: (props: any) => ({ type: "object", ...props }),
		String: (props: any) => ({ type: "string", ...props }),
		Boolean: (props: any) => ({ type: "boolean", ...props }),
		Optional: (schema: any) => ({ ...schema, optional: true }),
		Array: (items: any, options: any) => ({ type: "array", items, ...options }),
	},
}));

import fuzzyEditExtension from "./index";

describe("fuzzy-edit extension", () => {
	it("can be loaded without errors", () => {
		const mockApi = {
			registerTool: mock(() => {}),
		};
		expect(() => fuzzyEditExtension(mockApi as any)).not.toThrow();
	});

	it("registers a tool named 'edit'", () => {
		const registeredTools: any[] = [];
		const mockApi = {
			registerTool: (tool: any) => registeredTools.push(tool),
		};
		fuzzyEditExtension(mockApi as any);
		expect(registeredTools).toHaveLength(1);
		expect(registeredTools[0].name).toBe("edit");
	});

	it("has prepareArguments function", () => {
		const registeredTools: any[] = [];
		const mockApi = {
			registerTool: (tool: any) => registeredTools.push(tool),
		};
		fuzzyEditExtension(mockApi as any);
		expect(typeof registeredTools[0].prepareArguments).toBe("function");
	});
});
