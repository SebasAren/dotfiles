---
description: Pi extension development conventions, TDD, and gotchas
globs:
  - "pi/*"
  - "pi/**"
---

## Development Workflow

- **Always typecheck before committing**: `cd pi/.pi/agent/extensions && for dir in */; do [ -f "$dir/tsconfig.json" ] && npx tsc --noEmit -p "$dir/tsconfig.json"; done`
- **Always run tests before committing**: `cd pi/.pi/agent/extensions && bun test`
- **TDD discipline**: Write failing test first (RED) → minimum fix (GREEN) → refactor → typecheck → commit.

## CLI Gotchas

- **stdin piping = batch mode**: `pi < file` processes the file as a non-interactive batch prompt. Use `pi "@$file"` to include file content while staying interactive.
- **`--print` for non-interactive**: Use `pi -p "prompt"` or `--mode json` for scripted use.
- **No `--max-turns` flag**: Monitor the JSON event stream (`tool_execution_start` events) and kill externally when limits are exceeded.

## Bun / TypeScript Gotchas

- **Bun virtual path handling**: Bun virtualizes `process.cwd()` into `/bunfs/...` which doesn't exist for subprocesses. Pass the real cwd via env var (e.g., `PI_REAL_CWD`).
- **`mock.module()` cross-contamination**: Mocks are global across the test process. Use shared factories from `@pi-ext/shared/test-mocks` rather than inline mocks. The shared `piCodingAgentMock` must be a superset of **every** export any extension uses — a missing export in any mock registration will break other tests.
- **`mock.module()` last-registration-wins**: The last registration wins globally. Tests needing richer mocks must register their own `mock.module()` before importing. Never use inline mocks for `@mariozechner/pi-coding-agent` or `@sinclair/typebox` — always import from `@pi-ext/shared/test-mocks` to avoid missing exports (e.g. `Type.Literal`, `DefaultResourceLoader`, `SettingsManager`).
- **Two tiers of TUI mock**: Most tests need `piTuiMock` (`.text` access). Rendering tests need `piTuiRenderMock` (working `render()` methods). Use `piCodingAgentThemeMock` for asserting on content without ANSI noise.
- **`type: "text"` literal widening**: TypeScript widens `"text"` to `string` in tool result arrays. Use `type: "text" as const` or declare callback with literal type.
- **`AgentToolResult<unknown>` in renderResult**: `details` is typed as `unknown`. Cast with `as any` in the callback.
- **`@types/bun` required for `tsc`**: Add `"types": ["node", "bun"]` to tsconfig.
- **Exclude test files from tsconfig `include`**: Tests that mock modules can conflict with real types. Bun's test runner doesn't typecheck.
- **Bun parser: trailing commas after class expressions in objects**: `class {}` as an object property value must have a trailing comma. Missing comma reports the error on the *next* property line, not where the comma is missing, making it hard to spot.

## Extension Architecture

- **`renderCall` component reuse**: Reuse `context.lastComponent` instead of creating new `Text()` each call — causes duplicate renders.
- **Tool errors must be thrown, not returned**: Never catch errors in `execute()` and return them as text content — the framework treats returned results as successful calls. The model can't distinguish a failed edit from a successful one, which breaks retry logic. Always `throw new Error(...)` and let the framework handle error propagation.
- **Subagent output formatting**: Explore/librarian subagent thinking is concatenated text, not markdown. Split on sentence boundaries (`. `, `: `, `! `, `? `), not newlines. Use `splitIntoSentences()` from `@pi-ext/shared`.
- **Subagent thinking lacks spaces**: Output often has no space after periods. Use `\s*` (not `\s+`) after `[.!?]` in the regex.
- **Librarian auto-loads extensions**: Uses `--no-tools` but NOT `--no-extensions`. Tools from extensions are automatically available.
- **`parseSections` always creates ≥1 section**: The `splitIntoSentences` fallback only triggers for truly empty output, not "unstructured" text. Use `## Header` sections to exercise the section code path.
- **`@mariozechner/pi-agent-core` not available**: It's an internal dep of `pi-coding-agent`. Create local type aliases instead.
- **Subagent loop detection must set exitCode=0**: Override to 0 so the caller treats partial output as success.

## Model Configuration

- **Mistral Small 4** (`mistral-small-latest`): Must use `reasoning: false` in `models.json` — `reasoning: true` causes API errors despite native `reasoning_effort` support.
- **Moonshot/Kimi models** (`kimi-k2.6`, `kimi-k2.5`): Must add `"compat": { "supportsDeveloperRole": false }` — the API only accepts `system`/`user`/`assistant` roles and returns `ROLE_UNSPECIFIED` for the `developer` role.

## exa-js Typing

- **`Status` type gaps**: Lacks `error` field — use `any` cast when accessing `s.error?.tag`.
- **Highlights vs text options**: `HighlightsContentsOptions` uses `numSentences`/`highlightsPerUrl`, NOT `maxCharacters`. Calculate `numSentences = Math.ceil(maxChars / 200)`.

## Test Patterns

- **Unit tests**: Co-locate with source (e.g., `render.test.ts` next to `render.ts`).
- **Integration tests**: `integration.test.ts` per extension — tests full load/register cycle.
- **Shared test utilities**: Import from `@pi-ext/shared/test-mocks`.
- **Auto-discovery runner removed**: No longer using `__tests__/all-extensions.test.ts` — it spawned subprocesses with no timeout and caused cross-workspace resolution issues. Run `bun test` from `pi/.pi/agent/extensions/` instead.
- **Mock pattern**: `mock.module()` from `bun:test` before importing the module under test.

## New Extension Checklist

1. Create directory with `index.ts`, `package.json`, `tsconfig.json`
2. Write tests first (`index.test.ts` or `integration.test.ts`)
3. Implement the extension
4. Add to workspace `package.json` `workspaces` array
5. Verify tests pass and types check