import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { checkApiKey, requireApiKey } from "./api-key";

describe("checkApiKey", () => {
	const originalWarn = console.warn;
	const warnings: string[] = [];

	beforeEach(() => {
		warnings.length = 0;
		console.warn = (...args: unknown[]) => warnings.push(String(args[0]));
	});

	afterEach(() => {
		console.warn = originalWarn;
	});

	it("returns the key when environment variable is set", () => {
		process.env.TEST_API_KEY_1 = "my-secret-key";
		const result = checkApiKey("my-tool", "TEST_API_KEY_1");
		expect(result).toBe("my-secret-key");
		expect(warnings).toHaveLength(0);
		delete process.env.TEST_API_KEY_1;
	});

	it("returns undefined and warns when environment variable is not set", () => {
		delete process.env.TEST_API_KEY_MISSING_1;
		const result = checkApiKey("my-tool", "TEST_API_KEY_MISSING_1");
		expect(result).toBeUndefined();
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain("TEST_API_KEY_MISSING_1");
		expect(warnings[0]).toContain("[my-tool]");
	});

	it("includes the export hint in the warning message", () => {
		delete process.env.TEST_API_KEY_MISSING_2;
		checkApiKey("exa-search", "TEST_API_KEY_MISSING_2");
		expect(warnings[0]).toContain("export TEST_API_KEY_MISSING_2='your-key'");
	});

	it("treats empty string as missing: warns but still returns empty string", () => {
		process.env.TEST_API_KEY_EMPTY = "";
		const result = checkApiKey("tool", "TEST_API_KEY_EMPTY");
		expect(result).toBe("");
		expect(warnings).toHaveLength(1);
		delete process.env.TEST_API_KEY_EMPTY;
	});
});

describe("requireApiKey", () => {
	it("returns the key when environment variable is set", () => {
		process.env.TEST_API_KEY_2 = "required-key";
		const result = requireApiKey("my-tool", "TEST_API_KEY_2");
		expect(result).toBe("required-key");
		delete process.env.TEST_API_KEY_2;
	});

	it("throws an error when environment variable is not set", () => {
		delete process.env.TEST_API_KEY_MISSING_3;
		expect(() => requireApiKey("my-tool", "TEST_API_KEY_MISSING_3")).toThrow(
			"TEST_API_KEY_MISSING_3 not set",
		);
	});

	it("includes the export hint in the error message", () => {
		delete process.env.TEST_API_KEY_MISSING_4;
		try {
			requireApiKey("context7", "TEST_API_KEY_MISSING_4");
			expect.unreachable("Should have thrown");
		} catch (err) {
			expect(err instanceof Error).toBe(true);
			expect((err as Error).message).toContain(
				"export TEST_API_KEY_MISSING_4='your-key'",
			);
		}
	});

	it("throws when env var is set to empty string", () => {
		process.env.TEST_API_KEY_EMPTY_2 = "";
		expect(() => requireApiKey("tool", "TEST_API_KEY_EMPTY_2")).toThrow(
			"TEST_API_KEY_EMPTY_2 not set",
		);
		delete process.env.TEST_API_KEY_EMPTY_2;
	});
});
