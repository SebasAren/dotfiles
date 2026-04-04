import { describe, it, expect, mock, beforeAll, afterAll } from "bun:test";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Mock external dependencies
mock.module("@mariozechner/pi-coding-agent", () => ({
	createEditTool: () => ({
		description: "edit tool",
		execute: () => {
			throw new Error("Could not find oldText in file.");
		},
	}),
	withFileMutationQueue: (_path: string, fn: () => Promise<any>) => fn(),
}));

mock.module("@sinclair/typebox", () => ({
	Type: {
		Object: (props: any) => ({ type: "object", ...props }),
		String: (props: any) => ({ type: "string", ...props }),
		Array: (props: any) => ({ type: "array", ...props }),
	},
}));

// Import after mocks
import fuzzyEditExtension from "./index";

// ── Helpers ──────────────────────────────────────────────────────────────────

const TEST_DIR = join(tmpdir(), "fuzzy-edit-test-" + process.pid);

async function setup() {
	await mkdir(TEST_DIR, { recursive: true });
}

async function teardown() {
	await rm(TEST_DIR, { recursive: true, force: true });
}

async function writeTestFile(name: string, content: string): Promise<string> {
	const path = join(TEST_DIR, name);
	await writeFile(path, content, "utf-8");
	return path;
}

function createTool() {
	const registeredTools: any[] = [];
	const mockApi = {
		registerTool: (tool: any) => registeredTools.push(tool),
		registerCommand: mock(() => {}),
	};
	fuzzyEditExtension(mockApi as any);
	expect(registeredTools).toHaveLength(1);
	return registeredTools[0];
}

