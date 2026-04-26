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
- **`mock.module()` mock logic must match real module behavior**: When integration tests mock a local module (e.g., `./getLastAssistantMessage`), the mock implementation must replicate the real module's logic precisely (iteration direction, early-return vs continue, etc.). A mock returning wrong results for valid inputs will silently break unit tests for that module when all tests run together, even though both pass in isolation.
- **`mock.module()` last-registration-wins**: The last registration wins globally. Tests needing richer mocks must register their own `mock.module()` before importing. Never use inline mocks for `@mariozechner/pi-coding-agent` or `@sinclair/typebox` — always import from `@pi-ext/shared/test-mocks` to avoid missing exports (e.g. `Type.Literal`, `DefaultResourceLoader`, `SettingsManager`).
- **Two tiers of TUI mock**: Most tests need `piTuiMock` (`.text` access). Rendering tests need `piTuiRenderMock` (working `render()` methods). Use `piCodingAgentThemeMock` for asserting on content without ANSI noise.
- **`type: "text"` literal widening**: TypeScript widens `"text"` to `string` in tool result arrays. Use `type: "text" as const` or declare callback with literal type.
- **`renderResult` callback `details`**: The `details` parameter is typed as `unknown`. Cast with `as any` in the callback when accessing extension-specific fields.
- **`renderResult` callback `result`**: The entire `result` parameter typed as `AgentToolResult<unknown>` must be cast with `as any` when passed to typed render functions (e.g. `renderSearchResult(result as any, ...)`). The SDK does not expose a generic tool result type matching extension-specific `details`, so this cast is unavoidable.
- **`@types/bun` required for `tsc`**: Add `"types": ["node", "bun"]` to tsconfig.
- **Exclude test files from tsconfig `include`**: Tests that mock modules can conflict with real types. Bun's test runner doesn't typecheck.
- **Bun parser: trailing commas after class expressions in objects**: `class {}` as an object property value must have a trailing comma. Missing comma reports the error on the *next* property line, not where the comma is missing, making it hard to spot.

## Extension Architecture

- **`turn_end` message shape**: The `turn_end` event's `message` carries `model`, `errorMessage`, `usage`, and `content` fields not declared in the exported `AgentSessionEvent` types. Define a local `SdkTurnEndMessage` interface (or `any`-cast) to access them safely; do not spread `(msg as any)` across multiple lines.
- **`registerCommand` handlers receive `ExtensionCommandContext`, not `ExtensionContext`**. Command context extends base context with session-tree methods (`navigateTree`, `fork`, `newSession`, `waitForIdle`). Passing `ExtensionContext` as the handler param type causes a compile error when calling `navigateTree` — extract shared navigation logic into a helper typed with `ExtensionCommandContext`.
- **`renderCall` component reuse**: Reuse `context.lastComponent` instead of creating new `Text()` each call — causes duplicate renders.
- **Tool errors must be thrown, not returned**: Never catch errors in `execute()` and return them as text content — the framework treats returned results as successful calls. The model can't distinguish a failed edit from a successful one, which breaks retry logic. Always `throw new Error(...)` and let the framework handle error propagation.
- **Subagent output formatting**: Explore/librarian subagent thinking is concatenated text, not markdown. Split on sentence boundaries (`. `, `: `, `! `, `? `), not newlines. Use `splitIntoSentences()` from `@pi-ext/shared`.
- **Subagent thinking lacks spaces**: Output often has no space after periods. Use `\s*` (not `\s+`) after `[.!?]` in the regex.
- **Librarian runs in-process via SDK**: The librarian creates an `AgentSession` with a `DefaultResourceLoader` that discovers extensions automatically (web_search, context7, etc.). No CLI flags needed — extensions are available by default.
- **`parseSections` always creates ≥1 section**: The `splitIntoSentences` fallback only triggers for truly empty output, not "unstructured" text. Use `## Header` sections to exercise the section code path.
- **`@mariozechner/pi-agent-core`**: Installed as a workspace dependency but considered internal. Prefer importing through `@mariozechner/pi-coding-agent` or create local type aliases if you need types not re-exported.
- **`@pi-ext/shared` workspace dep for integration tests**: Even if production code doesn't import from shared, `integration.test.ts` needs `@pi-ext/shared/test-mocks`. Add `"@pi-ext/shared": "workspace:*"` to `package.json dependencies` or the test will throw `Cannot find module '@pi-ext/shared/test-mocks'`.

## Command-only extensions (fire-and-forget)

