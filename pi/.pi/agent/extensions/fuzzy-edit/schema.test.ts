import { describe, it, expect } from "bun:test";

import { editSchema, replaceEditSchema, prepareArguments } from "./schema";

describe("editSchema", () => {
	it("has type 'object'", () => {
		expect(editSchema.type).toBe("object");
	});
});

describe("replaceEditSchema", () => {
	it("has type 'object'", () => {
		expect(replaceEditSchema.type).toBe("object");
	});
});

describe("prepareArguments", () => {
	it("converts legacy oldText/newText to edits array", () => {
		const result = prepareArguments({
			path: "test.ts",
			oldText: "foo",
			newText: "bar",
		});
		expect(result.path).toBe("test.ts");
		expect(result.edits).toHaveLength(1);
		expect(result.edits[0]).toEqual({ oldText: "foo", newText: "bar" });
	});

	it("merges legacy args with existing edits", () => {
		const result = prepareArguments({
			path: "test.ts",
			edits: [{ oldText: "a", newText: "b" }],
			oldText: "foo",
			newText: "bar",
		});
		expect(result.edits).toHaveLength(2);
		expect(result.edits[0]).toEqual({ oldText: "a", newText: "b" });
		expect(result.edits[1]).toEqual({ oldText: "foo", newText: "bar" });
	});

	it("passes through when no legacy args", () => {
		const input = {
			path: "test.ts",
			edits: [{ oldText: "a", newText: "b" }],
		};
		const result = prepareArguments(input);
		expect(result.edits).toHaveLength(1);
		expect(result.path).toBe("test.ts");
	});

	it("passes through null/undefined as-is", () => {
		expect(prepareArguments(null)).toBe(null);
		expect(prepareArguments(undefined)).toBe(undefined);
	});

	it("passes through when oldText/newText are not strings", () => {
		const input = {
			path: "test.ts",
			edits: [{ oldText: "a", newText: "b" }],
			oldText: 123,
			newText: true,
		};
		const result = prepareArguments(input);
		expect(result.edits).toHaveLength(1);
	});
});
