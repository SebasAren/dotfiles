---
description: Pi extension development conventions and gotchas
---

- **Bun virtual path handling**: Bun virtualizes `process.cwd()` into `/bunfs/...` which doesn't exist for subprocesses. When spawning subprocesses that need to work with the filesystem, pass the resolved real cwd via environment variable (e.g., `PI_REAL_CWD`) and check for it first in `resolveRealCwd()` functions.
- **Subagent cwd propagation**: Explore and other subagent extensions must propagate the real working directory to spawned processes, otherwise nested pi processes receive virtual paths that don't exist on the real filesystem.
- **`renderCall` component reuse**: Pi extension `renderCall` functions must reuse `context.lastComponent` instead of creating new components each time. Creating `new Text()` on every call causes duplicate renders in the TUI. Pattern: `const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0); text.setText(content); return text;`
- **Subagent output formatting**: Explore/librarian subagents output their "thinking" as concatenated text with colons between thoughts, not proper markdown. The `renderResult` fallback must split on sentence boundaries (`. `, `: `, `! `, `? `) rather than newlines to display readable bullet points. Use `splitIntoSentences()` from `@pi-ext/shared` for this.
