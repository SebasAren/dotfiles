---
globs:
  - "docs/**"
description: Astro gotchas for the dotfiles CV site
---

- **Glob loader lowercases IDs** — Entry IDs from `glob()` are derived from filenames with extension stripped and full path lowercased. `nvim/README.md` becomes `nvim/readme`, not `nvim/README`. Always use lowercase IDs in lookups and display-order maps.
- **Glob loader produces data entries, not content entries** — Markdown files without frontmatter loaded via `glob()` are data entries (`DataEntryMap`). They have `rendered.html` (pre-rendered HTML), not a `render()` method. Use `<Fragment set:html={tool.rendered.html} />` to render. Calling `.render()` throws `"is not a function"`.
- **Build as validation** — `astro build` is the primary validation command (configured as `bun run test`). It catches content collection mismatches, missing imports, and type errors at build time.
