---
name: pitchfork
description: Query code quality status from pitchfork background watchers (tests, lint, typecheck, format). Use when you want to check if tests pass, code is formatted, or lint is clean — without running checks manually.
---

# Pitchfork Quality Watchers

Pitchfork manages background daemons that run code quality checks on file change. Use it to check status instead of running `mise run` manually.

## When to Use This Skill

- Checking if tests/lint/typecheck/format pass after making changes
- Getting a quality report before committing
- Any time you'd normally run `mise run pre-commit` or individual check tasks

## Quick Check

```bash
pitchfork logs <daemon> --raw -n 50
```

## Available Daemons

| Daemon | What it checks | When it re-runs |
|--------|---------------|-----------------|
| `vitest` | TypeScript tests (extensions) | On `.ts` changes in extensions |
| `lint-ts` | ESLint on extensions | On `.ts` changes in extensions |
| `lint-python` | Ruff on all Python | On `.py` changes |
| `lint-lua` | Luacheck on Neovim config | On `.lua` changes in nvim/ |
| `lint-shell` | Shellcheck on scripts | On shell script changes |
| `typecheck` | TypeScript type checking | On `.ts` changes in extensions |
| `format-check` | Prettier + StyLua + Ruff format | On `.ts`, `.lua`, `.py` changes |

## Commands

```bash
# Start all watchers (auto-starts when cd'ing into repo if shell hook is active)
pitchfork start --all

# Check status — are daemons running?
pitchfork list

# Read latest output from a specific daemon
pitchfork logs vitest --raw -n 50
pitchfork logs lint-ts --raw -n 20

# Read all logs at once
pitchfork logs --raw -n 30

# Restart a daemon (e.g. if results seem stale)
pitchfork restart vitest

# Stop all
pitchfork stop --all
```

## Interpreting Output

Read the raw logs and interpret them directly:
- **vitest**: Look for `FAIL` / `PASS` summary at the bottom of the output
- **eslint**: Exits with error count, issues listed by file
- **ruff**: Lists violations with file:line:col format
- **typecheck**: `error TS...` lines indicate type errors
- **format-check**: Lists files that need formatting

If a daemon isn't running, start it: `pitchfork start <name>`. If results seem stale, restart it: `pitchfork restart <name>`.

## Workflow

1. Make changes to files
2. Check quality: `pitchfork logs <daemon> --raw -n 50`
3. If issues found, fix them
4. Re-check after fix (watchers auto re-run on file change)
5. Commit when green
