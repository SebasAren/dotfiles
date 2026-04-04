---
description: Pi extension development conventions and gotchas
globs:
  - "pi/*"
---

- **Bun virtual path handling**: Bun virtualizes `process.cwd()` into `/bunfs/...` which doesn't exist for subprocesses. When spawning subprocesses that need to work with the filesystem, pass the resolved real cwd via environment variable (e.g., `PI_REAL_CWD`) and check for it first in `resolveRealCwd()` functions.
- **Subagent cwd propagation**: Explore and other subagent extensions must propagate the real working directory to spawned processes, otherwise nested pi processes receive virtual paths that don't exist on the real filesystem.
- **`renderCall` component reuse**: Pi extension `renderCall` functions must reuse `context.lastComponent` instead of creating new components each time. Creating `new Text()` on every call causes duplicate renders in the TUI. Pattern: `const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0); text.setText(content); return text;`
- **Subagent output formatting**: Explore/librarian subagents output their "thinking" as concatenated text with colons between thoughts, not proper markdown. The `renderResult` fallback must split on sentence boundaries (`. `, `: `, `! `, `? `) rather than newlines to display readable bullet points. Use `splitIntoSentences()` from `@pi-ext/shared` for this.
- **Subagent thinking lacks spaces**: Subagent thinking output often has no space after periods (e.g., "there.Now" instead of "there. Now"). The `splitIntoSentences` regex must use `\s*` (zero or more whitespace) not `\s+` after `[.!?]` to handle this pattern.
- **Bun mock.module() cross-contamination**: `mock.module()` is global across the entire test process. When multiple test files mock the same module (e.g., `@sinclair/typebox`) with different shapes, mocks bleed between files. Each mock must include all methods/properties used by *any* extension that imports the module, not just the ones needed by its own test.
- **Claude-rules `globs` scoping caveat**: Rules with `globs` only inject when the LLM edits matching files. A rule with `globs: ["pi/*"]` is invisible when editing `nvim/`, `tmux/`, etc. For rules that must always apply (like worktree boundaries), omit `globs` entirely or use the `before_agent_start` hook to inject into the system prompt.
- **Worktree scope enforcement**: The `worktree-scope` extension hard-blocks `edit`/`write` calls targeting paths outside the current git worktree. No additional manual verification needed — the extension handles rejection automatically.
