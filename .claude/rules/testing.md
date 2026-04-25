---
description: CI and test portability gotchas
globs:
  - "**/*.test.ts"
  - ".github/workflows/*.yml"
---

- **System dependencies must be explicit in CI** — Tools that shell out to system binaries (e.g., `rg` / ripgrep) are not pre-installed on `ubuntu-latest` runners. Add an install step (e.g., `sudo apt-get install -y ripgrep`) to the workflow or tests will fail with `ENOENT`.
- **Shell-out helpers must not silently swallow errors** — When a test utility wraps `spawnSync`, returning a default value (e.g., `""`) on `result.error` or non-zero exit hides the real failure and produces false positives. Throw the error so the test fails with a clear message instead of misleading results.
- **Tests must not depend on local-only paths** — Never assume `~/Documents/wiki/wiki` (or any local path) exists in CI. Integration tests that call `main()` should create a temp directory with test fixtures and pass it via the environment override (e.g., `WIKI_DIR: tmpDir`), or assert behavior that gracefully handles an empty/absent directory.
- **Integration tests go in `integration.test.ts`** — Tests that call real binaries or external APIs belong in a separate file excluded from `mise run test` via `bun test --path-ignore-patterns="**/integration.test.ts"`. Run them manually when needed.
- **Bun test uses `--path-ignore-patterns`** (not `--exclude`) to skip test files by glob pattern.
