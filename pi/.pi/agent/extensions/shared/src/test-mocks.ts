/**
 * Shared mock factory functions for extension tests.
 *
 * Each extension test file should call `mock.module()` with these factories
 * at the top level (before importing the extension under test) so that
 * Bun's mock-hoisting works correctly. Using a single shared definition
 * prevents conflicting mocks when all tests run in the same process.
 *
 * Usage:
 *   import { mock } from "bun:test";
 *   import {
 *     piCodingAgentMock,
 *     piTuiMock,
 *     typeboxMock,
 *   } from "@pi-ext/shared/test-mocks";
 *
 *   mock.module("@mariozechner/pi-coding-agent", piCodingAgentMock);
 *   mock.module("@mariozechner/pi-tui", piTuiMock);
 *   mock.module("@sinclair/typebox", typeboxMock);
 *
 *   import myExtension from "./index";
 */

/**
 * Complete mock for `@mariozechner/pi-coding-agent`.
 * Covers every export used by any extension:
 *   - `getMarkdownTheme` (explore, librarian, wt-worktree)
 *   - `createEditTool`   (fuzzy-edit)
 *   - `withFileMutationQueue` (fuzzy-edit)
 */
export const piCodingAgentMock = () => ({
	getMarkdownTheme: () => ({}),
	createEditTool: () => ({
		description: "edit tool",
		execute: () => {
			throw new Error("Could not find oldText in file.");
		},
	}),
	withFileMutationQueue: (_path: string, fn: () => Promise<any>) => fn(),
});

/**
 * Complete mock for `@mariozechner/pi-tui`.
 * Covers every export used by any extension:
 *   - `Container`, `Markdown`, `Spacer`, `Text` (explore, librarian, wt-worktree)
 *   - `Key` (plan-mode)
 */
export const piTuiMock = () => ({
	Container: class Container {
		addChild() {}
	},
	Markdown: class Markdown {},
	Spacer: class Spacer {},
	Text: class Text {
		constructor(public text: string, _x: number, _y: number) {}
		setText(t: string) {
			this.text = t;
		}
	},
	Key: {
		ctrlAlt: (key: string) => `ctrl-alt-${key}`,
	},
});

/**
 * Complete mock for `@sinclair/typebox`.
 * Covers every `Type.*` method used by any extension.
 */
export const typeboxMock = () => ({
	Type: {
		Object: (props: any) => ({ type: "object", ...props }),
		String: (props: any) => ({ type: "string", ...props }),
		Number: (props: any) => ({ type: "number", ...props }),
		Boolean: (props: any) => ({ type: "boolean", ...props }),
		Optional: (schema: any) => ({ ...schema, optional: true }),
		Array: (items: any, options: any) => ({ type: "array", items, ...options }),
		Unsafe: (schema: any) => schema,
	},
});
