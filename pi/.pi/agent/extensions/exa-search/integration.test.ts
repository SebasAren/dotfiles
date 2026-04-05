import { describe, it, expect, mock, afterAll } from "bun:test";

// Mock external dependencies
mock.module("exa-js", () => ({}));

mock.module("@mariozechner/pi-coding-agent", () => ({
	DEFAULT_MAX_BYTES: 50000,
	DEFAULT_MAX_LINES: 500,
	truncateHead: (content: string) => ({ content, truncated: false }),
}));

mock.module("@sinclair/typebox", () => ({
	Type: {
		Object: (props: any) => ({ type: "object", ...props }),
		String: (props: any) => ({ type: "string", ...props }),
		Number: (props: any) => ({ type: "number", ...props }),
		Boolean: (props: any) => ({ type: "boolean", ...props }),
		Optional: (schema: any) => ({ ...schema, optional: true }),
		Array: (items: any, options: any) => ({ type: "array", items, ...options }),
		Unsafe: (schema: any) => schema,
	},
}));

mock.module("@mariozechner/pi-ai", () => ({
	StringEnum: (values: any, options: any) => ({ type: "string", enum: values, ...options }),
}));

import exaSearchExtension from "./index";

describe("exa-search extension", () => {
	const origKey = process.env.EXA_API_KEY;

	it("can be loaded without errors", () => {
		delete process.env.EXA_API_KEY;
		const mockApi = {
			registerTool: mock(() => {}),
			registerCommand: mock(() => {}),
		};
		expect(() => exaSearchExtension(mockApi as any)).not.toThrow();
	});

	it("registers two tools (web_search and web_fetch)", () => {
		delete process.env.EXA_API_KEY;
		const registeredTools: any[] = [];
		const mockApi = {
			registerTool: (tool: any) => registeredTools.push(tool),
			registerCommand: mock(() => {}),
		};
		exaSearchExtension(mockApi as any);
		expect(registeredTools).toHaveLength(2);
		expect(registeredTools[0].name).toBe("web_search");
		expect(registeredTools[1].name).toBe("web_fetch");
	});

	it("registers a command named 'search'", () => {
		delete process.env.EXA_API_KEY;
		const registeredCommands: { name: string; command: any }[] = [];
		const mockApi = {
			registerTool: mock(() => {}),
			registerCommand: (name: string, command: any) => {
				registeredCommands.push({ name, command });
			},
		};
		exaSearchExtension(mockApi as any);
		expect(registeredCommands).toHaveLength(1);
		expect(registeredCommands[0].name).toBe("search");
		expect(registeredCommands[0].command.description).toBeDefined();
	});

	afterAll(() => {
		if (origKey !== undefined) process.env.EXA_API_KEY = origKey;
		else delete process.env.EXA_API_KEY;
	});
});
