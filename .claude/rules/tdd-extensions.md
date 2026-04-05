---
description: TDD and typechecking requirements for pi extension development
globs:
  - "pi/**"
---

# Pi Extension Development: TDD + Typechecking

## Always typecheck before committing

After any change to pi extension TypeScript files, run:

```bash
cd pi/.pi/agent/extensions && for dir in */; do [ -f "$dir/tsconfig.json" ] && npx tsc --noEmit -p "$dir/tsconfig.json"; done
```

All extensions must pass `tsc --noEmit` with zero errors before committing.

## Always run tests before committing

```bash
cd pi/.pi/agent/extensions && bun test
```

All tests must pass. If a test is genuinely blocked by an external dependency (API key, network), it should use `test.skip()` with a comment explaining why.

## TDD discipline for pi extensions

When adding features or fixing bugs in pi extensions (`pi/.pi/agent/extensions/`):

1. **Write the test first** — Create or extend a `.test.ts` file with the failing test case
2. **Run the test** — Confirm it fails (RED)
3. **Implement the minimum fix** — Make the test pass (GREEN)
4. **Refactor** — Clean up while keeping tests green (REFACTOR)
5. **Typecheck** — Run `tsc --noEmit` to verify no type errors
6. **Commit** — Only after tests and types are green

### Extension test patterns

- **Unit tests**: Co-locate with source (e.g., `render.test.ts` next to `render.ts`)
- **Integration tests**: `integration.test.ts` per extension — tests the full extension load/register cycle
- **Shared test utilities**: Import from `@pi-ext/shared/test-mocks` for consistent mocks
- **Mock pattern**: Use `mock.module()` from `bun:test` before importing the module under test

### When modifying an existing extension

- If you change a function's behavior, update or add a test for it
- If you add a new exported function, add a test for it
- If you fix a bug, add a regression test first

### When creating a new extension

1. Create directory with `index.ts`, `package.json`, `tsconfig.json`
2. Write tests first (`index.test.ts` or `integration.test.ts`)
3. Implement the extension
4. Add to the workspace `package.json` `workspaces` array
5. Add to `__tests__/all-extensions.test.ts` runner
6. Verify tests pass and types check
