import { describe, it, expect, mock, afterAll } from "bun:test";

// Mock external dependencies
mock.module("@upstash/context7-sdk", () => ({
	Context7: class Context7 {},
	Context7Error: class Context7Error extends Error {},
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

import context7Extension from "./index";

describe.skip("context7 extension", () => {
	const origKey = process.env.CONTEXT7_API_KEY;

	it("can be loaded without errors", () => {
		delete process.env.CONTEXT7_API_KEY;
		const mockApi = {
			registerTool: mock(() => {}),
			registerCommand: mock(() => {}),
		};
		expect(() => context7Extension(mockApi as any)).not.toThrow();
	});

	it("registers two tools (context7_search and context7_docs)", () => {
		delete process.env.CONTEXT7_API_KEY;
		const registeredTools: any[] = [];
		const mockApi = {
			registerTool: (tool: any) => registeredTools.push(tool),
			registerCommand: mock(() => {}),
		};
		context7Extension(mockApi as any);
		expect(registeredTools).toHaveLength(2);
		expect(registeredTools[0].name).toBe("context7_search");
		expect(registeredTools[1].name).toBe("context7_docs");
	});

	it("registers a command named 'context7'", () => {
		delete process.env.CONTEXT7_API_KEY;
		const registeredCommands: { name: string; command: any }[] = [];
		const mockApi = {
			registerTool: mock(() => {}),
			registerCommand: (name: string, command: any) => {
				registeredCommands.push({ name, command });
			},
		};
		context7Extension(mockApi as any);
		expect(registeredCommands).toHaveLength(1);
		expect(registeredCommands[0].name).toBe("context7");
	});

	// Restore API key
	afterAll(() => {
		if (origKey !== undefined) process.env.CONTEXT7_API_KEY = origKey;
		else delete process.env.CONTEXT7_API_KEY;
	});
});
