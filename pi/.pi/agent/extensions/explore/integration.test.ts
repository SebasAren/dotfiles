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
		Optional: (schema: any) => ({ ...schema, optional: true }),
	},
}));

// Now import the extension after mocks are set up
import exploreExtension from "./index";

describe("explore extension", () => {
	it("can be loaded without errors", () => {
		// Mock ExtensionAPI
		const mockApi = {
			registerTool: mock(() => {}),
			registerCommand: mock(() => {}),
		};
		// Should not throw
		expect(() => exploreExtension(mockApi as any)).not.toThrow();
	});

	it("registers a tool named 'explore'", () => {
		const registeredTools: any[] = [];
		const mockApi = {
			registerTool: (tool: any) => {
				registeredTools.push(tool);
			},
			registerCommand: mock(() => {}),
		};
		exploreExtension(mockApi as any);
		expect(registeredTools).toHaveLength(1);
		expect(registeredTools[0].name).toBe("explore");
	});

	it("registers a command named 'explore'", () => {
		const registeredCommands: { name: string; command: any }[] = [];
		const mockApi = {
			registerTool: mock(() => {}),
			registerCommand: (name: string, command: any) => {
				registeredCommands.push({ name, command });
			},
		};
		exploreExtension(mockApi as any);
		expect(registeredCommands).toHaveLength(1);
		expect(registeredCommands[0].name).toBe("explore");
		expect(registeredCommands[0].command.description).toBeDefined();
	});
});