- **When the operation is a bookmark, not a conversation topic** — skip tool registration entirely. Register a command (`pi.registerCommand`) that calls `runSubagent` directly inside `ctx.ui.custom()` with `BorderedLoader`. The parent model is never involved, saving a full round-trip of token processing.
- **`ctx.ui.custom()` return contract**: The callback must **return** the component (`return loader`), and async work resolves via `.then(done)`. Forgetting the return is a compile error.
- **`ctx.ui.notify()` levels**: Only accepts `"error" | "warning" | "info"` — no `"success"` level exists.
- **Double-token-cost anti-pattern**: `sendUserMessage` → parent model → tool → subagent processes conversation tokens twice with zero caching benefit. The serialized format differs from the cached prefix in the parent session (different content, different position), and the fresh subagent has no cache at all. For fire-and-forget operations, call `runSubagent` directly from the command handler instead.

## Model Configuration

- **Mistral Small 4** (`mistral-small-latest`): Must use `reasoning: false` in `models.json` — `reasoning: true` causes API errors despite native `reasoning_effort` support.

## exa-js Typing

- **`Status` type gaps**: Lacks `error` field — use `any` cast when accessing `s.error?.tag`.
- **Highlights vs text options**: `HighlightsContentsOptions` uses `numSentences`/`highlightsPerUrl`, NOT `maxCharacters`. Calculate `numSentences = Math.ceil(maxChars / 200)`.

## Test Patterns

- **Unit tests**: Co-locate with source (e.g., `render.test.ts` next to `render.ts`).
- **Integration tests**: `integration.test.ts` per extension — tests full load/register cycle.
- **Shared test utilities**: Import from `@pi-ext/shared/test-mocks`.
- **Auto-discovery runner removed**: No longer using `__tests__/all-extensions.test.ts` — it spawned subprocesses with no timeout and caused cross-workspace resolution issues. Run `bun test` from `pi/.pi/agent/extensions/` instead.
- **Mock pattern**: `mock.module()` from `bun:test` before importing the module under test.

## Pi Skill Design

- **Split skills by concern** — monolithic skills waste context because the full SKILL.md loads on every invocation. Split into focused skills (e.g., `obsidian-wiki-query`, `obsidian-wiki-ingest`, `obsidian-wiki-maintain`) so each loads only what it needs.
- **Skills vs extensions** — Skills are procedural guides (how to ingest, how to lint). For always-available operations like querying/searching, prefer a CLI tool (`~/.local/bin/wiki-search`) over a skill invocation.
- **CLI tools in skills must be framed as bash commands** — Agents interpret bare tool names (e.g., `use wiki-search "..."`) as native tools they don't have access to and skip them. Always wrap CLI invocations in bash code blocks or explicitly say "via the `bash` tool".

## New Extension Checklist

1. Create directory with `index.ts`, `package.json`, `tsconfig.json`
2. Write tests first (`index.test.ts` or `integration.test.ts`)
3. Implement the extension
4. Add to workspace `package.json` `workspaces` array
5. Verify tests pass and types check

## Explore Pre-Search Architecture (key patterns)

- **Synthetic documents for rerankers** — Build from `path | description | exports | symbols` (50–150 chars), not raw file content (first 500 chars are mostly imports).
- **No snippet injection** — First 50 lines of TS/JS are imports; reranker-ordered tier list is sufficient signal.
- **Tier thresholds** — `≥0.60` (Highly), `≥0.30` (Probably), `≥0.10` (Mentioned).
- **Ripgrep fallback** — If index is empty or repo has <10 source files, fall back to `rg -l` via `spawnSync` (no shell).
- **No shell escaping** — Both `enumerateFiles` and `fallbackRipgrep` use `spawnSync` with array args, not `spawn("sh", ["-c", ...])`.
- **Index cache bounded** — `indexCache` capped at 5 entries with LRU eviction.
- **Build timeout** — `FileIndex.build()` truncates after 5s, surfaces `hitBuildCap` in results.
- **Synthetic reranker requires `OPENROUTER_API_KEY`** — Uses `cohere/rerank-4-fast` via `openrouter.ai/api/v1/rerank`. Without the env var the reranking step cannot run.
- **System prompt stays declarative** — No ALL CAPS, no NEVER/MANDATORY/ABSOLUTE register; the output format is stated once, positively. Escalating to imperative invites churn (model resists → contributor adds emphasis → escalates further).
- **Barrel imports are invisible to proximity scoring** — `resolveImport` only resolves `.`-relative imports; `@pi-ext/shared`-style imports build no graph edges. The description-entity boost partially compensates, but cross-package callers won't surface via the importedBy graph.
- **`ExploreDetails` index signature is load-bearing** — `[key: string]: unknown` must stay on the interface for `renderSubagentResult` (`SubagentResultDetails`) compatibility. Removing it requires a coordinated change to the shared library.