async function executeEdit(tool: any, path: string, edits: Array<{ oldText: string; newText: string }>) {
	return tool.execute(
		"test-call-id",
		{ path, edits },
		undefined as any, // signal
		undefined as any, // onUpdate
		{ cwd: TEST_DIR }, // ctx
	);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("fuzzy-edit extension", () => {
	it("registers a tool named 'edit'", () => {
		const tool = createTool();
		expect(tool.name).toBe("edit");
	});

	it("has promptGuidelines", () => {
		const tool = createTool();
		expect(tool.promptGuidelines).toBeDefined();
		expect(tool.promptGuidelines.length).toBeGreaterThan(0);
	});

	it("has prepareArguments", () => {
		const tool = createTool();
		expect(typeof tool.prepareArguments).toBe("function");
	});
});

describe("prepareArguments", () => {
	it("normalizes legacy single-edit format to edits array", () => {
		const tool = createTool();
		const result = tool.prepareArguments({
			path: "test.ts",
			oldText: "foo",
			newText: "bar",
		});
		expect(result.edits).toHaveLength(1);
		expect(result.edits[0].oldText).toBe("foo");
		expect(result.edits[0].newText).toBe("bar");
		expect((result as any).oldText).toBeUndefined();
		expect((result as any).newText).toBeUndefined();
	});

	it("passes through edits array unchanged", () => {
		const tool = createTool();
		const result = tool.prepareArguments({
			path: "test.ts",
			edits: [{ oldText: "a", newText: "b" }],
		});
		expect(result.edits).toHaveLength(1);
	});

	it("merges legacy format with existing edits array", () => {
		const tool = createTool();
		const result = tool.prepareArguments({
			path: "test.ts",
			edits: [{ oldText: "a", newText: "b" }],
			oldText: "c",
			newText: "d",
		});
		expect(result.edits).toHaveLength(2);
	});

	it("returns args as-is when no legacy format", () => {
		const tool = createTool();
		const input = { path: "test.ts", edits: [{ oldText: "x", newText: "y" }] };
		const result = tool.prepareArguments(input);
		expect(result).toEqual(input);
	});
});

describe("fuzzy matching", () => {
	let tool: any;

	beforeAll(async () => {
		await setup();
		tool = createTool();
	});
	afterAll(teardown);

	// ── Tier 0: Exact match ──────────────────────────────────────────────

	it("replaces exact match", async () => {
		const path = await writeTestFile("exact.ts", "const x = 1;\nconst y = 2;\n");
		await executeEdit(tool, path, [
			{ oldText: "const y = 2;\n", newText: "const y = 3;\n" },
		]);
		const result = await readFile(path, "utf-8");
		expect(result).toBe("const x = 1;\nconst y = 3;\n");
	});

	// ── Tier 1: Tab-to-space normalization ────────────────────────────────

	it("matches tabs in file against spaces in oldText", async () => {
		const path = await writeTestFile("tab-file.ts", "\tconst a = 1;\n\tconst b = 2;\n\treturn a + b;\n");
		await executeEdit(tool, path, [
			{ oldText: "  const b = 2;\n  return a + b;\n", newText: "  const b = 99;\n  return a + b;\n" },
		]);
		const result = await readFile(path, "utf-8");
		expect(result).toContain("const b = 99;");
		expect(result).not.toContain("const b = 2;");
	});

	it("matches spaces in file against tabs in oldText", async () => {
		const path = await writeTestFile("space-file.ts", "  const a = 1;\n  const b = 2;\n  return a + b;\n");
		await executeEdit(tool, path, [
			{ oldText: "\tconst b = 2;\n\treturn a + b;\n", newText: "\tconst b = 99;\n\treturn a + b;\n" },
		]);
		const result = await readFile(path, "utf-8");
		expect(result).toContain("const b = 99;");
	});

	it("matches with trailing whitespace differences", async () => {
		const path = await writeTestFile("trailing.ts", "const x = 1;   \nconst y = 2;   \n");
		await executeEdit(tool, path, [
			{ oldText: "const x = 1;\nconst y = 2;\n", newText: "const x = 10;\nconst y = 20;\n" },
		]);
		const result = await readFile(path, "utf-8");
		expect(result).toContain("const x = 10;");
	});

	// ── Tier 2: Content-only matching ────────────────────────────────────

	it("matches with all whitespace different (content-only)", async () => {
		const path = await writeTestFile("content-only.ts", "    const   x   =   1;\n    const   y   =   2;\n");
		await executeEdit(tool, path, [
			{ oldText: "const x = 1;\nconst y = 2;\n", newText: "const x = 10;\nconst y = 20;\n" },
		]);
		const result = await readFile(path, "utf-8");
		expect(result).toContain("const x = 10;");
	});

	// ── Indentation depth ────────────────────────────────────────────────

	it("matches with different indentation depth", async () => {
		const path = await writeTestFile(
			"indent-depth.ts",
			"function f() {\n        const x = 1;\n        return x;\n}\n",
		);
		await executeEdit(tool, path, [
			{ oldText: "  const x = 1;\n  return x;\n", newText: "  const x = 42;\n  return x;\n" },
		]);
		const result = await readFile(path, "utf-8");
		expect(result).toContain("const x = 42;");
	});

	// ── Mixed indentation ────────────────────────────────────────────────

	it("matches with mixed tabs and spaces in file", async () => {
		const path = await writeTestFile(
			"mixed.ts",
			"function mixed() {\n    const x = 1;\n\tconst y = 2;\n    return x + y;\n}\n",
		);
		await executeEdit(tool, path, [
			{ oldText: "  const y = 2;\n  return x + y;\n", newText: "  const y = 20;\n  return x + y;\n" },
		]);
		const result = await readFile(path, "utf-8");
		expect(result).toContain("const y = 20;");
	});

	// ── Single line ──────────────────────────────────────────────────────

	it("matches single line with tab mismatch", async () => {
		const path = await writeTestFile("single.ts", "\tconsole.log('hello');\n");
		await executeEdit(tool, path, [
			{ oldText: "  console.log('hello');\n", newText: "  console.log('goodbye');\n" },
		]);
		const result = await readFile(path, "utf-8");
		expect(result).toContain("goodbye");
	});

	// ── BOM handling ─────────────────────────────────────────────────────

	it("handles file with BOM prefix", async () => {
		const path = await writeTestFile("bom.ts", "\uFEFFconst x = 1;\nconst y = 2;\n");
		await executeEdit(tool, path, [
			{ oldText: "const x = 1;\n", newText: "const x = 42;\n" },
		]);
		const result = await readFile(path, "utf-8");
		expect(result).toContain("const x = 42;");
		expect(result.startsWith("\uFEFF")).toBe(false);
	});

	// ── Multiple edits in one call ───────────────────────────────────────

	it("applies multiple edits in one call", async () => {
		const path = await writeTestFile("multi.ts", "const a = 1;\nconst b = 2;\nconst c = 3;\n");
		await executeEdit(tool, path, [
			{ oldText: "const a = 1;\n", newText: "const a = 10;\n" },
			{ oldText: "const c = 3;\n", newText: "const c = 30;\n" },
		]);
		const result = await readFile(path, "utf-8");
		expect(result).toBe("const a = 10;\nconst b = 2;\nconst c = 30;\n");
	});

	// ── Error cases ──────────────────────────────────────────────────────

	it("throws when oldText not found", async () => {
		const path = await writeTestFile("notfound.ts", "const x = 1;\n");
		expect(
			executeEdit(tool, path, [
				{ oldText: "const z = 99;\n", newText: "nope" },
			]),
		).rejects.toThrow("Could not find oldText");
	});

	it("throws when oldText matches multiple locations", async () => {
		const path = await writeTestFile("ambiguous.ts", "const x = 1;\nconst x = 1;\n");
		expect(
			executeEdit(tool, path, [
				{ oldText: "const x = 1;\n", newText: "const x = 2;\n" },
			]),
		).rejects.toThrow("2 matches");
	});

	it("throws when no changes produced", async () => {
		const path = await writeTestFile("nochange.ts", "const x = 1;\n");
		expect(
			executeEdit(tool, path, [
				{ oldText: "const x = 1;\n", newText: "const x = 1;\n" },
			]),
		).rejects.toThrow("No changes made");
	});

	it("throws for empty oldText", async () => {
		const path = await writeTestFile("empty.ts", "const x = 1;\n");
		expect(
			executeEdit(tool, path, [
				{ oldText: "", newText: "replacement" },
			]),
		).rejects.toThrow("oldText must not be empty");
	});

	it("throws for file not found", async () => {
		expect(
			executeEdit(tool, "nonexistent.ts", [
				{ oldText: "foo", newText: "bar" },
			]),
		).rejects.toThrow("File not found");
	});

	it("throws for empty edits array", async () => {
		const path = await writeTestFile("empty-edits.ts", "const x = 1;\n");
		expect(
			executeEdit(tool, path, []),
		).rejects.toThrow("edits must contain at least one replacement");
	});
});
