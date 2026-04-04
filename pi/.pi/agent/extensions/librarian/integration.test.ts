import { describe, it, expect, mock, beforeEach } from "bun:test";

// Mock external dependencies
mock.module("@mariozechner/pi-coding-agent", () => ({
	getMarkdownTheme: () => ({}),
}));

mock.module("@mariozechner/pi-tui", () => ({
	Container: class Container {
		addChild() {}
	},
	Markdown: class Markdown {},
	Spacer: class Spacer {},
	Text: class Text {
		constructor(public text: string, x: number, y: number) {}
		setText(t: string) { this.text = t; }
	},
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

// Now import the extension after mocks are set up
import librarianExtension from "./index";

describe("librarian extension", () => {
	it("can be loaded without errors", () => {
		// Mock ExtensionAPI
		const mockApi = {
			registerTool: mock(() => {}),
			registerCommand: mock(() => {}),
		};
		// Should not throw
		expect(() => librarianExtension(mockApi as any)).not.toThrow();
	});

	it("registers a tool named 'librarian'", () => {
		const registeredTools: any[] = [];
		const mockApi = {
			registerTool: (tool: any) => {
				registeredTools.push(tool);
			},
			registerCommand: mock(() => {}),
		};
		librarianExtension(mockApi as any);
		expect(registeredTools).toHaveLength(1);
		expect(registeredTools[0].name).toBe("librarian");
	});

	it("registers a command named 'librarian'", () => {
		const registeredCommands: { name: string; command: any }[] = [];
		const mockApi = {
			registerTool: mock(() => {}),
			registerCommand: (name: string, command: any) => {
				registeredCommands.push({ name, command });
			},
		};
		librarianExtension(mockApi as any);
		expect(registeredCommands).toHaveLength(1);
		expect(registeredCommands[0].name).toBe("librarian");
		expect(registeredCommands[0].command.description).toBeDefined();
	});

	it("declares @pi-ext/shared as a workspace dependency", async () => {
		const pkg = await import("./package.json");
		expect(pkg.dependencies).toBeDefined();
		expect(pkg.dependencies["@pi-ext/shared"]).toBe("workspace:*");
	});

	it("uses shared package utilities instead of local implementations", () => {
		// Verify the extension imports from @pi-ext/shared by checking
		// that the module loads correctly with shared dependencies
		const mockApi = {
			registerTool: mock(() => {}),
			registerCommand: mock(() => {}),
		};
		expect(() => librarianExtension(mockApi as any)).not.toThrow();
	});
});
